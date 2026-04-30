const { SeedLot, Plant, Production } = require('../models');

async function list(req, res) {
  const activeBatches = await Production.findAll({
    where: { propagation_type: 'seed', status: 'active' },
    attributes: ['plant_id'],
    raw: true,
  });
  const inProcessIds = new Set(activeBatches.map(b => b.plant_id));

  const rows = await SeedLot.findAll({
    include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] }],
    order: [[{ model: Plant, as: 'plant' }, 'common_name', 'ASC']],
  });

  res.json(rows.map(lot => ({ ...lot.toJSON(), in_process: inProcessIds.has(lot.plant_id) })));
}

async function create(req, res) {
  const { plant_id, sourced_from, qty_per_gram, seed_price, quantity_grams, sourced_date, notes } = req.body;
  if (!plant_id) return res.status(400).json({ error: 'plant_id is required' });
  const lot = await SeedLot.create({
    plant_id, sourced_from, qty_per_gram, seed_price,
    quantity_grams: quantity_grams ?? 0, sourced_date, notes,
  });
  const full = await SeedLot.findByPk(lot.id, {
    include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] }],
  });
  res.status(201).json(full);
}

async function update(req, res) {
  const lot = await SeedLot.findByPk(req.params.id);
  if (!lot) return res.status(404).json({ error: 'Not found' });
  const allowed = ['plant_id', 'sourced_from', 'qty_per_gram', 'seed_price', 'quantity_grams', 'sourced_date', 'notes'];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  await lot.update(data);
  const full = await SeedLot.findByPk(lot.id, {
    include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] }],
  });
  res.json(full);
}

async function remove(req, res) {
  const lot = await SeedLot.findByPk(req.params.id);
  if (!lot) return res.status(404).json({ error: 'Not found' });
  await lot.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
