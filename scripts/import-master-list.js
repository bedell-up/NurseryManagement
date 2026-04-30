require('dotenv').config();
const XLSX = require('xlsx');
const path = require('path');
const { Plant, PlantVariant, Inventory, Pricing, sequelize } = require('../src/models');

// Map sheet name -> plant_type enum
const SHEET_TYPE_MAP = {
  'Aquatic Species':                    'aquatic',
  'Annuals':                            'annual',
  'Grasses  Gramanoides':               'grass',
  'Perennial Forbs':                    'perennial',
  'Ferns':                              'fern',
  'Succulent':                          'other',        // succulents/cacti
  'Vines':                              'vine',
  'Shrubs':                             'shrub',
  'Trees':                              'tree',
  'Generic Native Woodland Underst':    'perennial',
  'Generic Meadow List':                'perennial',
  'Seed Mix Species List':              'perennial',
  'NATIVE POLLINATOR SEED MIX':         'perennial',
  'Rain Garden':                        'perennial',
  'Seeded Annuals':                     'annual',
  'Food Forest Underttsory  Perren':    'perennial',
  'Culinary Herbs':                     'perennial',
};

// Landscape use code legend
const LANDSCAPE_CODES = {
  RG:  'Rain Garden',
  MS:  'Mixed Shrub Border',
  FF:  'Food Forest',
  WG:  'Woodland Garden',
  CO:  'Cottage Garden',
  XS:  'Xeriscape',
  A:   'Aquatic',
  WF:  'Wildflower Meadow',
  PV:  'Potager/Vegetable Garden',
  WD:  'Wildlife Diversity',
  WV:  'Willamette Valley Native',
};

function expandLandscapeCodes(raw) {
  if (!raw) return null;
  return raw.split(/[,/]+/).map(c => LANDSCAPE_CODES[c.trim()] || c.trim()).filter(Boolean).join(', ');
}

function parseSpecies(raw) {
  if (!raw) return { scientific_name: null, common_name: null, genus: null, species: null };
  const str = raw.toString().trim();

  // Format: "Genus species - Common Name" or "Genus species var. foo - Common Name"
  const dashIdx = str.indexOf(' - ');
  let sciPart = dashIdx >= 0 ? str.slice(0, dashIdx).trim() : str;
  let commonName = dashIdx >= 0 ? str.slice(dashIdx + 3).trim() : str;

  // Clean parenthetical synonyms in common name
  commonName = commonName.replace(/\s*\(.*?\)\s*/g, '').trim();

  const parts = sciPart.split(/\s+/);
  const genus = parts[0] || null;
  const species = parts[1] && !parts[1].match(/^(var\.|ssp\.|subsp\.|x)$/i) ? parts[1] : null;

  // Use common name as fallback if sci name looks bad
  const scientific_name = sciPart.length > 2 ? sciPart : null;
  const common_name = commonName || sciPart;

  return { scientific_name, common_name, genus, species };
}

function parseSun(val) {
  if (!val) return null;
  const v = val.toString().toLowerCase();
  if (v.includes('sun') && v.includes('shade')) return 'sun_to_part_shade';
  if (v.includes('full sun')) return 'full_sun';
  if (v.includes('full shade') || v === 'shade') return 'full_shade';
  if (v.includes('pt shade') || v.includes('part shade') || v.includes('partial')) return 'part_shade';
  if (v.includes('sun')) return 'full_sun';
  return null;
}

function parseMoisture(val) {
  if (!val) return null;
  const v = val.toString().toLowerCase();
  if (v.includes('wet') && v.includes('moist')) return 'wet_to_medium';
  if (v.includes('dry') && (v.includes('moist') || v.includes('medium'))) return 'dry_to_medium';
  if (v.includes('wet')) return 'wet';
  if (v.includes('dry')) return 'dry';
  if (v.includes('moist') || v.includes('medium') || v.includes('average')) return 'medium';
  return null;
}

