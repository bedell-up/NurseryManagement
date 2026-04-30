const { ProductionBatchGroup, Production, Plant, PlantVariant, StorageLocation } = require('../models');

const PLANT_ATTRS = ['id', 'common_name', 'scientific_name', 'plant_type', 'image_url'];
const VARIANT_ATTRS = ['id', 'container_size', 'sku'];

const batchInclude = [
  { model: Plant, as: 'plant', attributes: PLANT_ATTRS },
  { model: PlantVariant, as: 'variant', attributes: VARIANT_ATTRS },
  { model: StorageLocation, as: 'location', attributes: ['id', 'name'] },
];

const groupInclude = [
  { model: Production, as: 'batches', include: batchInclude },
];

async function list(req, res) {
  const groups = await ProductionBatchGroup.findAll({
    include: groupInclude,
    order: [['created_at', 'DESC']],
  });
  res.json({ groups, total: groups.length });
}

async function get(req, res) {
  const group = await ProductionBatchGroup.findByPk(req.params.id, { include: groupInclude });
  if (!group) return res.status(404).json({ error: 'Not found' });
  res.json(group);
}

async function create(req, res) {
  const group = await ProductionBatchGroup.create(req.body);
  const full = await ProductionBatchGroup.findByPk(group.id, { include: groupInclude });
  res.status(201).json(full);
}

async function update(req, res) {
  const group = await ProductionBatchGroup.findByPk(req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  await group.update(req.body);
  const full = await ProductionBatchGroup.findByPk(group.id, { include: groupInclude });
  res.json(full);
}

async function remove(req, res) {
  const group = await ProductionBatchGroup.findByPk(req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  await group.destroy();
  res.json({ message: 'Deleted' });
}

module.exports = { list, get, create, update, remove };
