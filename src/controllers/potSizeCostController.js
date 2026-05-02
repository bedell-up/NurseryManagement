const { PotSizeCost } = require('../models');

async function list(req, res) {
  const items = await PotSizeCost.findAll({ order: [['sort_order', 'ASC'], ['label', 'ASC']] });
  res.json({ pot_size_costs: items });
}

async function create(req, res) {
  const { label, retail_price, wholesale_price, plant_type, notes, sort_order } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: 'Label is required' });

  const item = await PotSizeCost.create({
    label:           label.trim(),
    retail_price:    retail_price    != null ? parseFloat(retail_price)    : null,
    wholesale_price: wholesale_price != null ? parseFloat(wholesale_price) : null,
    plant_type:      plant_type?.trim() || null,
    notes:           notes  || null,
    sort_order:      parseInt(sort_order, 10) || 0,
  });
  res.status(201).json({ pot_size_cost: item });
}

async function update(req, res) {
  const item = await PotSizeCost.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const { label, retail_price, wholesale_price, plant_type, notes, sort_order } = req.body;
  await item.update({
    label:           label?.trim()             ?? item.label,
    retail_price:    retail_price    != null   ? parseFloat(retail_price)    : null,
    wholesale_price: wholesale_price != null   ? parseFloat(wholesale_price) : null,
    plant_type:      'plant_type' in req.body  ? (plant_type?.trim() || null) : item.plant_type,
    notes:           'notes' in req.body       ? (notes || null) : item.notes,
    sort_order:      sort_order != null        ? parseInt(sort_order, 10) : item.sort_order,
  });
  res.json({ pot_size_cost: item });
}

async function remove(req, res) {
  const item = await PotSizeCost.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  await item.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
