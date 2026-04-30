const { Op } = require('sequelize');
const { Plant, PlantVariant, Inventory, Pricing, Spotlight, sequelize } = require('../models');

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

module.exports = { list, get, create, update, remove, bulkRemove };
