// Check scientific name spelling for all plants missing images
// Queries iNaturalist and reports what it actually finds vs what we have
require('dotenv').config();
const { Plant } = require('../src/models');
const { Op } = require('sequelize');

const BASE = 'https://api.inaturalist.org/v1';

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PSCNatives/1.0 (native.pscapps.com)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`iNat ${res.status}`);
  return res.json();
}

async function searchTaxa(query) {
  try {
    const data = await fetchJson(
      `${BASE}/taxa?q=${encodeURIComponent(query)}&rank=species,genus,subspecies&per_page=3&photos=true&locale=en`
    );
    return data.results || [];
  } catch {
    return [];
  }
}

// Known corrections to apply automatically
const KNOWN_FIXES = {
  // Misspelled genus/species
  'Cirtrus limon':                    'Citrus limon',
  'Camelia sinensis':                 'Camellia sinensis',
  'Lazula comosa var. laxa':          'Luzula comosa var. laxa',
  'Lazula parviflora':                'Luzula parviflora',
  'Holodiscus microphylus':           'Holodiscus microphyllus',
  'Symphyotricum hallii':             'Symphyotrichum hallii',
  'Pernettya mucronotta':             'Pernettya mucronata',
  'Ribes lobii':                      'Ribes lobbii',
  'Prosartes hookerii':               'Prosartes hookeri',
  // Extra text appended to scientific name
  'Artemisia suksdorfii- Coastal mugwort': 'Artemisia suksdorfii',
  'Celtis reticulata- Western/Netleaf Hackberry': 'Celtis reticulata',
  'Eschscholzia californica- California Poppy': 'Eschscholzia californica',
  "Morus bombycis 'Unryu'- Contorted Mulberry": 'Morus bombycis',
  'Iris tenax Douglas':               'Iris tenax',
  // Incomplete names (drop trailing "var." / "ssp")
  'Apium graveolens var.':            'Apium graveolens',
  'Beta vulgaris var.':               'Beta vulgaris',
  'Buddleja davidii ssp.':            'Buddleja davidii',
  'Rubus fruticosus ssp':             'Rubus fruticosus',
  // Cultivar noise
  "Fragaria x ananassa 'Hood'":       'Fragaria x ananassa',
  'Morus alba  x rubra':              'Morus alba x rubra',
};

async function main() {
  const plants = await Plant.findAll({
    where: { image_url: null, scientific_name: { [Op.ne]: null } },
    attributes: ['id', 'common_name', 'scientific_name'],
    order: [['scientific_name', 'ASC']],
  });

  console.log(`\nChecking ${plants.length} plants against iNaturalist...\n`);

  const updates = [];
  const noMatch = [];

  for (const plant of plants) {
    const orig = plant.scientific_name;
    const name = plant.common_name;

    // Skip non-species entries
    if (['Annuals', 'Perennials', 'Native Supplemental Late Blooming Mix'].includes(orig)) {
      console.log(`SKIP  ${orig} — not a species`);
      continue;
    }

    // Apply known fix if we have one
    const knownFix = KNOWN_FIXES[orig];
    const queryName = knownFix || orig;

    // Strip suffixes for search (same logic as the service)
    const searchQuery = queryName
      .replace(/\s+(var\.|ssp\.|subsp\.|cv\.|f\.)\s+.*/i, '')
      .replace(/\s+'[^']+'/g, '')  // remove cultivar names in quotes
      .trim();

    const results = await searchTaxa(searchQuery);

    const lower = searchQuery.toLowerCase();
    const best =
      results.find(r => r.name?.toLowerCase() === lower) ||
      results.find(r => r.default_photo) ||
      results[0];

    if (!best) {
      // Try common name as fallback
      const fallback = await searchTaxa(name);
      const fb = fallback.find(r => r.default_photo) || fallback[0];
      if (fb?.default_photo) {
        console.log(`FALLBACK  "${orig}" → common name "${name}" → iNat: ${fb.name}`);
        updates.push({ plant, newSciName: knownFix || orig, reason: 'fallback-to-common' });
      } else {
        console.log(`NO MATCH  "${orig}" (searched: "${searchQuery}")`);
        noMatch.push(orig);
      }
    } else {
      const inatName = best.name;
      const hasPhoto = !!best.default_photo;
      const changed = knownFix && knownFix !== orig;

      if (changed) {
        console.log(`FIX   "${orig}"\n       → "${knownFix}" (iNat: ${inatName}, photo: ${hasPhoto})`);
        updates.push({ plant, newSciName: knownFix, reason: 'spelling-fix' });
      } else {
        console.log(`OK    "${orig}" → iNat: ${inatName} (photo: ${hasPhoto})`);
        if (hasPhoto) {
          updates.push({ plant, newSciName: orig, reason: 'already-correct' });
        }
      }
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n─────────────────────────────────────────────');
  console.log(`Spelling fixes to apply: ${updates.filter(u => u.reason === 'spelling-fix').length}`);
  console.log(`Already correct (will get photo on next run): ${updates.filter(u => u.reason === 'already-correct').length}`);
  console.log(`Fallback to common name: ${updates.filter(u => u.reason === 'fallback-to-common').length}`);
  console.log(`No match found: ${noMatch.length}`);
  if (noMatch.length) console.log('  ' + noMatch.join('\n  '));

  // Apply spelling fixes
  const fixes = updates.filter(u => u.reason === 'spelling-fix');
  if (fixes.length > 0) {
    console.log('\nApplying spelling corrections to database...');
    for (const { plant, newSciName } of fixes) {
      await plant.update({ scientific_name: newSciName });
      console.log(`  ✓ "${plant.scientific_name}" → "${newSciName}"`);
    }
    console.log('Done.');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
