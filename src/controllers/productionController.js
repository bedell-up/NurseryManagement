const { Production, Plant, PlantVariant, StorageLocation, SeedLot, ProductionBatchStage } = require('../models');

const PLANT_ATTRS = ['id', 'common_name', 'scientific_name', 'plant_type', 'image_url'];
const VARIANT_ATTRS = ['id', 'container_size', 'sku'];

const include = [
  { model: Plant,                as: 'plant',    attributes: PLANT_ATTRS },
  { model: PlantVariant,         as: 'variant',  attributes: VARIANT_ATTRS },
  { model: StorageLocation,      as: 'location', attributes: ['id', 'name'] },
  { model: SeedLot,              as: 'seed_lot', attributes: ['id', 'quantity_grams', 'sourced_from'] },
  { model: ProductionBatchStage, as: 'stages',   attributes: ['id', 'stage', 'quantity', 'date'] },
];

async function adjustSeedLot(lotId, deltaG) {
  if (!lotId || !deltaG) return;
  const lot = await SeedLot.findByPk(lotId);
  if (!lot) return;
  const newQty = Math.max(0, parseFloat(lot.quantity_grams || 0) + deltaG);
  await lot.update({ quantity_grams: newQty });
}

async function list(req, res) {
  const { plant_id, status } = req.query;
  const where = {};
  if (plant_id) where.plant_id = plant_id;
  if (status) where.status = status;

  const rows = await Production.findAll({
    where,
    include,
    order: [['date_started', 'DESC NULLS LAST'], ['created_at', 'DESC']],
  });

  res.json({ production: rows, total: rows.length });
}

async function get(req, res) {
  const batch = await Production.findByPk(req.params.id, { include });
  if (!batch) return res.status(404).json({ error: 'Not found' });
  res.json(batch);
}

async function create(req, res) {
  const batch = await Production.create(req.body);

  // Deduct seed usage from the linked seed lot
  if (batch.seed_lot_id && batch.seeds_used_g) {
    await adjustSeedLot(batch.seed_lot_id, -parseFloat(batch.seeds_used_g));
  }

  const full = await Production.findByPk(batch.id, { include });
  res.status(201).json(full);
}

async function update(req, res) {
  const batch = await Production.findByPk(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Not found' });

  const oldLotId    = batch.seed_lot_id;
  const oldUsedG    = parseFloat(batch.seeds_used_g || 0);
  const newLotId    = req.body.seed_lot_id !== undefined ? req.body.seed_lot_id : oldLotId;
  const newUsedG    = req.body.seeds_used_g !== undefined ? parseFloat(req.body.seeds_used_g || 0) : oldUsedG;

  await batch.update(req.body);

  // Restore old lot, deduct from new lot
  if (oldLotId && oldUsedG) await adjustSeedLot(oldLotId, oldUsedG);   // restore
  if (newLotId && newUsedG) await adjustSeedLot(newLotId, -newUsedG);  // deduct

  const full = await Production.findByPk(batch.id, { include });
  res.json(full);
}

async function remove(req, res) {
  const batch = await Production.findByPk(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Not found' });

  // Restore seeds to lot on delete
  if (batch.seed_lot_id && batch.seeds_used_g) {
    await adjustSeedLot(batch.seed_lot_id, parseFloat(batch.seeds_used_g));
  }

  await batch.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, get, create, update, remove };
