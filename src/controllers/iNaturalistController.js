const fs = require('fs');
const path = require('path');
const { Plant } = require('../models');
const { getPlantPhoto } = require('../services/iNaturalistService');

const LOG_PATH = path.resolve(__dirname, '../../data/inat-fetch-log.json');

function saveLog(log) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function readLog() {
  if (!fs.existsSync(LOG_PATH)) return null;
  return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
}

// Fetch and save a photo for a single plant
async function fetchPhotoForPlant(req, res) {
  const plant = await Plant.findByPk(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  const query = req.query.scientific_name || plant.scientific_name;
  if (!query && !plant.common_name) return res.status(400).json({ error: 'No name to search' });

  const photo = await getPlantPhoto(query, plant.common_name);
  if (!photo) return res.status(404).json({ error: 'No photo found on iNaturalist' });

  await plant.update({ image_url: photo.image_url });
  res.json({ image_url: photo.image_url, inat_taxon_name: photo.inat_taxon_name, attribution: photo.attribution });
}

// Preview iNaturalist results without saving
async function previewPhoto(req, res) {
  const { scientific_name } = req.query;
  if (!scientific_name) return res.status(400).json({ error: 'scientific_name is required' });
  const photo = await getPlantPhoto(scientific_name);
  if (!photo) return res.status(404).json({ error: 'No photo found' });
  res.json(photo);
}

// Return the last bulk fetch log
async function getLastLog(req, res) {
  const log = readLog();
  if (!log) return res.status(404).json({ error: 'No fetch log found. Run a bulk fetch first.' });
  res.json(log);
}

// Bulk fetch with SSE progress stream — records full detail log
async function bulkFetchStream(req, res) {
  const { Op } = require('sequelize');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const plants = await Plant.findAll({
    where: { image_url: null, scientific_name: { [Op.ne]: null }, is_active: true },
    limit: parseInt(req.query.limit, 10) || 600,
  });

  send({ type: 'start', total: plants.length });

  let updated = 0, skipped = 0, errors = 0;
  const notFound = [];
  const errorList = [];

  for (const plant of plants) {
    try {
      const photo = await getPlantPhoto(plant.scientific_name, plant.common_name);
      if (photo?.image_url) {
        await plant.update({ image_url: photo.image_url });
        updated++;
        send({ type: 'progress', plant: plant.common_name, status: 'updated', image_url: photo.image_url, updated, skipped, errors, total: plants.length });
      } else {
        skipped++;
        notFound.push({ common_name: plant.common_name, scientific_name: plant.scientific_name, plant_id: plant.id });
        send({ type: 'progress', plant: plant.common_name, status: 'skipped', updated, skipped, errors, total: plants.length });
      }
      await new Promise(r => setTimeout(r, 350));
    } catch (err) {
      errors++;
      errorList.push({ common_name: plant.common_name, scientific_name: plant.scientific_name, plant_id: plant.id, error: err.message });
      send({ type: 'progress', plant: plant.common_name, status: 'error', error: err.message, updated, skipped, errors, total: plants.length });
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const log = {
    run_at: new Date().toISOString(),
    summary: { total: plants.length, updated, skipped, errors },
    not_found: notFound,
    errors: errorList,
  };
  saveLog(log);

  send({ type: 'done', updated, skipped, errors, total: plants.length });
  res.end();
}

module.exports = { fetchPhotoForPlant, previewPhoto, getLastLog, bulkFetchStream };
