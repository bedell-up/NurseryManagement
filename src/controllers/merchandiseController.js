const { Op } = require('sequelize');
const { Merchandise } = require('../models');

async function list(req, res) {
  const { search, category, low_stock, inactive } = req.query;
  const where = {};

  if (!inactive) where.active = true;

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { sku:  { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (category) where.category = category;

  let rows = await Merchandise.findAll({
    where,
    order: [['category', 'ASC'], ['name', 'ASC']],
  });

  if (low_stock === 'true') {
    rows = rows.filter(i => i.reorder_threshold > 0 && i.quantity_on_hand <= i.reorder_threshold);
  }

  res.json({ merchandise: rows, total: rows.length });
}

async function get(req, res) {
  const item = await Merchandise.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
}

async function create(req, res) {
  const allowed = ['name', 'sku', 'category', 'description', 'supplier', 'cost', 'price',
                   'quantity_on_hand', 'reorder_threshold', 'location', 'notes', 'active'];
  const data = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (!data.name?.trim()) return res.status(400).json({ error: 'Name is required' });
  data.name = data.name.trim();

  const item = await Merchandise.create(data);
  res.status(201).json(item);
}

async function update(req, res) {
  const item = await Merchandise.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const allowed = ['name', 'sku', 'category', 'description', 'supplier', 'cost', 'price',
                   'quantity_on_hand', 'reorder_threshold', 'location', 'notes', 'active'];
  const data = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.name !== undefined) {
    if (!data.name?.trim()) return res.status(400).json({ error: 'Name is required' });
    data.name = data.name.trim();
  }

  await item.update(data);
  res.json(item);
}

async function adjust(req, res) {
  const { id, quantity_change, notes } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });

  const item = await Merchandise.findByPk(id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const change = parseInt(quantity_change, 10);
  if (isNaN(change)) return res.status(400).json({ error: 'quantity_change must be a number' });

  const after = item.quantity_on_hand + change;
  if (after < 0) return res.status(400).json({ error: 'Cannot reduce below zero' });

  await item.update({ quantity_on_hand: after });
  res.json({ item, quantity_before: item.quantity_on_hand - change, quantity_after: after });
}

async function remove(req, res) {
  const item = await Merchandise.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  await item.destroy();
  res.json({ ok: true });
}

module.exports = { list, get, create, update, adjust, remove };
