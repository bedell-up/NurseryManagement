const { StorageLocation } = require('../models');

async function list(req, res) {
  const where = {};
  if (req.query.active === 'true') where.is_active = true;
  const rows = await StorageLocation.findAll({ where, order: [['name', 'ASC']] });
  res.json(rows);
}

async function create(req, res) {
  const { name, description, shopify_location_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const loc = await StorageLocation.create({
    name: name.trim(),
    description: description?.trim() || null,
    shopify_location_id: shopify_location_id?.trim() || null,
  });
  res.status(201).json(loc);
}

async function update(req, res) {
  const loc = await StorageLocation.findByPk(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Not found' });
  const { name, description, is_active, shopify_location_id } = req.body;
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (is_active !== undefined) data.is_active = Boolean(is_active);
  if (shopify_location_id !== undefined) data.shopify_location_id = shopify_location_id?.trim() || null;
  await loc.update(data);
  res.json(loc);
}

async function remove(req, res) {
  const loc = await StorageLocation.findByPk(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Not found' });
  await loc.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
