const SEARCH_BASE  = 'https://plantsservices.sc.egov.usda.gov/api/PlantSearch';
const PROFILE_BASE = 'https://plantsservices.sc.egov.usda.gov/api/PlantProfile';
const PROFILE_PAGE = 'https://plants.usda.gov/home/plantProfile?symbol=';

function stripHtml(s) {
  return s ? s.replace(/<[^>]+>/g, '').trim() : null;
}

// Map USDA GrowthHabits array → our plant_type string
function mapGrowthHabit(habits = []) {
  const h = (habits[0] || '').toLowerCase();
  if (h.includes('tree'))       return 'tree';
  if (h.includes('shrub'))      return 'shrub';
  if (h.includes('subshrub'))   return 'shrub';
  if (h.includes('vine'))       return 'vine';
  if (h.includes('forb') || h.includes('herb')) return 'perennial';
  if (h.includes('grass') || h.includes('graminoid')) return 'grass';
  if (h.includes('fern'))       return 'fern';
  return null;
}

// GET /plants/usda-lookup?q=Alnus+rubra
async function lookup(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    // 1 — search by scientific name (returns array of {Text, Plant})
    const searchUrl = `${SEARCH_BASE}?searchText=${encodeURIComponent(q)}&limit=5`;
    const searchResp = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
    if (!searchResp.ok) return res.json({ found: false });

    const results = await searchResp.json();
    if (!Array.isArray(results) || results.length === 0) return res.json({ found: false });

    // Find the best match — prefer an exact scientific name match at Species rank
    const cleanQ = q.toLowerCase();
    const hit = results.find(r => {
      const sci = stripHtml(r.Plant?.ScientificName || '').toLowerCase();
      return sci.startsWith(cleanQ) && r.Plant?.Rank === 'Species';
    }) || results.find(r => r.Plant?.Rank === 'Species') || results[0];

    const plant = hit.Plant;
    if (!plant) return res.json({ found: false });

    const symbol = plant.AcceptedSymbol || plant.Symbol;

    // 2 — fetch the full profile (includes Ancestors for family, GrowthHabits, Durations, NativeStatuses)
    const profileResp = await fetch(`${PROFILE_BASE}?symbol=${symbol}`, { headers: { Accept: 'application/json' } });
    const profile = profileResp.ok ? await profileResp.json() : plant;

    // Extract family from Ancestors hierarchy
    const ancestors = profile.Ancestors || [];
    const familyAncestor = ancestors.find(a => a.Rank === 'Family');
    const family = familyAncestor ? stripHtml(familyAncestor.ScientificName) : null;

    // Scientific name without author (e.g. "Alnus rubra" not "Alnus rubra Bong.")
    const sciName = stripHtml(profile.ScientificName || plant.ScientificName || q)
      .replace(/\s+[A-Z][^\s]*\.?(\s+[A-Z][^\s]*\.?)*$/, '')  // strip trailing author tokens
      .trim();

    const nameParts = sciName.split(' ');
    const genus   = nameParts[0] || null;
    const species = nameParts[1] || null;

    const commonName = profile.CommonName || plant.CommonName || null;

    // Is it native to the Lower 48?
    const nativeStatuses = profile.NativeStatuses || [];
    const isNativeL48 = nativeStatuses.some(n => n.Region === 'L48' && n.Status === 'N');

    // URLs
    const usda_profile_url  = `${PROFILE_PAGE}${symbol}`;
    const oregon_flora_url  = `https://oregonflora.org/taxa/index.php?taxon=${encodeURIComponent(sciName)}`;

    const data = {
      common_name:     commonName,
      scientific_name: sciName,
      genus,
      species,
      family,
      plant_type:      mapGrowthHabit(profile.GrowthHabits || plant.GrowthHabits),
      native_region:   isNativeL48 ? 'Pacific Northwest' : null,
      usda_profile_url,
      oregon_flora_url,
    };

    // Remove null/undefined so the form only merges what we actually found
    Object.keys(data).forEach(k => (data[k] == null) && delete data[k]);

    res.json({ found: true, symbol, data });
  } catch (err) {
    console.error('USDA lookup error:', err.message);
    res.status(502).json({ error: 'USDA lookup failed', detail: err.message });
  }
}

module.exports = { lookup };
