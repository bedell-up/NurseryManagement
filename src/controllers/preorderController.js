const { Preorder, PlantVariant, Plant, Inventory, InventoryLog } = require('../models');

async function list(req, res) {
  const { status, page = 1, limit = 50 } = req.query;
  const where = {};
  if (status) where.status = status;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await Preorder.findAndCountAll({
    where,
    include: [
      {
        model: PlantVariant,
        as: 'variant',
        include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name', 'image_url'] }],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit, 10),
    offset,
  });

  res.json({ total: count, page: parseInt(page, 10), preorders: rows });
}

async function get(req, res) {
  const preorder = await Preorder.findByPk(req.params.id, {
    include: [{ model: PlantVariant, as: 'variant', include: [{ model: Plant, as: 'plant' }] }],
  });
  if (!preorder) return res.status(404).json({ error: 'Preorder not found' });
  res.json(preorder);
}

async function create(req, res) {
  const { variant_id, quantity, customer_name, customer_email, customer_phone, estimated_availability_date, notes } = req.body;

  // Reserve inventory
  const inv = await Inventory.findOne({ where: { variant_id } });
  if (inv) {
    const before = inv.quantity_reserved;
    const after = before + (parseInt(quantity, 10) || 1);
    await inv.update({ quantity_reserved: after });
    await InventoryLog.create({
      variant_id,
      user_id: req.user?.id || null,
      change_type: 'preorder_reserve',
      quantity_before: before,
      quantity_change: parseInt(quantity, 10) || 1,
      quantity_after: after,
    });
  }

  const preorder = await Preorder.create({
    variant_id,
    quantity: parseInt(quantity, 10) || 1,
    customer_name,
    customer_email,
    customer_phone,
    estimated_availability_date,
    notes,
    status: 'confirmed',
  });

  res.status(201).json(preorder);
}

async function updateStatus(req, res) {
  const preorder = await Preorder.findByPk(req.params.id);
  if (!preorder) return res.status(404).json({ error: 'Not found' });

  const { status, notes } = req.body;

  // Release reservation if cancelled
  if (status === 'cancelled' && preorder.status !== 'cancelled') {
    const inv = await Inventory.findOne({ where: { variant_id: preorder.variant_id } });
    if (inv) {
      const before = inv.quantity_reserved;
      const after = Math.max(0, before - preorder.quantity);
      await inv.update({ quantity_reserved: after });
      await InventoryLog.create({
        variant_id: preorder.variant_id,
        user_id: req.user?.id || null,
        change_type: 'preorder_release',
        quantity_before: before,
        quantity_change: -(preorder.quantity),
        quantity_after: after,
      });
    }
  }

  await preorder.update({ status, notes: notes || preorder.notes });
  res.json(preorder);
}

module.exports = { list, get, create, updateStatus };
