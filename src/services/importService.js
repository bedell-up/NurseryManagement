const XLSX = require('xlsx');
const { Plant, PlantVariant, Inventory, Pricing, sequelize } = require('../models');

// Column name aliases — map whatever headers appear in the spreadsheet to our fields
const COLUMN_MAP = {
  // Common name variations
  'common name': 'common_name',
  'common': 'common_name',
  'name': 'common_name',
  'plant name': 'common_name',
  // Scientific name
  'scientific name': 'scientific_name',
  'scientific': 'scientific_name',
  'latin name': 'scientific_name',
  'botanical name': 'scientific_name',
  // Taxonomy
  'genus': 'genus',
  'species': 'species',
  'cultivar': 'cultivar',
  'variety': 'cultivar',
  'family': 'family',
  // Classification
  'type': 'plant_type',
  'plant type': 'plant_type',
  'category': 'plant_type',
  'native region': 'native_region',
  'origin': 'native_region',
  'region': 'native_region',
  // Characteristics
  'sun': 'sun_requirements',
  'sun requirements': 'sun_requirements',
  'sun exposure': 'sun_requirements',
  'light': 'sun_requirements',
  'water': 'water_requirements',
  'water requirements': 'water_requirements',
  'moisture': 'water_requirements',
  'soil': 'soil_type',
  'soil type': 'soil_type',
  'bloom time': 'bloom_time',
  'bloom season': 'bloom_time',
  'bloom color': 'bloom_color',
  'flower color': 'bloom_color',
  'height min': 'mature_height_min_ft',
  'height max': 'mature_height_max_ft',
  'width min': 'mature_width_min_ft',
  'width max': 'mature_width_max_ft',
  'min height': 'mature_height_min_ft',
  'max height': 'mature_height_max_ft',
  'zone min': 'hardiness_zone_min',
  'zone max': 'hardiness_zone_max',
  'hardiness zone': 'hardiness_zone_min',
  'zone': 'hardiness_zone_min',
  // Wildlife
  'pollinators': 'attracts_pollinators',
  'attracts pollinators': 'attracts_pollinators',
  'birds': 'attracts_birds',
  'attracts birds': 'attracts_birds',
  'butterflies': 'attracts_butterflies',
  'deer resistant': 'deer_resistant',
  'deer': 'deer_resistant',
  // Info
  'description': 'description',
  'notes': 'notes',
  'landscape use': 'landscape_use',
  'uses': 'landscape_use',
  // Inventory / pricing (variant-level)
  'sku': 'sku',
  'size': 'container_size',
  'container size': 'container_size',
  'container': 'container_size',
  'pot size': 'container_size',
  'price': 'retail_price',
  'retail price': 'retail_price',
  'retail': 'retail_price',
  'sale price': 'sale_price',
  'wholesale price': 'wholesale_price',
  'wholesale': 'wholesale_price',
  'cost': 'cost',
  'quantity': 'quantity_on_hand',
  'qty': 'quantity_on_hand',
  'stock': 'quantity_on_hand',
  'on hand': 'quantity_on_hand',
  'location': 'location',
};

function normalizeKey(key) {
  return key.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    return ['yes', 'y', 'true', '1', 'x'].includes(val.toLowerCase().trim());
  }
  return false;
}

function parsePlantType(val) {
  if (!val) return null;
  const v = val.toString().toLowerCase().trim();
  const map = {
    tree: 'tree', trees: 'tree',
    shrub: 'shrub', shrubs: 'shrub', bush: 'shrub',
    perennial: 'perennial', perennials: 'perennial',
    annual: 'annual', annuals: 'annual',
    grass: 'grass', grasses: 'grass', sedge: 'grass',
    fern: 'fern', ferns: 'fern',
    vine: 'vine', vines: 'vine',
    groundcover: 'groundcover', 'ground cover': 'groundcover',
    bulb: 'bulb', bulbs: 'bulb',
    aquatic: 'aquatic',
  };
  return map[v] || 'other';
}

function parseSun(val) {
  if (!val) return null;
  const v = val.toString().toLowerCase().trim();
  if (v.includes('full sun') && v.includes('part')) return 'sun_to_part_shade';
  if (v.includes('full sun')) return 'full_sun';
  if (v.includes('full shade')) return 'full_shade';
  if (v.includes('part')) return 'part_shade';
  return null;
}

function parseWater(val) {
  if (!val) return null;
  const v = val.toString().toLowerCase().trim();
  if (v.includes('wet') && v.includes('medium')) return 'wet_to_medium';
  if (v.includes('dry') && v.includes('medium')) return 'dry_to_medium';
  if (v.includes('wet')) return 'wet';
  if (v.includes('dry')) return 'dry';
  if (v.includes('medium') || v.includes('average')) return 'medium';
  return null;
}