function parseSize(val) {
  // e.g. "3' x 3'" or "100' x 35'" or "1' x 1\""
  if (!val) return {};
  const str = val.toString();
  const parts = str.split(/\s*[xX]\s*/);
  const toFt = (s) => {
    if (!s) return null;
    s = s.trim().replace(/['"]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };
  return {
    height: toFt(parts[0]),
    width: toFt(parts[1]),
  };
}

function parseBool(val) {
  if (!val || val === '-' || val === 'FALSE' || val === 'false') return false;
  if (val === 'TRUE' || val === 'true') return true;
  if (typeof val === 'string') return ['x', 'yes', 'y', '1', 'true'].includes(val.trim().toLowerCase());
  return Boolean(val);
}

function isPnwNative(val) {
  if (!val) return false;
  const v = val.toString().trim();
  // "WV" = Willamette Valley (PNW native), "x" = PNW native, "TRUE" = yes
  return ['x', 'wv', 'true', 'yes', 'y', '1'].includes(v.toLowerCase());
}

// Normalize column header
function normHeader(h) {
  return h ? h.toString().toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '') : '';
}

async function importSheet(wb, sheetName, plantType, stats) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return;

  // Read all rows as arrays to handle header row detection
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

  // Find the header row (contains "Species" or "species")
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(5, allRows.length); i++) {
    const row = allRows[i];
    if (row && row.some(cell => cell && cell.toString().toLowerCase().includes('species'))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) {
    console.log(`  [SKIP] ${sheetName}: could not find header row`);
    return;
  }

  const headers = allRows[headerRowIdx].map(normHeader);
  const dataRows = allRows.slice(headerRowIdx + 1);

  // Build column index map
  const col = (name) => headers.findIndex(h => h === name || h.includes(name));
  const idx = {
    qty:        col('qty'),
    code:       col('code'),
    species:    col('species'),
    portland:   col('portland plant list'),
    size:       col('size'),
    light:      col('light requirements'),
    moisture:   col('moisture') >= 0 ? col('moisture') : col('water depth required'),
    edible:     col('edible'),
    medicinal:  col('medicinal'),
    flowering:  col('flowering time'),
    ecological: col('ecological garden function'),
    pnw:        col('pnw native'),
    landscape:  col('landscape use'),
    parts:      col('usable parts') >= 0 ? col('usable parts') : col('edible parts'),
    species_sup:col('species supported'),
    companion:  col('companion plants'),
    fire:       col('fire resistant'),
    pet:        col('pet friendly'),
    bouquet:    col('bouquet use'),
    moreinfo:   col('more info'),
    usda:       col('usda profile'),
  };

  let rowCount = 0;
  for (const row of dataRows) {
    if (!row || row.every(c => !c)) continue;

    const rawSpecies = idx.species >= 0 ? row[idx.species] : null;
    if (!rawSpecies || rawSpecies.toString().trim() === '') continue;

    // Skip header-like rows that snuck in
    if (rawSpecies.toString().toLowerCase().includes('species')) continue;

    const { scientific_name, common_name, genus, species } = parseSpecies(rawSpecies);
    if (!common_name) continue;

    const sizeData = parseSize(idx.size >= 0 ? row[idx.size] : null);
    const lightRaw = idx.light >= 0 ? row[idx.light] : null;
    const moistureRaw = idx.moisture >= 0 ? row[idx.moisture] : null;
    const pnwNative = idx.pnw >= 0 ? isPnwNative(row[idx.pnw]) : false;
    const landscapeRaw = idx.landscape >= 0 ? row[idx.landscape] : null;
    const ecologicalRaw = idx.ecological >= 0 ? row[idx.ecological] : null;
    const floweringRaw = idx.flowering >= 0 ? row[idx.flowering] : null;
    const plantCodeRaw = idx.code >= 0 ? row[idx.code] : null;
    const edibleRaw = idx.edible >= 0 ? row[idx.edible] : null;
    const medicinalRaw = idx.medicinal >= 0 ? row[idx.medicinal] : null;
    const fireRaw = idx.fire >= 0 ? row[idx.fire] : null;
    const bouquetRaw = idx.bouquet >= 0 ? row[idx.bouquet] : null;
    const moreinfoRaw = idx.moreinfo >= 0 ? row[idx.moreinfo] : null;
    const usdaRaw = idx.usda >= 0 ? row[idx.usda] : null;
    const portlandRaw = idx.portland >= 0 ? row[idx.portland] : null;
    const petRaw = idx.pet >= 0 ? row[idx.pet] : null;
    const speciesSup = idx.species_sup >= 0 ? row[idx.species_sup] : null;
    const companion = idx.companion >= 0 ? row[idx.companion] : null;
    const usableParts = idx.parts >= 0 ? row[idx.parts] : null;

    // Parse new dedicated fields
    const is_edible = parseBool(edibleRaw);
    const is_medicinal = parseBool(medicinalRaw);
    const is_fire_resistant = fireRaw ? fireRaw.toString().includes('🔥') || parseBool(fireRaw) : false;

    // Pet friendly: "x" = yes, "-" = no, null/blank = unknown
    let is_pet_friendly = null;
    if (petRaw !== null && petRaw !== undefined && petRaw !== '') {
      const p = petRaw.toString().trim().toLowerCase();
      if (p === '-') is_pet_friendly = false;
      else if (['x', 'yes', 'y', 'true', '1'].includes(p)) is_pet_friendly = true;
    }

    // Bouquet use — store as-is if meaningful
    const bouquet_use = (bouquetRaw && bouquetRaw !== '-') ? bouquetRaw.toString().trim() : null;

    // URLs
    const more_info_url = (moreinfoRaw && moreinfoRaw.toString().startsWith('http')) ? moreinfoRaw.toString().trim() : null;
    const usda_profile_url = (usdaRaw && usdaRaw.toString().startsWith('http')) ? usdaRaw.toString().trim() : null;

    // Portland Plant List
    let portland_plant_list = null;
    if (portlandRaw !== null && portlandRaw !== undefined && portlandRaw !== '') {
      const p = portlandRaw.toString().trim().toUpperCase();
      if (p === 'TRUE') portland_plant_list = true;
      else if (p === 'FALSE') portland_plant_list = false;
    }

    // Plant code (2-letter nursery code)
    const plant_code = (plantCodeRaw && plantCodeRaw.toString().trim() !== '') ? plantCodeRaw.toString().trim() : null;

    // Build ecological notes (companion info, species supported, usable parts)
    const notesParts = [];
    if (ecologicalRaw && ecologicalRaw !== '-') notesParts.push(`Ecological function: ${ecologicalRaw}`);
    if (speciesSup && speciesSup !== '-') notesParts.push(`Species supported: ${speciesSup}`);
    if (companion && companion !== '-') notesParts.push(`Companion plants: ${companion}`);
    if (usableParts && usableParts !== '-') notesParts.push(`Usable parts: ${usableParts}`);

    // Detect wildlife attributes from ecological description
    const ecoLower = (ecologicalRaw || '').toLowerCase();
    const attracts_pollinators = ecoLower.includes('pollinator') || ecoLower.includes('bee') || ecoLower.includes('insectary') || ecoLower.includes('attract');
    const attracts_birds = ecoLower.includes('bird') || ecoLower.includes('wildlife');
    const attracts_butterflies = ecoLower.includes('butterfly') || ecoLower.includes('lepidoptera');
    const deer_resistant = false;

    const plantData = {
      common_name,
      scientific_name,
      genus,
      species,
      plant_type: plantType,
      native_region: pnwNative ? 'Pacific Northwest' : null,
      sun_requirements: parseSun(lightRaw),
      water_requirements: parseMoisture(moistureRaw),
      bloom_time: floweringRaw && floweringRaw !== '-' ? floweringRaw.toString().trim() : null,
      mature_height_min_ft: sizeData.height,
      mature_height_max_ft: sizeData.height,
      mature_width_min_ft: sizeData.width,
      mature_width_max_ft: sizeData.width,
      attracts_pollinators,
      attracts_birds,
      attracts_butterflies,
      deer_resistant,
      landscape_use: expandLandscapeCodes(landscapeRaw),
      notes: notesParts.length ? notesParts.join('\n') : null,
      // New fields
      plant_code,
      is_edible,
      is_medicinal,
      is_pet_friendly,
      is_fire_resistant,
      bouquet_use,
      more_info_url,
      usda_profile_url,
      portland_plant_list,
      is_active: true,
      is_featured: false,
    };

    try {
      const [plant, created] = await Plant.findOrCreate({
        where: { common_name },
        defaults: plantData,
      });

      if (!created) {
        await plant.update(plantData);
        stats.updated++;
      } else {
        stats.imported++;
      }

      // Create a default variant (no container size yet — can be updated later)
      await PlantVariant.findOrCreate({
        where: { plant_id: plant.id, container_size: 'TBD' },
        defaults: { plant_id: plant.id, container_size: 'TBD', is_active: true },
      });

      rowCount++;
    } catch (err) {
      stats.errors.push({ sheet: sheetName, name: common_name, error: err.message });
    }
  }

  console.log(`  [OK] ${sheetName}: ${rowCount} plants processed`);
}

async function run() {
  const filePath = path.resolve(__dirname, '../uploads/spreadsheets/master_plant_list.xlsx');
  console.log('Connecting to database...');
  await sequelize.authenticate();
  await sequelize.sync({ alter: false });

  console.log(`\nReading: ${filePath}`);
  const wb = XLSX.readFile(filePath);

  const stats = { imported: 0, updated: 0, errors: [] };

  // Import each plant sheet (skip Legend and reference-only sheets)
  const plantSheets = [
    'Aquatic Species',
    'Annuals',
    'Grasses  Gramanoides',
    'Perennial Forbs',
    'Ferns',
    'Succulent',
    'Vines',
    'Shrubs',
    'Trees',
    'NATIVE POLLINATOR SEED MIX',
    'Food Forest Underttsory  Perren',
    'Culinary Herbs',
  ];

  console.log('\nImporting sheets...');
  for (const sheetName of plantSheets) {
    const plantType = SHEET_TYPE_MAP[sheetName] || 'other';
    await importSheet(wb, sheetName, plantType, stats);
  }

  // Rebuild full-text search vectors
  console.log('\nRebuilding full-text search index...');
  await sequelize.query(`
    UPDATE plants SET search_vector = to_tsvector('english',
      coalesce(common_name, '') || ' ' ||
      coalesce(scientific_name, '') || ' ' ||
      coalesce(genus, '') || ' ' ||
      coalesce(native_region, '') || ' ' ||
      coalesce(bloom_time, '') || ' ' ||
      coalesce(landscape_use, '') || ' ' ||
      coalesce(notes, '')
    )
  `);

  console.log('\n=== Import Complete ===');
  console.log(`  Imported (new): ${stats.imported}`);
  console.log(`  Updated:        ${stats.updated}`);
  console.log(`  Errors:         ${stats.errors.length}`);
  if (stats.errors.length) {
    console.log('\nErrors:');
    stats.errors.slice(0, 20).forEach(e => console.log(`  [${e.sheet}] ${e.name}: ${e.error}`));
  }

  await sequelize.close();
}

run().catch(err => { console.error(err); process.exit(1); });
