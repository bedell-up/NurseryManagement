const { Op } = require('sequelize');
const { Plant, PlantVariant, Inventory, Pricing, Spotlight, sequelize } = require('../models');
const { NurseryOrderItem, VendorOrderItem, Preorder, Production, SeedLot, LandscapingProjectPlant } = require('../models');

async function list(req, res) {
  const {
    search, type, native_region, sun, water,
    pollinators, birds, deer_resistant, featured,
    page = 1, limit = 50,
  } = req.query;

  const where = { is_active: true };
  if (type) where.plant_type = type;
  if (native_region) where.native_region = { [Op.iLike]: `%${native_region}%` };
  if (sun) where.sun_requirements = sun;
  if (water) where.water_requirements = water;
  if (pollinators === 'true') where.attracts_pollinators = true;
  if (birds === 'true') where.attracts_birds = true;
  if (deer_resistant === 'true') where.deer_resistant = true;
  if (featured === 'true') where.is_featured = true;

  if (search) {
    const tsQuery = search.trim().split(/\s+/).join(' & ');
    const skuPattern = sequelize.escape(`%${search}%`);
    where[Op.or] = [
      sequelize.where(
        sequelize.col('search_vector'),
        Op.match,
        sequelize.fn('to_tsquery', 'english', `${tsQuery}:*`)
      ),
      { common_name: { [Op.iLike]: `%${search}%` } },
      { scientific_name: { [Op.iLike]: `%${search}%` } },
      sequelize.literal(
        `EXISTS (SELECT 1 FROM plant_variants pv WHERE pv.plant_id = "Plant"."id" AND pv.sku ILIKE ${skuPattern} AND pv.is_active = true)`
      ),
    ];
  }

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await Plant.findAndCountAll({
    where,
    include: [
      {
        model: PlantVariant,
        as: 'variants',
        where: { is_active: true },
        required: false,
        include: [
          { model: Inventory, as: 'inventory' },
          { model: Pricing, as: 'pricing' },
        ],
      },
    ],
    order: [['common_name', 'ASC']],
    limit: parseInt(limit, 10),
    offset,
    distinct: true,
  });

  res.json({ total: count, page: parseInt(page, 10), limit: parseInt(limit, 10), plants: rows });
}

async function get(req, res) {
  const plant = await Plant.findByPk(req.params.id, {
    include: [
      {
        model: PlantVariant,
        as: 'variants',
        include: [
          { model: Inventory, as: 'inventory' },
          { model: Pricing, as: 'pricing' },
        ],
      },
      { model: Spotlight, as: 'spotlights', where: { is_active: true }, required: false },
    ],
  });
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  res.json(plant);
}

async function create(req, res) {
  const plant = await Plant.create(req.body);
  res.status(201).json(plant);
}

async function update(req, res) {
  const plant = await Plant.findByPk(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  await plant.update(req.body);
  // Refresh search vector
  await sequelize.query(`
    UPDATE plants SET search_vector = to_tsvector('english',
      coalesce(common_name, '') || ' ' || coalesce(scientific_name, '') || ' ' ||
      coalesce(genus, '') || ' ' || coalesce(native_region, '') || ' ' ||
      coalesce(bloom_color, '') || ' ' || coalesce(description, '') || ' ' ||
      coalesce(landscape_use, '') || ' ' || coalesce(notes, '')
    ) WHERE id = :id
  `, { replacements: { id: plant.id } });
  res.json(plant);
}

async function remove(req, res) {
  const plant = await Plant.findByPk(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  await plant.update({ is_active: false });
  res.json({ message: 'Plant deactivated' });
}

async function bulkRemove(req, res) {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'Expected { ids: [...] }' });
  await Plant.update({ is_active: false }, { where: { id: ids } });
  res.json({ message: `${ids.length} plant(s) deactivated` });
}

// GET /plants/duplicates — plants that share the same genus+species
async function duplicates(req, res) {
  const groups = await sequelize.query(`
    SELECT genus, species,
      array_agg(id            ORDER BY created_at ASC) AS ids,
      array_agg(common_name   ORDER BY created_at ASC) AS names,
      array_agg(scientific_name ORDER BY created_at ASC) AS scientific_names,
      array_agg(
        (SELECT COUNT(*) FROM plant_variants WHERE plant_id = plants.id AND is_active = true)
        ORDER BY created_at ASC
      ) AS variant_counts,
      array_agg(
        (SELECT COALESCE(SUM(i.quantity_on_hand), 0)
         FROM plant_variants pv JOIN inventory i ON i.variant_id = pv.id
         WHERE pv.plant_id = plants.id AND pv.is_active = true)
        ORDER BY created_at ASC
      ) AS inv_totals
    FROM plants
    WHERE genus IS NOT NULL AND species IS NOT NULL AND is_active = true
    GROUP BY genus, species
    HAVING COUNT(*) > 1
      AND bool_or(
        (SELECT COUNT(*) FROM plant_variants WHERE plant_id = plants.id AND is_active = true) = 0
      )
    ORDER BY genus, species
  `, { type: 'SELECT' });

  res.json({ groups });
}

// POST /plants/merge — move all variants from drop_id into keep_id, deactivate drop
async function merge(req, res) {
  const { keep_id, drop_id } = req.body;
  if (!keep_id || !drop_id) return res.status(400).json({ error: 'keep_id and drop_id are required' });
  if (keep_id === drop_id) return res.status(400).json({ error: 'keep_id and drop_id must be different' });

  const [keep, drop] = await Promise.all([Plant.findByPk(keep_id), Plant.findByPk(drop_id)]);
  if (!keep) return res.status(404).json({ error: 'keep plant not found' });
  if (!drop) return res.status(404).json({ error: 'drop plant not found' });

  await sequelize.transaction(async (t) => {
    // Reassign variants
    await PlantVariant.update({ plant_id: keep_id }, { where: { plant_id: drop_id }, transaction: t });

    // Reassign other FK references
    for (const [Model, fk] of [
      [Production,             'plant_id'],
      [SeedLot,                'plant_id'],
      [Spotlight,              'plant_id'],
    ]) {
      await Model.update({ plant_id: keep_id }, { where: { plant_id: drop_id }, transaction: t });
    }

    // Deactivate the duplicate plant
    await drop.update({ is_active: false }, { transaction: t });
  });

  const updated = await Plant.findByPk(keep_id, {
    include: [{ model: PlantVariant, as: 'variants', where: { is_active: true }, required: false }],
  });
  res.json({ plant: updated, merged_from: drop_id });
}

module.exports = { list, get, create, update, remove, bulkRemove, duplicates, merge };
