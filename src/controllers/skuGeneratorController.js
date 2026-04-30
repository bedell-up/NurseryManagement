const { Op } = require('sequelize');
const { Plant, PlantVariant, PlantTypeDefault, TrayType, Vendor } = require('../models');

function buildSkuPrefix(plant) {
  const genus = (plant.genus || '').trim();
  const species = (plant.species || '').trim();
  const cultivar = (plant.cultivar || '').trim();

  let g3 = genus
    ? genus.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
    : (plant.scientific_name || '').trim().split(/\s+/)[0].replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();

  const effSpecies = species || (plant.scientific_name || '').trim().split(/\s+/)[1] || '';

  if (effSpecies.toLowerCase() === 'x' && cultivar) {
    const cv3 = cultivar.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
    return `${g3}X${cv3}`;
  }

  const s3 = effSpecies.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();

  if (cultivar) {
    const cv3 = cultivar.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
    return `${g3}${s3}${cv3}`;
  }

  return `${g3}${s3}`;
}

function buildSku(plant, skuCode, vendorCode) {
  const prefix = buildSkuPrefix(plant);
  if (!prefix || !skuCode) return null;
  return vendorCode ? `${prefix}-${skuCode}-${vendorCode}` : `${prefix}-${skuCode}`;
}

async function loadData(vendorId) {
  const [plants, defaults, trayTypes, vendor] = await Promise.all([
    Plant.findAll({
      where: { plant_type: { [Op.ne]: null } },
      order: [['common_name', 'ASC']],
    }),
    PlantTypeDefault.findAll(),
    TrayType.findAll({ where: { is_active: true } }),
    vendorId ? Vendor.findByPk(vendorId) : Promise.resolve(null),
  ]);

  const defaultsByType = Object.fromEntries(defaults.map(d => [d.plant_type, d]));
  const trayByName = {};
  for (const t of trayTypes) trayByName[`${t.category}:${t.name}`] = t;

  return { plants, defaultsByType, trayByName, vendor };
}

function buildRows(plants, defaultsByType, trayByName, vendorCode) {
  const rows = [];
  for (const plant of plants) {
    const ptd = defaultsByType[plant.plant_type];
    if (!ptd) continue;

    const allSizes = [
      ...(ptd.default_tray_types || []).map(n => ({ name: n, category: 'tray' })),
      ...(ptd.default_pot_sizes || []).map(n => ({ name: n, category: 'pot' })),
    ];

    for (const { name, category } of allSizes) {
      const tt = trayByName[`${category}:${name}`];
      if (!tt?.sku_code) continue;

      const sku = buildSku(plant, tt.sku_code, vendorCode);
      if (!sku) continue;

      rows.push({ plant, containerSize: name, category, tt, sku });
    }
  }
  return rows;
}

async function preview(req, res) {
  const { vendor_id } = req.query;
  const { plants, defaultsByType, trayByName, vendor } = await loadData(vendor_id);

  const existingSkus = new Set(
    (await PlantVariant.findAll({ attributes: ['sku'] })).map(v => v.sku).filter(Boolean)
  );

  const vendorCode = vendor?.code || null;
  const rows = buildRows(plants, defaultsByType, trayByName, vendorCode).map(r => ({
    plant_id: r.plant.id,
    plant_name: r.plant.common_name,
    scientific_name: r.plant.scientific_name,
    plant_type: r.plant.plant_type,
    container_size: r.containerSize,
    category: r.category,
    sku: r.sku,
    exists: existingSkus.has(r.sku),
  }));

  res.json({ rows, vendor: vendor || null });
}

async function generate(req, res) {
  const { vendor_id } = req.body;
  const { plants, defaultsByType, trayByName, vendor } = await loadData(vendor_id);

  const existingSkus = new Set(
    (await PlantVariant.findAll({ attributes: ['sku'] })).map(v => v.sku).filter(Boolean)
  );

  const vendorCode = vendor?.code || null;
  const rows = buildRows(plants, defaultsByType, trayByName, vendorCode);

  let created = 0;
  let skipped = 0;

  for (const { plant, containerSize, sku } of rows) {
    if (existingSkus.has(sku)) { skipped++; continue; }
    await PlantVariant.create({ plant_id: plant.id, container_size: containerSize, sku, is_active: true });
    existingSkus.add(sku);
    created++;
  }

  res.json({ created, skipped });
}

module.exports = { preview, generate };
