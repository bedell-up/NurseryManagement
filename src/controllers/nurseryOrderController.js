const { NurseryOrder, NurseryOrderItem, PlantVariant, Plant, Inventory, InventoryLog, Pricing, User } = require('../models');

const ITEM_INCLUDE = {
  model: NurseryOrderItem,
  as: 'items',
  include: [
    {
      model: PlantVariant,
      as: 'variant',
      attributes: ['id', 'sku', 'container_size', 'shopify_variant_id'],
      include: [
        { model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] },
        { model: Pricing, as: 'pricing', attributes: ['retail_price', 'wholesale_price'] },
      ],
    },
  ],
};

async function list(req, res) {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;
  const orders = await NurseryOrder.findAll({
    where,
    include: [ITEM_INCLUDE],
    order: [['created_at', 'DESC']],
  });
  res.json({ orders });
}

async function get(req, res) {
  const order = await NurseryOrder.findByPk(req.params.id, { include: [ITEM_INCLUDE] });
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json({ order });
}

async function create(req, res) {
  const { customer_name, customer_email, customer_phone, notes, items = [] } = req.body;
  const order = await NurseryOrder.create({
    customer_name: customer_name || null,
    customer_email: customer_email || null,
    customer_phone: customer_phone || null,
    notes: notes || null,
    status: 'draft',
    created_by: req.user?.id || null,
  });

  if (items.length) {
    await NurseryOrderItem.bulkCreate(
      items.map(i => ({
        order_id:   order.id,
        variant_id: i.variant_id,
        quantity:   parseInt(i.quantity, 10) || 1,
        location:   i.location || null,
        unit_price: i.unit_price ?? null,
      }))
    );
  }

  const full = await NurseryOrder.findByPk(order.id, { include: [ITEM_INCLUDE] });
  res.status(201).json({ order: full });
}

async function update(req, res) {
  const order = await NurseryOrder.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'fulfilled') return res.status(400).json({ error: 'Cannot edit a fulfilled order' });

  const { customer_name, customer_email, customer_phone, notes, items } = req.body;
  await order.update({
    customer_name:  customer_name  ?? order.customer_name,
    customer_email: customer_email ?? order.customer_email,
    customer_phone: customer_phone ?? order.customer_phone,
    notes:          notes          ?? order.notes,
  });

  if (Array.isArray(items)) {
    await NurseryOrderItem.destroy({ where: { order_id: order.id } });
    if (items.length) {
      await NurseryOrderItem.bulkCreate(
        items.map(i => ({
          order_id:   order.id,
          variant_id: i.variant_id,
          quantity:   parseInt(i.quantity, 10) || 1,
          location:   i.location || null,
          unit_price: i.unit_price ?? null,
        }))
      );
    }
  }

  const full = await NurseryOrder.findByPk(order.id, { include: [ITEM_INCLUDE] });
  res.json({ order: full });
}

// POST /nursery-orders/:id/fulfill
// Confirms the order and deducts inventory for all line items.
async function fulfill(req, res) {
  const order = await NurseryOrder.findByPk(req.params.id, { include: [ITEM_INCLUDE] });
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'fulfilled') return res.status(400).json({ error: 'Already fulfilled' });
  if (order.status === 'cancelled') return res.status(400).json({ error: 'Order is cancelled' });
  if (!order.items?.length) return res.status(400).json({ error: 'Order has no items' });

  const results = [];
  const errors  = [];

  for (const item of order.items) {
    const inv = await Inventory.findOne({ where: { variant_id: item.variant_id } });
    if (!inv) {
      errors.push({ sku: item.variant?.sku, error: 'No inventory record found' });
      continue;
    }

    const before    = inv.quantity_on_hand;
    const requested = item.quantity;
    const after     = Math.max(0, before - requested);

    await inv.update({ quantity_on_hand: after });

    await InventoryLog.create({
      variant_id:       item.variant_id,
      user_id:          req.user?.id || null,
      change_type:      'sale',
      quantity_before:  before,
      quantity_change:  -requested,
      quantity_after:   after,
      location:         item.location || null,
      reference_id:     String(order.order_number),
      notes:            `Nursery order #${order.order_number}${order.customer_name ? ` — ${order.customer_name}` : ''}`,
    });

    results.push({ sku: item.variant?.sku, before, after, deducted: requested });
  }

  await order.update({
    status:       'fulfilled',
    fulfilled_at: new Date(),
    fulfilled_by: req.user?.id || null,
  });

  res.json({ message: 'Order fulfilled', order_number: order.order_number, results, errors });
}

async function cancel(req, res) {
  const order = await NurseryOrder.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'fulfilled') return res.status(400).json({ error: 'Cannot cancel a fulfilled order — adjust inventory manually if needed' });
  await order.update({ status: 'cancelled' });
  res.json({ order });
}

async function remove(req, res) {
  const order = await NurseryOrder.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'fulfilled') return res.status(400).json({ error: 'Cannot delete a fulfilled order' });
  await order.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, get, create, update, fulfill, cancel, remove };
