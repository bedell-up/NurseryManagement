const { Op } = require('sequelize');
const { Spotlight, Plant } = require('../models');

async function listActive(req, res) {
  const now = new Date();
  const spotlights = await Spotlight.findAll({
    where: {
      is_active: true,
      [Op.or]: [
        { display_start_at: null },
        { display_start_at: { [Op.lte]: now } },
      ],
      [Op.and]: [
        {
          [Op.or]: [
            { display_end_at: null },
            { display_end_at: { [Op.gte]: now } },
          ],
        },
      ],
    },
    include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name', 'image_url'], required: false }],
    order: [['display_order', 'ASC']],
  });
  res.json(spotlights);
}

async function listAll(req, res) {
  const spotlights = await Spotlight.findAll({
    include: [{ model: Plant, as: 'plant', attributes: ['id', 'common_name', 'scientific_name'], required: false }],
    order: [['display_order', 'ASC']],
  });
  res.json(spotlights);
}

async function create(req, res) {
  const spotlight = await Spotlight.create(req.body);
  res.status(201).json(spotlight);
}

async function update(req, res) {
  const spotlight = await Spotlight.findByPk(req.params.id);
  if (!spotlight) return res.status(404).json({ error: 'Not found' });
  await spotlight.update(req.body);
  res.json(spotlight);
}

async function remove(req, res) {
  const spotlight = await Spotlight.findByPk(req.params.id);
  if (!spotlight) return res.status(404).json({ error: 'Not found' });
  await spotlight.update({ is_active: false });
  res.json({ message: 'Spotlight deactivated' });
}

module.exports = { listActive, listAll, create, update, remove };
