const { PlantType } = require('../models');

async function list(req, res) {
  const where = {};
  if (req.query.active === 'true') where.is_active = true;
  const rows = await PlantType.findAll({
    where,
    order: [['sort_order', 'ASC'], ['label', 'ASC']],
  });
  res.json(rows);
}

async function create(req, res) {
  const { name, label, sort_order, is_active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!label?.trim()) return res.status(400).json({ error: 'label is required' });
  const slug = name.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  const existing = await PlantType.findOne({ where: { name: slug } });
  if (existing) return res.status(409).json({ error: 'A plant type with that name already exists' });
  const pt = await PlantType.create({
    name: slug,
    label: label.trim(),
    is_active: is_active !== false,
    sort_order: sort_order ?? 0,
  });
  res.status(201).json(pt);
}

async function update(req, res) {
  const pt = await PlantType.findByPk(req.params.id);
  if (!pt) return res.status(404).json({ error: 'Not found' });
  const { name, label, is_active, sort_order } = req.body;
  const data = {};
  if (name !== undefined) {
    const slug = name.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!slug) return res.status(400).json({ error: 'name cannot be empty' });
    const conflict = await PlantType.findOne({ where: { name: slug } });
    if (conflict && conflict.id !== pt.id) return res.status(409).json({ error: 'A plant type with that name already exists' });
    data.name = slug;
  }
  if (label !== undefined) data.label = label.trim();
  if (is_active !== undefined) data.is_active = Boolean(is_active);
  if (sort_order !== undefined) data.sort_order = parseInt(sort_order, 10);
  await pt.update(data);
  res.json(pt);
}

async function remove(req, res) {
  const pt = await PlantType.findByPk(req.params.id);
  if (!pt) return res.status(404).json({ error: 'Not found' });
  await pt.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
