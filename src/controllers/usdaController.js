const SEARCH_BASE  = 'https://plantsservices.sc.egov.usda.gov/api/PlantSearch';
const PROFILE_BASE = 'https://plantsservices.sc.egov.usda.gov/api/PlantProfile';
const PROFILE_PAGE = 'https://plants.usda.gov/home/plantProfile?symbol=';

// Map USDA MoistureUse → our water_requirements enum
function mapMoisture(v) {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes('low'))  return 'dry';
  if (s.includes('high')) return 'wet';
  return 'medium';
}

// Map USDA ShadeTolerance → our sun_requirements enum
function mapShade(v) {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes('intolerant'))    return 'full_sun';
  if (s.includes('intermediate'))  return 'sun_to_part_shade';
  if (s.includes('tolerant'))      return 'full_shade';
  return null;
}

// Parse a zone string like "4" or "4 to 8" into min/max
function parseZones(min, max) {
  if (!min && !max) return { hardiness_zone_min: null, hardiness_zone_max: null };
  return {
    hardiness_zone_min: min ? String(min) : null,
    hardiness_zone_max: max ? String(max) : null,
  };
}

// GET /plants/usda-lookup?q=Alnus+rubra
async function lookup(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    // 1 — search for the plant to get its symbol
    const filter   = JSON.stringify({ sciname: [q] });
    const searchUrl = `${SEARCH_BASE}?offset=0&limit=1&filter=${encodeURIComponent(filter)}`;
    const searchResp = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
    if (!searchResp.ok) return res.json({ found: false });

    const searchData = await searchResp.json();
    const hit = searchData?.PlantList?.[0];
    if (!hit) return res.json({ found: false });

    const symbol = hit.AcceptedSymbol || hit.Symbol;

    // 2 — fetch the full profile
    const profileResp = await fetch(`${PROFILE_BASE}?symbol=${symbol}`, { headers: { Accept: 'application/json' } });
    const raw = profileResp.ok ? await profileResp.json() : {};

    const c = raw.Characteristics ?? {};       // main characteristics block
    const g = raw.GrowthRequirements ?? {};    // sometimes data lives here instead

    // Bloom period
    const bloomPeriod = c.BloomPeriod || g.BloomPeriod || null;

    // Height — USDA gives strings like "40" (feet)
    const htMinFt = parseFloat(c.HeightMatureMinimumFt || g.HeightMatureMinimumFt) || null;
    const htMaxFt = parseFloat(c.HeightMatureMaximumFt || g.HeightMatureMaximumFt) || null;

    // Hardiness zones
    const { hardiness_zone_min, hardiness_zone_max } = parseZones(
      c.HardinessZones || c.HardinessZoneMin || g.HardinessZones || g.HardinessZoneMin,
      c.HardinessZoneMax || g.HardinessZoneMax,
    );

    // Wildlife
    const pollinatorValue = (c.PollinatorValue || '').toLowerCase();
    const attracts_pollinators = pollinatorValue && pollinatorValue !== 'none' && pollinatorValue !== 'low' ? true : undefined;

    // Deer resistance — USDA uses "Low", "Medium", "High" for DeerResistance
    const deerResist = (c.DeerResistance || '').toLowerCase();
    const deer_resistant = deerResist === 'high' ? true : deerResist === 'low' ? false : undefined;

    // Fire resistance
    const fireRes = (c.FireResistance || '').toLowerCase();
    const is_fire_resistant = fireRes === 'yes' || fireRes === 'true' ? true : undefined;

    // Scientific name from USDA (may include author — strip it for form)
    const sciName = (hit.SciName || q).replace(/\s+[A-Z][a-z]+\.?$/, '').trim();

    // Split genus / species from scientific name
    const parts   = sciName.split(' ');
    const genus   = parts[0] || null;
    const species = parts[1] || null;

    // Oregon Flora URL (no public API — construct search URL)
    const oregonFloraQ  = encodeURIComponent(sciName);
    const oregon_flora_url = `https://oregonflora.org/taxa/index.php?taxon=${oregonFloraQ}`;
    const usda_profile_url = `${PROFILE_PAGE}${symbol}`;

    const data = {
      common_name:        hit.CommonName    || null,
      scientific_name:    sciName,
      genus,
      species,
      family:             hit.Family        || c.Family        || null,
      sun_requirements:   mapShade(c.ShadeTolerance || g.ShadeTolerance),
      water_requirements: mapMoisture(c.MoistureUse  || g.MoistureUse),
      bloom_time:         bloomPeriod,
      bloom_color:        c.FlowerColor     || g.FlowerColor   || null,
      mature_height_min_ft: htMinFt,
      mature_height_max_ft: htMaxFt,
      hardiness_zone_min,
      hardiness_zone_max,
      attracts_pollinators,
      deer_resistant,
      is_fire_resistant,
      usda_profile_url,
      oregon_flora_url,
    };

    // Strip undefined keys so the form only merges what we actually found
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    res.json({ found: true, symbol, data });
  } catch (err) {
    console.error('USDA lookup error:', err.message);
    res.status(502).json({ error: 'USDA lookup failed', detail: err.message });
  }
}

module.exports = { lookup };
