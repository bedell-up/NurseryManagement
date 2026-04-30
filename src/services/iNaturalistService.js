// iNaturalist public API — no key required
// Docs: https://api.inaturalist.org/v1/docs/

const BASE = 'https://api.inaturalist.org/v1';

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PSCNatives/1.0 (native.pscapps.com)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`iNaturalist ${res.status}: ${url}`);
  return res.json();
}

/**
 * Search iNaturalist for a taxon by a given query string.
 * Returns the best result object or null.
 */
async function searchTaxa(query) {
  const data = await fetchJson(
    `${BASE}/taxa?q=${encodeURIComponent(query)}&rank=species,genus,subspecies,hybrid,variety&per_page=5&photos=true&locale=en`
  );
  if (!data.results?.length) return null;

  const lower = query.toLowerCase();
  const match =
    data.results.find(r => r.name?.toLowerCase() === lower) ||
    data.results.find(r => r.default_photo) ||
    data.results[0];

  if (!match?.default_photo) return null;
  return match;
}

/**
 * Look up a taxon by scientific name (with common name fallback) and return
 * the best available photo URL.
 * Returns { image_url, inat_taxon_id, inat_taxon_name, attribution } or null.
 */
async function getPlantPhoto(scientificName, commonName) {
  // Strip cultivar/variety suffixes to get a cleaner search term
  const sciQuery = scientificName
    ? scientificName.replace(/\s+(var\.|ssp\.|subsp\.|cv\.|f\.)\s+.*/i, '').trim()
    : null;

  let match = sciQuery ? await searchTaxa(sciQuery) : null;

  // Fallback to common name if scientific name search found nothing
  if (!match && commonName) {
    match = await searchTaxa(commonName);
  }

  if (!match) return null;

  const photo = match.default_photo;
  const imageUrl =
    photo.medium_url ||
    photo.url?.replace('square', 'medium') ||
    photo.square_url;

  return {
    image_url: imageUrl,
    inat_taxon_id: match.id,
    inat_taxon_name: match.name,
    attribution: photo.attribution || null,
  };
}

/**
 * Bulk fetch photos for all plants that have no image_url.
 * Returns { updated, skipped, errors }.
 */
async function bulkFetchPhotos(Plant, limit = 500) {
  const { Op } = require('sequelize');
  const plants = await Plant.findAll({
    where: {
      image_url: null,
      scientific_name: { [Op.ne]: null },
      is_active: true,
    },
    limit,
  });

  const results = { updated: 0, skipped: 0, errors: [] };

  for (const plant of plants) {
    try {
      const photo = await getPlantPhoto(plant.scientific_name);
      if (photo?.image_url) {
        await plant.update({ image_url: photo.image_url });
        results.updated++;
      } else {
        results.skipped++;
      }
      // Be polite to the iNaturalist API
      await new Promise(r => setTimeout(r, 350));
    } catch (err) {
      results.errors.push({ plant: plant.common_name, error: err.message });
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}

module.exports = { getPlantPhoto, bulkFetchPhotos };
