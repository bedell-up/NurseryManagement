/**
 * One-time backfill: runs every plant with a scientific_name through USDA +
 * GBIF + PNW natives table and fills in empty fields.
 *
 * Rules:
 *   - Never overwrites a field that already has a value
 *   - Exception: URLs are always refreshed (they're system-generated)
 *   - PNW natives table takes priority for growing conditions over USDA API
 *   - Oregon Flora URL only generated for PNW native matches
 *   - 400ms delay between plants to be polite to external APIs
 */

require('dotenv').config();
const { Plant, PnwNative } = require('../src/models');
const { Op } = require('sequelize');

// ── API constants ────────────────────────────────────────────────────────────

const USDA_SEARCH  = 'https://plantsservices.sc.egov.usda.gov/api/PlantSearch';
const USDA_PROFILE = 'https://plantsservices.sc.egov.usda.gov/api/PlantProfile';
const USDA_PAGE    = 'https://plants.usda.gov/home/plantProfile?symbol=';
const GBIF_MATCH   = 'https://api.gbif.org/v1/species/match';
const GBIF_SPECIES = 'https://www.gbif.org/species/';

// ── Mapping helpers ──────────────────────────────────────────────────────────

function stripHtml(s) {
  return s ? s.replace(/<[^>]+>/g, '').trim() : null;
}

// PNW natives "sun" string → our sun_requirements enum
function mapSun(s) {
  if (!s) return null;
  const v = s.toLowerCase();
  if (v === 'full sun')                    return 'full_sun';
  if (v === 'full shade')                  return 'full_shade';
  if (v.includes('full sun') && v.includes('part shade')) return 'sun_to_part_shade';
  if (v.includes('part shade') && v.includes('full sun')) return 'sun_to_part_shade';
  if (v.includes('part shade') && v.includes('full shade')) return 'partial_shade_to_shade';
  if (v.includes('full shade') && v.includes('part shade')) return 'partial_shade_to_shade';
  if (v === 'part shade')                  return 'part_shade';
  if (v.includes('part shade'))            return 'part_shade';
  return null;
}

// PNW natives "moisture" string → our water_requirements enum
function mapMoisture(s) {
  if (!s) return null;
  const v = s.toLowerCase().replace(/\s/g, '');
  if (v === 'wet')                   return 'wet';
  if (v === 'dry')                   return 'dry';
  if (v === 'moist')                 return 'medium';
  if (v.includes('wet') && v.includes('moist'))  return 'wet_to_medium';
  if (v.includes('moist') && v.includes('wet'))  return 'wet_to_medium';
  if (v.includes('dry') && v.includes('moist'))  return 'dry_to_medium';
  if (v.includes('moist') && v.includes('dry'))  return 'dry_to_medium';
  return null;
}

// USDA ShadeTolerance → sun enum
function mapShade(v) {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes('intolerant'))   return 'full_sun';
  if (s.includes('intermediate')) return 'sun_to_part_shade';
  if (s.includes('tolerant'))     return 'full_shade';
  return null;
}

// USDA MoistureUse → water enum
function mapMoistureUsda(v) {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes('low'))  return 'dry';
  if (s.includes('high')) return 'wet';
  return 'medium';
}

// PNW natives "height" string → {min, max} in feet (null if unparseable)
function parseHeight(s) {
  if (!s) return { min: null, max: null };

  const inchToFt = (n) => Math.round((n / 12) * 100) / 100;

  // Strip common prefixes
  const clean = s
    .replace(/^(shrub|groundcover|mat|trailing|vine|to)\s*/i, '')
    .trim();

  // "To X ft"
  const toMatch = s.match(/^to\s+([\d.]+)\s*ft/i);
  if (toMatch) return { min: null, max: parseFloat(toMatch[1]) };

  // "X–Y in" or "X-Y in"
  const inRange = clean.match(/([\d.]+)\s*[–-]\s*([\d.]+)\s*in/i);
  if (inRange) return { min: inchToFt(parseFloat(inRange[1])), max: inchToFt(parseFloat(inRange[2])) };

  // "X in"
  const inSingle = clean.match(/([\d.]+)\s*in/i);
  if (inSingle) return { min: null, max: inchToFt(parseFloat(inSingle[1])) };

  // "X–Y ft"
  const ftRange = clean.match(/([\d.]+)\s*[–-]\s*([\d.]+)\s*ft/i);
  if (ftRange) return { min: parseFloat(ftRange[1]), max: parseFloat(ftRange[2]) };

  // "X ft"
  const ftSingle = clean.match(/([\d.]+)\s*ft/i);
  if (ftSingle) return { min: null, max: parseFloat(ftSingle[1]) };

  return { min: null, max: null };
}

