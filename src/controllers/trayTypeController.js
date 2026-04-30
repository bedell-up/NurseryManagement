const { TrayType } = require('../models');

async function list(req, res) {
  const where = {};
  if (req.query.active === 'true') where.is_active = true;
  if (req.query.category) where.category = req.query.category;
  const rows = await TrayType.findAll({
    where,
    order: [['sort_order', 'ASC'], ['name', 'ASC']],
  });
  res.json(rows);
}

async function create(req, res) {
  const { name, category = 'tray', is_active, sort_order, sku_code } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!['tray', 'pot'].includes(category)) return res.status(400).json({ error: 'category must be tray or pot' });
  const existing = await TrayType.findOne({ where: { name: name.trim(), category } });
  if (existing) return res.status(409).json({ error: `A ${category} with that name already exists` });
  const tt = await TrayType.create({
    name: name.trim(),
    category,
    is_active: is_active !== false,
    sort_order: sort_order ?? 0,
    sku_code: sku_code?.trim() || null,
  });
  res.status(201).json(tt);
}

async function update(req, res) {
  const tt = await TrayType.findByPk(req.params.id);
  if (!tt) return res.status(404).json({ error: 'Not found' });
  const { name, is_active, sort_order, sku_code } = req.body;
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (is_active !== undefined) data.is_active = Boolean(is_active);
  if (sort_order !== undefined) data.sort_order = parseInt(sort_order, 10);
  if (sku_code !== undefined) data.sku_code = sku_code?.trim() || null;
  await tt.update(data);
  res.json(tt);
}

async function remove(req, res) {
  const tt = await TrayType.findByPk(req.params.id);
  if (!tt) return res.status(404).json({ error: 'Not found' });
  await tt.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
