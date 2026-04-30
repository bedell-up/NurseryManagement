const { Plant, PlantVariant, VendorSku } = require('../models');
const { generateSku } = require('../utils/sku');

async function regenerateAll(req, res) {
  const variants = await PlantVariant.findAll({
    include: [
      { model: Plant, as: 'plant' },
      { model: VendorSku, as: 'vendor_skus' },
    ],
  });

  // Group variants by their generated SKU to detect true collisions
  const skuMap = new Map(); // sku -> [variant, ...]
  for (const variant of variants) {
    const plant = variant.plant;
    if (!plant) continue;
    const sku = generateSku(plant.genus, plant.species, variant.container_size);
    if (!sku) continue;
    if (!skuMap.has(sku)) skuMap.set(sku, []);
    skuMap.get(sku).push(variant);
  }

  let updated = 0;
  let vendorSkusUpdated = 0;
  const conflicts = [];
  const errors = [];

  for (const [sku, group] of skuMap) {
    if (group.length > 1) {
      // Multiple variants resolve to the same SKU — report and skip rather than mangle
      conflicts.push({
        sku,
        variants: group.map(v => ({
          id: v.id,
          plant: v.plant?.scientific_name,
          container_size: v.container_size,
          current_sku: v.sku,
        })),
      });
      continue;
    }

    const variant = group[0];
    try {
      await variant.update({ sku });
      updated++;

      for (const vs of variant.vendor_skus || []) {
        await vs.update({ sku: `${sku}-${vs.vendor_code}` });
        vendorSkusUpdated++;
      }
    } catch (e) {
      errors.push({ sku, plant: variant.plant?.scientific_name, size: variant.container_size, error: e.message });
    }
  }

  res.json({ updated, vendorSkusUpdated, conflicts, errors });
}

module.exports = { regenerateAll };