// PNW natives category → plant_type
function mapCategory(c) {
  if (!c) return null;
  const v = c.toLowerCase();
  if (v.includes('conifer'))         return 'conifer';
  if (v.includes('broadleaved'))     return 'tree';
  if (v.includes('shrub'))           return 'shrub';
  if (v === 'vine' || v === 'vine/shrub') return 'vine';
  if (v === 'fern')                  return 'fern';
  if (v === 'wildflower')            return 'perennial';
  if (v === 'grass')                 return 'grass';
  if (v === 'sedge' || v === 'rush') return 'grass';
  return null;
}

// USDA GrowthHabits → plant_type
function mapGrowthHabit(habits = []) {
  const h = (habits[0] || '').toLowerCase();
  if (h.includes('tree'))                       return 'tree';
  if (h.includes('shrub') || h.includes('sub')) return 'shrub';
  if (h.includes('vine'))                       return 'vine';
  if (h.includes('forb') || h.includes('herb')) return 'perennial';
  if (h.includes('grass') || h.includes('graminoid')) return 'grass';
  if (h.includes('fern'))                       return 'fern';
  return null;
}

// ── API calls ────────────────────────────────────────────────────────────────

async function fetchUsda(q) {
  try {
    const resp = await fetch(
      `${USDA_SEARCH}?searchText=${encodeURIComponent(q)}&limit=5`,
      { headers: { Accept: 'application/json' } }
    );
    if (!resp.ok) return null;
    const results = await resp.json();
    if (!Array.isArray(results) || !results.length) return null;

    const cleanQ = q.toLowerCase();
    const hit = results.find(r => {
      const sci = stripHtml(r.Plant?.ScientificName || '').toLowerCase();
      return sci.startsWith(cleanQ) && r.Plant?.Rank === 'Species';
    }) || results.find(r => r.Plant?.Rank === 'Species') || results[0];

    const plant = hit?.Plant;
    if (!plant) return null;
    const symbol = plant.AcceptedSymbol || plant.Symbol;

    const profileResp = await fetch(
      `${USDA_PROFILE}?symbol=${symbol}`,
      { headers: { Accept: 'application/json' } }
    );
    const profile = profileResp.ok ? await profileResp.json() : plant;

    const familyAncestor = (profile.Ancestors || []).find(a => a.Rank === 'Family');
    const c = profile.Characteristics ?? {};

    return {
      symbol,
      usda_profile_url: `${USDA_PAGE}${symbol}`,
      family:           familyAncestor ? stripHtml(familyAncestor.ScientificName) : null,
      plant_type:       mapGrowthHabit(profile.GrowthHabits || plant.GrowthHabits),
      sun_requirements: mapShade(c.ShadeTolerance),
      water_requirements: mapMoistureUsda(c.MoistureUse),
    };
  } catch { return null; }
}

