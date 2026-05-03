const { Op } = require('sequelize');
const { Pricing, PlantVariant, Plant, VendorSku, PotSizeCost, sequelize } = require('../models');
const shopifyService = require('../services/shopifyService');

async function list(req, res) {
  const { page = 1, limit = 100, search } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const where = {};
  if (search) {
    const pattern = sequelize.escape(`%${search}%`);
    where[Op.and] = [
      sequelize.literal(`EXISTS (
        SELECT 1 FROM plant_variants pv
        JOIN plants p ON p.id = pv.plant_id
        WHERE pv.id = "Pricing"."variant_id"
        AND (
          p.common_name ILIKE ${pattern}
          OR p.scientific_name ILIKE ${pattern}
          OR pv.sku ILIKE ${pattern}
        )
      )`),
    ];
  }

  const { count, rows } = await Pricing.findAndCountAll({
    where,
    include: [
      {
        model: PlantVariant,
        as: 'variant',
        include: [
          { model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'] },
          { model: VendorSku, as: 'vendor_skus', attributes: ['id', 'vendor_name', 'vendor_code', 'sku', 'cost'] },
        ],
      },
    ],
    limit: parseInt(limit, 10),
    offset,
  });

  res.json({ total: count, page: parseInt(page, 10), pricing: rows });
}

async function update(req, res) {
  const pricing = await Pricing.findOne({ where: { variant_id: req.params.variant_id } });
  if (!pricing) return res.status(404).json({ error: 'Pricing not found' });

  const { retail_price, sale_price, sale_starts_at, sale_ends_at, wholesale_price, cost, preorder_price } = req.body;
  await pricing.update({ retail_price, sale_price, sale_starts_at, sale_ends_at, wholesale_price, cost, preorder_price });

  // Optionally push to Shopify
  if (req.body.sync_shopify) {
    const variant = await PlantVariant.findByPk(req.params.variant_id);
    if (variant?.shopify_variant_id) {
      await shopifyService.syncPriceToShopify(variant.shopify_variant_id, retail_price, sale_price);
      await pricing.update({ shopify_synced_at: new Date() });
    }
  }

  res.json(pricing);
}

async function bulkUpdate(req, res) {
  // req.body.updates = [{ variant_id, retail_price, sale_price, sync_shopify }]
  const { updates } = req.body;
  const results = [];

  for (const u of updates) {
    const pricing = await Pricing.findOne({ where: { variant_id: u.variant_id } });
    if (!pricing) { results.push({ variant_id: u.variant_id, error: 'Not found' }); continue; }
    await pricing.update(u);
    results.push({ variant_id: u.variant_id, ok: true });
  }

  res.json({ results });
}

// POST /pricing/backfill — set retail + wholesale on unpriced variants using container pricing grid
async function backfill(req, res) {
  // Load all pot-size costs once, keyed by lowercased label
  const costs = await PotSizeCost.findAll();
  const byLabel = {};
  for (const c of costs) {
    const key = c.label.trim().toLowerCase();
    if (!byLabel[key]) byLabel[key] = [];
    byLabel[key].push(c);
  }

  // Find all active variants that have no pricing row OR have retail_price null/zero
  const variants = await PlantVariant.findAll({
    where: { is_active: true },
    include: [
      { model: Plant,   as: 'plant',   attributes: ['id', 'plant_type'] },
      { model: Pricing, as: 'pricing', required: false },
    ],
  });

  const targets = variants.filter(v => !v.pricing || !v.pricing.retail_price);

  let updated = 0;
  let skipped = 0;

  for (const variant of targets) {
    const containerSize = variant.container_size?.trim().toLowerCase();
    const plantType     = variant.plant?.plant_type ?? null;
    const candidates    = byLabel[containerSize] ?? [];
    if (!candidates.length) { skipped++; continue; }

    // Prefer plant-type-specific row; fall back to catch-all
    const match =
      candidates.find(c => c.plant_type && plantType && c.plant_type.toLowerCase() === plantType.toLowerCase()) ??
      candidates.find(c => !c.plant_type) ??
      candidates[0];

    if (match?.retail_price == null) { skipped++; continue; }

    const retail    = parseFloat(match.retail_price);
    const wholesale = parseFloat((retail * 0.5).toFixed(2));

    if (variant.pricing) {
      await variant.pricing.update({ retail_price: retail, wholesale_price: wholesale });
    } else {
      await Pricing.create({ variant_id: variant.id, retail_price: retail, wholesale_price: wholesale });
    }
    updated++;
  }

  res.json({ updated, skipped, total: targets.length });
}

// POST /pricing/sync-shopify — push all retail prices to Shopify for linked variants
async function syncAllToShopify(req, res) {
  const rows = await Pricing.findAll({
    where: { retail_price: { [Op.gt]: 0 } },
    include: [{
      model: PlantVariant,
      as: 'variant',
      required: true,
      where: { is_active: true, shopify_variant_id: { [Op.ne]: null } },
    }],
  });

  let synced = 0;
  const errors = [];

  for (const row of rows) {
    try {
      await shopifyService.syncPriceToShopify(
        row.variant.shopify_variant_id,
        row.retail_price,
        row.sale_price,
      );
      await row.update({ shopify_synced_at: new Date() });
      synced++;
    } catch (err) {
      errors.push({ variant_id: row.variant_id, error: err.message });
    }
    // Stay within Shopify REST rate limit (2 req/s)
    await new Promise(r => setTimeout(r, 500));
  }

  res.json({ synced, errors, total: rows.length });
}

module.exports = { list, update, bulkUpdate, backfill, syncAllToShopify };