async function importFromFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const results = { imported: 0, updated: 0, errors: [] };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });

    if (!rows.length) continue;

    // Map headers
    const firstRow = rows[0];
    const headerMap = {};
    for (const key of Object.keys(firstRow)) {
      const normalized = normalizeKey(key);
      const mapped = COLUMN_MAP[normalized];
      if (mapped) headerMap[key] = mapped;
    }

    for (const [idx, rawRow] of rows.entries()) {
      try {
        const row = {};
        for (const [origKey, mappedKey] of Object.entries(headerMap)) {
          row[mappedKey] = rawRow[origKey];
        }

        if (!row.common_name) continue;

        // Plant-level fields
        const plantData = {
          common_name: row.common_name?.toString().trim(),
          scientific_name: row.scientific_name?.toString().trim() || null,
          genus: row.genus?.toString().trim() || null,
          species: row.species?.toString().trim() || null,
          cultivar: row.cultivar?.toString().trim() || null,
          family: row.family?.toString().trim() || null,
          plant_type: parsePlantType(row.plant_type),
          native_region: row.native_region?.toString().trim() || null,
          sun_requirements: parseSun(row.sun_requirements),
          water_requirements: parseWater(row.water_requirements),
          soil_type: row.soil_type?.toString().trim() || null,
          bloom_time: row.bloom_time?.toString().trim() || null,
          bloom_color: row.bloom_color?.toString().trim() || null,
          mature_height_min_ft: row.mature_height_min_ft ? parseFloat(row.mature_height_min_ft) : null,
          mature_height_max_ft: row.mature_height_max_ft ? parseFloat(row.mature_height_max_ft) : null,
          mature_width_min_ft: row.mature_width_min_ft ? parseFloat(row.mature_width_min_ft) : null,
          mature_width_max_ft: row.mature_width_max_ft ? parseFloat(row.mature_width_max_ft) : null,
          hardiness_zone_min: row.hardiness_zone_min?.toString().trim() || null,
          hardiness_zone_max: row.hardiness_zone_max?.toString().trim() || null,
          attracts_pollinators: parseBoolean(row.attracts_pollinators),
          attracts_birds: parseBoolean(row.attracts_birds),
          attracts_butterflies: parseBoolean(row.attracts_butterflies),
          deer_resistant: parseBoolean(row.deer_resistant),
          description: row.description?.toString().trim() || null,
          landscape_use: row.landscape_use?.toString().trim() || null,
          notes: row.notes?.toString().trim() || null,
        };

        // Upsert plant by common_name + scientific_name
        const [plant, created] = await Plant.upsert(plantData, {
          conflictFields: ['common_name'],
          returning: true,
        });

        if (created) results.imported++;
        else results.updated++;

        // Variant-level fields
        const containerSize = row.container_size?.toString().trim() || '1 gallon';
        const sku = row.sku?.toString().trim() || null;

        const [variant] = await PlantVariant.upsert(
          { plant_id: plant.id, container_size: containerSize, sku },
          { conflictFields: sku ? ['sku'] : ['plant_id', 'container_size'], returning: true }
        );

        // Inventory
        if (row.quantity_on_hand !== null && row.quantity_on_hand !== undefined) {
          await Inventory.upsert(
            {
              variant_id: variant.id,
              quantity_on_hand: parseInt(row.quantity_on_hand, 10) || 0,
              location: row.location?.toString().trim() || null,
            },
            { conflictFields: ['variant_id'] }
          );
        }

        // Pricing
        const hasPrice = row.retail_price !== null && row.retail_price !== undefined;
        if (hasPrice) {
          await Pricing.upsert(
            {
              variant_id: variant.id,
              retail_price: parseFloat(row.retail_price) || 0,
              sale_price: row.sale_price ? parseFloat(row.sale_price) : null,
              wholesale_price: row.wholesale_price ? parseFloat(row.wholesale_price) : null,
              cost: row.cost ? parseFloat(row.cost) : null,
            },
            { conflictFields: ['variant_id'] }
          );
        }
      } catch (err) {
        results.errors.push({ row: idx + 2, error: err.message });
      }
    }
  }

  // Rebuild full-text search vectors after import
  await sequelize.query(`
    UPDATE plants SET search_vector = to_tsvector('english',
      coalesce(common_name, '') || ' ' ||
      coalesce(scientific_name, '') || ' ' ||
      coalesce(genus, '') || ' ' ||
      coalesce(native_region, '') || ' ' ||
      coalesce(bloom_color, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(landscape_use, '') || ' ' ||
      coalesce(notes, '')
    )
  `);

  return results;
}

module.exports = { importFromFile };
