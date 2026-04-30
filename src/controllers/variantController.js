const { PlantVariant, Inventory, Pricing, Plant } = require('../models');
const { generateSku } = require('../utils/sku');

async function create(req, res) {
  const { plant_id } = req.params;
  const { container_size, sku } = req.body;
  if (!container_size) return res.status(400).json({ error: 'container_size required' });

  let resolvedSku = sku || null;
  if (!resolvedSku) {
    const plant = await Plant.findByPk(plant_id);
    if (plant) resolvedSku = generateSku(plant.genus, plant.species, container_size);
  }

  const variant = await PlantVariant.create({ plant_id, container_size, sku: resolvedSku });

  // Auto-create inventory + pricing stubs
  await Inventory.create({ variant_id: variant.id });
  await Pricing.create({ variant_id: variant.id });

  res.status(201).json(variant);
}

async function update(req, res) {
  const variant = await PlantVariant.findByPk(req.params.id);
  if (!variant) return res.status(404).json({ error: 'Not found' });
  const allowed = ['container_size', 'sku', 'is_active'];
  const data = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  await variant.update(data);
  res.json(variant);
}

async function remove(req, res) {
  const variant = await PlantVariant.findByPk(req.params.id);
  if (!variant) return res.status(404).json({ error: 'Not found' });
  // Soft-delete: mark inactive rather than destroy (preserves inventory history)
  await variant.update({ is_active: false });
  res.json({ message: 'Variant deactivated' });
}

module.exports = { create, update, remove };
