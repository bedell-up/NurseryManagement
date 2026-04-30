const { Op } = require('sequelize');
const { PlantVariant, Plant, Inventory, InventoryLocationSplit, Pricing } = require('../models');

// Shared include list used by all three lookup types
const variantIncludes = [
  {
    model: Plant,
    as: 'plant',
    attributes: [
      'id', 'common_name', 'scientific_name', 'genus', 'species',
      'plant_code', 'plant_type', 'image_url', 'is_active',
    ],
  },
  {
    model: Inventory,
    as: 'inventory',
    include: [{ model: InventoryLocationSplit, as: 'location_splits' }],
  },
  {
    model: Pricing,
    as: 'pricing',
    attributes: ['retail_price', 'sale_price', 'sale_starts_at', 'sale_ends_at'],
  },
];

function formatVariantResult(variant, matchType) {
  return {
    match_type: matchType,
    variant: {
      id: variant.id,
      container_size: variant.container_size,
      sku: variant.sku,
      barcode: variant.barcode,
      is_active: variant.is_active,
    },
    plant: variant.plant,
    inventory: variant.inventory,
    pricing: variant.pricing,
  };
}

// GET /api/scan/barcode/:barcode
// Look up a variant by its internal auto-generated barcode.
async function byBarcode(req, res) {
  const variant = await PlantVariant.findOne({
    where: { barcode: req.params.barcode.toUpperCase() },
    include: variantIncludes,
  });
  if (!variant) return res.status(404).json({ error: 'Barcode not found' });
  res.json(formatVariantResult(variant, 'barcode'));
}

// GET /api/scan/sku/:sku
// Look up a variant by the human-readable user SKU (case-insensitive).
async function byUserSku(req, res) {
  const variant = await PlantVariant.findOne({
    where: { sku: { [Op.iLike]: req.params.sku } },
    include: variantIncludes,
  });
  if (!variant) return res.status(404).json({ error: 'SKU not found' });
  res.json(formatVariantResult(variant, 'sku'));
}

// GET /api/scan/plant/:code
// Look up a plant by its short plant_code, returning all active variants with inventory.
// Useful when a QR code points to the plant rather than a specific size.
async function byPlantCode(req, res) {
  const plant = await Plant.findOne({
    where: { plant_code: { [Op.iLike]: req.params.code }, is_active: true },
    include: [
      {
        model: PlantVariant,
        as: 'variants',
        where: { is_active: true },
        required: false,
        include: [
          {
            model: Inventory,
            as: 'inventory',
            include: [{ model: InventoryLocationSplit, as: 'location_splits' }],
          },
          {
            model: Pricing,
            as: 'pricing',
            attributes: ['retail_price', 'sale_price', 'sale_starts_at', 'sale_ends_at'],
          },
        ],
      },
    ],
  });
  if (!plant) return res.status(404).json({ error: 'Plant code not found' });

  res.json({
    match_type: 'plant_code',
    plant: {
      id: plant.id,
      common_name: plant.common_name,
      scientific_name: plant.scientific_name,
      genus: plant.genus,
      species: plant.species,
      plant_code: plant.plant_code,
      plant_type: plant.plant_type,
      image_url: plant.image_url,
    },
    variants: plant.variants.map(v => ({
      id: v.id,
      container_size: v.container_size,
      sku: v.sku,
      barcode: v.barcode,
      is_active: v.is_active,
      inventory: v.inventory,
      pricing: v.pricing,
    })),
  });
}

module.exports = { byBarcode, byUserSku, byPlantCode };