async function fetchGbif(q) {
  try {
    const resp = await fetch(
      `${GBIF_MATCH}?name=${encodeURIComponent(q)}&rank=SPECIES&kingdom=Plantae`,
      { headers: { Accept: 'application/json' } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.usageKey || data.matchType === 'NONE') return null;

    const canonical = data.canonicalName || data.species || null;
    const parts = (canonical || '').split(' ');

    return {
      gbif_url:        `${GBIF_SPECIES}${data.usageKey}`,
      scientific_name: canonical,
      genus:           data.genus  || parts[0] || null,
      species_epithet: parts[1]               || null,
      family:          data.family            || null,
      confidence:      data.confidence,
    };
  } catch { return null; }
}

async function checkPnwNative(sciName) {
  try {
    const genusSpecies = sciName.split(' ').slice(0, 2).join(' ');
    return await PnwNative.findOne({
      where: {
        scientific_name: {
          [Op.or]: [sciName, { [Op.like]: `${genusSpecies}%` }],
        },
      },
    });
  } catch { return null; }
}

// ── Field merge helper ───────────────────────────────────────────────────────

// Returns value only if the plant field is currently blank
function ifBlank(currentVal, newVal) {
  if (newVal == null || newVal === '') return undefined;
  if (currentVal != null && currentVal !== '') return undefined;
  return newVal;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const plants = await Plant.findAll({
    where: { scientific_name: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
    order: [['scientific_name', 'ASC']],
  });

  const total = plants.length;
  console.log(`\nBackfilling ${total} plants...\n`);

  let updated = 0, unchanged = 0, failed = 0;

  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i];
    const sci = plant.scientific_name.trim();
    process.stdout.write(`[${String(i + 1).padStart(3)}/${total}] ${sci.padEnd(45)}`);

    try {
      // Run all three lookups in parallel
      const [usdaResult, gbifResult, pnwResult] = await Promise.allSettled([
        fetchUsda(sci),
        fetchGbif(sci),
        checkPnwNative(sci),
      ]);
      const usda = usdaResult.status === 'fulfilled' ? usdaResult.value : null;
      const gbif = gbifResult.status === 'fulfilled' ? gbifResult.value : null;
      const pnw  = pnwResult.status  === 'fulfilled' ? pnwResult.value  : null;

      const canonical = gbif?.scientific_name || sci;
      const updates = {};

      // ── Taxonomy (prefer GBIF) ─────────────────────────────────────────
      const v = ifBlank(plant.genus,   gbif?.genus);           if (v !== undefined) updates.genus = v;
      const s = ifBlank(plant.species, gbif?.species_epithet); if (s !== undefined) updates.species = s;
      const f = ifBlank(plant.family,  gbif?.family || usda?.family);
      if (f !== undefined) updates.family = f;

      // ── URLs — always refresh ──────────────────────────────────────────
      if (usda?.usda_profile_url) updates.usda_profile_url = usda.usda_profile_url;
      if (gbif?.gbif_url)         updates.gbif_url         = gbif.gbif_url;

      // ── PNW native path ────────────────────────────────────────────────
      if (pnw) {
        // Always set native region and Oregon Flora URL for confirmed natives
        updates.native_region    = 'Pacific Northwest';
        updates.oregon_flora_url = `https://oregonflora.org/taxa/index.php?taxon=${encodeURIComponent(canonical)}`;

        // Growing conditions from PNW natives table (only fill blanks)
        const sun  = ifBlank(plant.sun_requirements,   mapSun(pnw.sun));
        const moist = ifBlank(plant.water_requirements, mapMoisture(pnw.moisture));
        if (sun   !== undefined) updates.sun_requirements   = sun;
        if (moist !== undefined) updates.water_requirements = moist;

        const { min, max } = parseHeight(pnw.height);
        const hMin = ifBlank(plant.mature_height_min_ft, min);
        const hMax = ifBlank(plant.mature_height_max_ft, max);
        if (hMin !== undefined) updates.mature_height_min_ft = hMin;
        if (hMax !== undefined) updates.mature_height_max_ft = hMax;

        // Plant type: prefer PNW category; fall back to USDA
        const pt = ifBlank(plant.plant_type, mapCategory(pnw.category) || usda?.plant_type);
        if (pt !== undefined) updates.plant_type = pt;

        // Family from PNW table (often cleaner than USDA)
        if (!updates.family && pnw.family) {
          const fp = ifBlank(plant.family, pnw.family);
          if (fp !== undefined) updates.family = fp;
        }
      } else {
        // ── Non-PNW path ─────────────────────────────────────────────────
        // Plant type from USDA
        const pt = ifBlank(plant.plant_type, usda?.plant_type);
        if (pt !== undefined) updates.plant_type = pt;

        // Growing conditions from USDA characteristics (often null, but try)
        const sun   = ifBlank(plant.sun_requirements,   usda?.sun_requirements);
        const moist = ifBlank(plant.water_requirements, usda?.water_requirements);
        if (sun   !== undefined) updates.sun_requirements   = sun;
        if (moist !== undefined) updates.water_requirements = moist;
      }

      if (Object.keys(updates).length > 0) {
        await plant.update(updates);
        updated++;
        const keys = Object.keys(updates).join(', ');
        console.log(`✓ ${pnw ? '🌿 PNW' : '   '} [${keys}]`);
      } else {
        unchanged++;
        console.log(`— no changes${pnw ? ' 🌿 PNW (already complete)' : ''}`);
      }
    } catch (err) {
      failed++;
      console.log(`✗ ERROR: ${err.message}`);
    }

    // Polite delay between plants
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`
────────────────────────────────────
  Updated:   ${updated}
  Unchanged: ${unchanged}
  Failed:    ${failed}
  Total:     ${total}
────────────────────────────────────`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
