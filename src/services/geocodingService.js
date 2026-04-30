const https = require('https');

// Nominatim (OpenStreetMap) geocoding — free, no API key required.
// Nominatim terms: max 1 req/sec, must include a descriptive User-Agent.
async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address.trim())}&format=json&limit=1&addressdetails=0`;

  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'BloomsdayNatives/1.0 (nursery management)',
        'Accept': 'application/json',
      },
    }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const results = JSON.parse(raw);
          if (Array.isArray(results) && results.length > 0) {
            resolve({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

module.exports = { geocodeAddress };
