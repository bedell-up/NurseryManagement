const USDA_SEARCH  = 'https://plantsservices.sc.egov.usda.gov/api/PlantSearch';
const USDA_PROFILE = 'https://plantsservices.sc.egov.usda.gov/api/PlantProfile';
const USDA_PAGE    = 'https://plants.usda.gov/home/plantProfile?symbol=';
const GBIF_MATCH   = 'https://api.gbif.org/v1/species/match';
const GBIF_SPECIES = 'https://www.gbif.org/species/';

function stripHtml(s) {
  return s ? s.replace(/<[^>]+>/g, '').trim() : null;
}

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

async function fetchUsda(q) {
  const url = `${USDA_SEARCH}?searchText=${encodeURIComponent(q)}&limit=5`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
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

  // Fetch profile for GrowthHabits, Durations, NativeStatuses, Ancestors (family)
  const profileResp = await fetch(`${USDA_PROFILE}?symbol=${symbol}`, { headers: { Accept: 'application/json' } });
  const profile = profileResp.ok ? await profileResp.json() : plant;

  const familyAncestor = (profile.Ancestors || []).find(a => a.Rank === 'Family');
  const isNativeL48 = (profile.NativeStatuses || []).some(n => n.Region === 'L48' && n.Status === 'N');

  return {
    symbol,
    usda_profile_url: `${USDA_PAGE}${symbol}`,
    family: familyAncestor ? stripHtml(familyAncestor.ScientificName) : null,
    plant_type: mapGrowthHabit(profile.GrowthHabits || plant.GrowthHabits),
    native_region: isNativeL48 ? 'Pacific Northwest' : null,
  };
}

async function fetchGbif(q) {
  const url = `${GBIF_MATCH}?name=${encodeURIComponent(q)}&rank=SPECIES&kingdom=Plantae`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) return null;

  const data = await resp.json();
  // matchType NONE means no match found
  if (!data.usageKey || data.matchType === 'NONE') return null;

  const species = data.canonicalName || data.species || null;
  const nameParts = (species || '').split(' ');

  return {
    gbif_url:       `${GBIF_SPECIES}${data.usageKey}`,
    common_name:    null,                       // GBIF match doesn't include common name
    scientific_name: species,
    genus:          data.genus  || nameParts[0] || null,
    species_epithet: nameParts[1]               || null,
    family:         data.family                 || null,
    confidence:     data.confidence,
  };
}

// GET /plants/usda-lookup?q=Alnus+rubra
async function lookup(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    // Call USDA and GBIF in parallel
    const [usda, gbif] = await Promise.allSettled([fetchUsda(q), fetchGbif(q)]);
    const usdaData = usda.status === 'fulfilled' ? usda.value : null;
    const gbifData = gbif.status === 'fulfilled' ? gbif.value : null;

    if (!usdaData && !gbifData) return res.json({ found: false });

    // Merge: GBIF is preferred for taxonomy; USDA for plant_type, native_region, usda_profile_url
    const data = {
      scientific_name:  gbifData?.scientific_name  || null,
      genus:            gbifData?.genus            || null,
      species:          gbifData?.species_epithet  || null,
      family:           gbifData?.family           || usdaData?.family || null,
      plant_type:       usdaData?.plant_type       || null,
      native_region:    usdaData?.native_region    || null,
      usda_profile_url: usdaData?.usda_profile_url || null,
      gbif_url:         gbifData?.gbif_url         || null,
    };

    // Strip nulls so the form only merges what we actually found
    Object.keys(data).forEach(k => data[k] == null && delete data[k]);

    res.json({
      found: true,
      usda_symbol:     usdaData?.symbol      || null,
      gbif_confidence: gbifData?.confidence  || null,
      data,
    });
  } catch (err) {
    console.error('Plant lookup error:', err.message);
    res.status(502).json({ error: 'Lookup failed', detail: err.message });
  }
}

module.exports = { lookup };
