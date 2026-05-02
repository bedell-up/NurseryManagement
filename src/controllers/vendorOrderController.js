const { VendorOrder, VendorOrderItem, Vendor, PlantVariant, Plant, Pricing, Inventory, InventoryLog, VendorSku } = require('../models');

const ITEM_INCLUDE = {
  model: VendorOrderItem,
  as: 'items',
  include: [
    {
      model: PlantVariant,
      as: 'variant',
      attributes: ['id', 'sku', 'container_size'],
      include: [
        { model: Plant,    as: 'plant',   attributes: ['id', 'common_name', 'scientific_name'] },
        { model: Pricing,  as: 'pricing', attributes: ['retail_price', 'wholesale_price'] },
        { model: VendorSku, as: 'vendor_skus', attributes: ['id', 'vendor_name', 'vendor_code', 'cost'] },
      ],
    },
  ],
};

async function list(req, res) {
  const { status, vendor_id } = req.query;
  const where = {};
  if (status)    where.status    = status;
  if (vendor_id) where.vendor_id = vendor_id;

  const orders = await VendorOrder.findAll({
    where,
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'code'] },
      ITEM_INCLUDE,
    ],
    order: [['created_at', 'DESC']],
  });
  res.json({ orders });
}

async function get(req, res) {
  const order = await VendorOrder.findByPk(req.params.id, {
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'code'] },
      ITEM_INCLUDE,
    ],
  });
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json({ order });
}

async function create(req, res) {
  const { vendor_id, order_date, expected_date, notes, items = [] } = req.body;
  if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required' });

  const order = await VendorOrder.create({
    vendor_id,
    order_date:    order_date    || null,
    expected_date: expected_date || null,
    notes:         notes         || null,
    status:        'draft',
    created_by:    req.user?.id  || null,
  });

  if (items.length) {
    await VendorOrderItem.bulkCreate(
      items.map(i => ({
        order_id:        order.id,
        variant_id:      i.variant_id,
        quantity_ordered: parseInt(i.quantity_ordered, 10) || 1,
        unit_cost:       i.unit_cost != null ? parseFloat(i.unit_cost) : null,
        location:        i.location || null,
        notes:           i.notes    || null,
      }))
    );
  }

  const full = await VendorOrder.findByPk(order.id, {
    include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'code'] }, ITEM_INCLUDE],
  });
  res.status(201).json({ order: full });
}

async function update(req, res) {
  const order = await VendorOrder.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'received')  return res.status(400).json({ error: 'Cannot edit a received order' });
  if (order.status === 'cancelled') return res.status(400).json({ error: 'Cannot edit a cancelled order' });

  const { vendor_id, order_date, expected_date, notes, items } = req.body;
  await order.update({
    vendor_id:     vendor_id     ?? order.vendor_id,
    order_date:    order_date    ?? order.order_date,
    expected_date: expected_date ?? order.expected_date,
    notes:         notes         ?? order.notes,
  });

  if (Array.isArray(items)) {
    await VendorOrderItem.destroy({ where: { order_id: order.id } });
    if (items.length) {
      await VendorOrderItem.bulkCreate(
        items.map(i => ({
          order_id:         order.id,
          variant_id:       i.variant_id,
          quantity_ordered: parseInt(i.quantity_ordered, 10) || 1,
          unit_cost:        i.unit_cost != null ? parseFloat(i.unit_cost) : null,
          location:         i.location || null,
          notes:            i.notes    || null,
        }))
      );
    }
  }

  const full = await VendorOrder.findByPk(order.id, {
    include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'code'] }, ITEM_INCLUDE],
  });
  res.json({ order: full });
}

// POST /vendor-orders/:id/mark-ordered
async function markOrdered(req, res) {
  const order = await VendorOrder.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status !== 'draft') return res.status(400).json({ error: `Order is already ${order.status}` });
  await order.update({ status: 'ordered' });
  res.json({ order });
}

// POST /vendor-orders/:id/receive
// For each item: update VendorSku.cost, adjust inventory, log delivery.
async function receive(req, res) {
  const order = await VendorOrder.findByPk(req.params.id, {
    include: [
      { model: Vendor, as: 'vendor' },
      ITEM_INCLUDE,
    ],
  });
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'received')  return res.status(400).json({ error: 'Already received' });
  if (order.status === 'cancelled') return res.status(400).json({ error: 'Order is cancelled' });
  if (!order.items?.length)         return res.status(400).json({ error: 'Order has no items' });

  const vendor = order.vendor;
  const results = [];
  const errors  = [];

  // Accept optional per-item receive quantities from request body
  const qtyOverrides = {};
  (req.body?.items ?? []).forEach(i => {
    if (i.id && i.quantity_received != null) {
      qtyOverrides[i.id] = parseInt(i.quantity_received, 10);
    }
  });

  for (const item of order.items) {
    const qtyReceived = qtyOverrides[item.id] ?? item.quantity_ordered;

    // 1. Upsert VendorSku.cost if a unit_cost was set
    if (item.unit_cost != null && vendor) {
      const existing = await VendorSku.findOne({
        where: { variant_id: item.variant_id, vendor_code: vendor.code },
      });
      if (existing) {
        await existing.update({ cost: item.unit_cost, vendor_name: vendor.name });
      } else {
        await VendorSku.create({
          variant_id:  item.variant_id,
          vendor_name: vendor.name,
          vendor_code: vendor.code,
          cost:        item.unit_cost,
        });
      }
    }

    // 2. Adjust inventory
    let inv = await Inventory.findOne({ where: { variant_id: item.variant_id } });
    if (!inv) {
      inv = await Inventory.create({ variant_id: item.variant_id, quantity_on_hand: 0 });
    }

    const before = inv.quantity_on_hand;
    const after  = before + qtyReceived;
    const incomingAfter = Math.max(0, (inv.quantity_incoming ?? 0) - qtyReceived);

    await inv.update({ quantity_on_hand: after, quantity_incoming: incomingAfter });

    // 3. Inventory log
    await InventoryLog.create({
      variant_id:      item.variant_id,
      user_id:         req.user?.id || null,
      change_type:     'delivery_received',
      quantity_before: before,
      quantity_change: qtyReceived,
      quantity_after:  after,
      location:        item.location || null,
      reference_id:    String(order.order_number),
      notes: `Vendor order #${order.order_number} — ${vendor?.name ?? 'Unknown vendor'}${item.unit_cost != null ? ` @ $${parseFloat(item.unit_cost).toFixed(2)}/ea` : ''}`,
    });

    // 4. Record received quantity on item
    await item.update({ quantity_received: qtyReceived });

    results.push({
      variant_id: item.variant_id,
      sku:        item.variant?.sku,
      qty_received: qtyReceived,
      inventory_before: before,
      inventory_after:  after,
      cog_updated: item.unit_cost != null,
    });
  }

  await order.update({ status: 'received', received_date: new Date() });

  res.json({ message: 'Order received', order_number: order.order_number, results, errors });
}

async function cancel(req, res) {
  const order = await VendorOrder.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'received') return res.status(400).json({ error: 'Cannot cancel a received order' });
  await order.update({ status: 'cancelled' });
  res.json({ order });
}

async function remove(req, res) {
  const order = await VendorOrder.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'received') return res.status(400).json({ error: 'Cannot delete a received order' });
  await order.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, get, create, update, markOrdered, receive, cancel, remove };
