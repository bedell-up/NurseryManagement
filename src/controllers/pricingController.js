const { Op } = require('sequelize');
const { Pricing, PlantVariant, Plant, VendorSku, sequelize } = require('../models');
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

module.exports = { list, update, bulkUpdate };
