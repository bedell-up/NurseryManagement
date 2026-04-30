const { DeliveryWindow, DeliveryWindowItem, PlantVariant, Plant, Inventory, InventoryLog } = require('../models');

async function list(req, res) {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;

  const windows = await DeliveryWindow.findAll({
    where,
    include: [
      {
        model: DeliveryWindowItem,
        as: 'items',
        include: [
          {
            model: PlantVariant,
            as: 'variant',
            include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] }],
          },
        ],
      },
    ],
    order: [['expected_date', 'ASC']],
  });

  res.json(windows);
}

async function get(req, res) {
  const window = await DeliveryWindow.findByPk(req.params.id, {
    include: [
      {
        model: DeliveryWindowItem,
        as: 'items',
        include: [{ model: PlantVariant, as: 'variant', include: [{ model: Plant, as: 'plant' }] }],
      },
    ],
  });
  if (!window) return res.status(404).json({ error: 'Delivery window not found' });
  res.json(window);
}

async function create(req, res) {
  const { name, expected_date, supplier_name, notes, is_visible_to_customers, items } = req.body;
  const window = await DeliveryWindow.create({ name, expected_date, supplier_name, notes, is_visible_to_customers });

  if (items && items.length) {
    await DeliveryWindowItem.bulkCreate(
      items.map((i) => ({ delivery_window_id: window.id, variant_id: i.variant_id, quantity_expected: i.quantity_expected }))
    );
  }

  const full = await DeliveryWindow.findByPk(window.id, { include: [{ model: DeliveryWindowItem, as: 'items' }] });
  res.status(201).json(full);
}

async function update(req, res) {
  const window = await DeliveryWindow.findByPk(req.params.id);
  if (!window) return res.status(404).json({ error: 'Not found' });
  await window.update(req.body);
  res.json(window);
}

// Mark a delivery as arrived — add received quantities to inventory
async function markArrived(req, res) {
  const window = await DeliveryWindow.findByPk(req.params.id, {
    include: [{ model: DeliveryWindowItem, as: 'items' }],
  });
  if (!window) return res.status(404).json({ error: 'Not found' });

  const { received_quantities } = req.body;
  // received_quantities: [{ item_id, quantity_received }]

  for (const { item_id, quantity_received } of received_quantities) {
    const item = window.items.find((i) => i.id === item_id);
    if (!item) continue;
    await item.update({ quantity_received });

    const inv = await Inventory.findOne({ where: { variant_id: item.variant_id } });
    if (inv) {
      const before = inv.quantity_on_hand;
      const after = before + parseInt(quantity_received, 10);
      await inv.update({ quantity_on_hand: after, quantity_incoming: Math.max(0, inv.quantity_incoming - quantity_received) });
      await InventoryLog.create({
        variant_id: item.variant_id,
        user_id: req.user?.id || null,
        change_type: 'delivery_received',
        quantity_before: before,
        quantity_change: parseInt(quantity_received, 10),
        quantity_after: after,
        reference_id: window.id,
      });
    }
  }

  await window.update({ status: 'arrived', confirmed_date: new Date() });
  res.json({ message: 'Delivery marked as arrived', window });
}

module.exports = { list, get, create, update, markArrived };
