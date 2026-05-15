require('dotenv').config();

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP_NAME;
const SHOPIFY_BASE = `https://${SHOPIFY_SHOP}/admin/api/2025-01`;

// ── Token management (Dev Dashboard client-credentials flow) ──────────────────
// Tokens expire in 24 h; we refresh 60 s before expiry.
let _token = process.env.SHOPIFY_ACCESS_TOKEN || null;
let _tokenExpiresAt = _token ? Date.now() + 23 * 60 * 60 * 1000 : 0; // assume fresh if pre-set

async function getAccessToken() {
  if (_token && Date.now() < _tokenExpiresAt - 60_000) return _token;

  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`https://${SHOPIFY_SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      grant_type:    'client_credentials',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  _token          = data.access_token;
  _tokenExpiresAt = Date.now() + (data.expires_in ?? 86399) * 1000;
  return _token;
}

async function shopifyRequest(method, path, body = null) {
  const fetch = (await import('node-fetch')).default;
  const token = await getAccessToken();
  const res = await fetch(`${SHOPIFY_BASE}${path}`, {
    method,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Sync a plant variant's price to Shopify
async function syncPriceToShopify(variantId, retailPrice, salePrice = null) {
  const body = {
    variant: {
      id: variantId,
      price: String(retailPrice),
      compare_at_price: salePrice ? String(retailPrice) : null,
    },
  };
  if (salePrice) body.variant.price = String(salePrice);
  return shopifyRequest('PUT', `/variants/${variantId}.json`, body);
}

// Sync inventory level to Shopify
async function syncInventoryToShopify(inventoryItemId, locationId, available) {
  return shopifyRequest('POST', '/inventory_levels/set.json', {
    inventory_item_id: inventoryItemId,
    location_id: locationId,
    available,
  });
}

// Readable labels for enum values
const SUN_LABELS = {
  full_sun: 'Full Sun',
  part_shade: 'Part Shade',
  partial_shade_to_shade: 'Partial Shade to Full Shade',
  full_shade: 'Full Shade',
  sun_to_part_shade: 'Sun to Part Shade',
};
const WATER_LABELS = {
  dry: 'Dry',
  medium: 'Medium',
  wet: 'Wet',
  wet_to_medium: 'Wet to Medium',
  dry_to_medium: 'Dry to Medium',
};

function buildDescription(plant) {
  const lines = [];

  // Scientific name subtitle
  if (plant.scientific_name) {
    lines.push(`<p><em>${plant.scientific_name}</em></p>`);
  }

  // Identity line — type, family, native region
  const identity = [
    plant.plant_type   ? `<strong>Type:</strong> ${plant.plant_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}` : null,
    plant.family       ? `<strong>Family:</strong> ${plant.family}` : null,
    plant.native_region? `<strong>Native Region:</strong> ${plant.native_region}` : null,
  ].filter(Boolean);
  if (identity.length) lines.push(`<p>${identity.join(' &nbsp;·&nbsp; ')}</p>`);

  // User-written description
  if (plant.description) {
    lines.push(`<p>${plant.description}</p>`);
  }

  // Growing conditions
  const conditions = [
    plant.sun_requirements   ? `<li><strong>Sun:</strong> ${SUN_LABELS[plant.sun_requirements]   || plant.sun_requirements}</li>`   : null,
    plant.water_requirements ? `<li><strong>Water:</strong> ${WATER_LABELS[plant.water_requirements] || plant.water_requirements}</li>` : null,
    plant.soil_type          ? `<li><strong>Soil:</strong> ${plant.soil_type}</li>`          : null,
    plant.bloom_time         ? `<li><strong>Bloom Time:</strong> ${plant.bloom_time}</li>`   : null,
    plant.bloom_color        ? `<li><strong>Bloom Color:</strong> ${plant.bloom_color}</li>` : null,
    (plant.mature_height_min_ft || plant.mature_height_max_ft) ? (() => {
      const min = plant.mature_height_min_ft, max = plant.mature_height_max_ft;
      const h = (min && max) ? `${min}–${max} ft` : `${min || max} ft`;
      const w = (plant.mature_width_min_ft || plant.mature_width_max_ft)
        ? `, ${plant.mature_width_min_ft || ''}${plant.mature_width_min_ft && plant.mature_width_max_ft ? '–' : ''}${plant.mature_width_max_ft || ''} ft wide`
        : '';
      return `<li><strong>Mature Size:</strong> ${h} tall${w}</li>`;
    })() : null,
    (plant.hardiness_zone_min || plant.hardiness_zone_max) ? (() => {
      const z = plant.hardiness_zone_min && plant.hardiness_zone_max
        ? `${plant.hardiness_zone_min}–${plant.hardiness_zone_max}`
        : plant.hardiness_zone_min || plant.hardiness_zone_max;
      return `<li><strong>Hardiness Zone:</strong> ${z}</li>`;
    })() : null,
  ].filter(Boolean);
  if (conditions.length) {
    lines.push('<h4>Growing Conditions</h4>');
    lines.push(`<ul>${conditions.join('')}</ul>`);
  }

  // Wildlife & traits
  const traits = [
    plant.attracts_pollinators  ? 'Attracts Pollinators'  : null,
    plant.attracts_birds        ? 'Attracts Birds'        : null,
    plant.attracts_butterflies  ? 'Attracts Butterflies'  : null,
    plant.deer_resistant        ? 'Deer Resistant'        : null,
    plant.is_edible             ? 'Edible'                : null,
    plant.is_medicinal          ? 'Medicinal'             : null,
    plant.is_fire_resistant     ? 'Fire Resistant'        : null,
    plant.is_pet_friendly === true  ? 'Pet Friendly'      : null,
    plant.portland_plant_list   ? 'Portland Approved Plant List' : null,
  ].filter(Boolean);
  if (traits.length) {
    lines.push('<h4>Attributes</h4>');
    lines.push(`<ul>${traits.map(t => `<li>${t}</li>`).join('')}</ul>`);
  }

  // Landscape use
  if (plant.landscape_use) {
    lines.push('<h4>Landscape Use</h4>');
    lines.push(`<p>${plant.landscape_use}</p>`);
  }

  // Ecological notes
  if (plant.notes) {
    lines.push('<h4>Ecological Notes</h4>');
    lines.push(`<p>${plant.notes}</p>`);
  }

  return lines.join('\n');
}

function buildProductPayload(plant, variants) {
  const multipleVariants = variants.length > 1;
  const productVariants = variants.map((v) => ({
    option1: v.container_size,
    sku: v.sku,
    price: String(v.pricing?.retail_price ?? '0.00'),
    compare_at_price: v.pricing?.sale_price ? String(v.pricing.retail_price) : null,
    inventory_management: 'shopify',
    inventory_policy: 'deny',
  }));

  const tags = [
    plant.native_region,
    plant.plant_type,
    plant.bloom_color,
    plant.attracts_pollinators  ? 'pollinator'     : null,
    plant.attracts_birds        ? 'bird-friendly'  : null,
    plant.attracts_butterflies  ? 'butterfly-friendly' : null,
    plant.deer_resistant        ? 'deer-resistant' : null,
    plant.is_edible             ? 'edible'         : null,
    plant.is_medicinal          ? 'medicinal'      : null,
    plant.portland_plant_list   ? 'portland-plant-list' : null,
    plant.genus,
  ].filter(Boolean);

  return {
    title: plant.common_name,
    body_html: buildDescription(plant),
    vendor: 'Bloomsday Natives',
    product_type: plant.plant_type
      ? plant.plant_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'Plant',
    tags: [...new Set(tags)].join(', '),
    images: plant.image_url ? [{ src: plant.image_url, alt: plant.common_name }] : [],
    options: multipleVariants ? [{ name: 'Size' }] : undefined,
    variants: productVariants,
  };
}

// Create a Shopify product from a plant
async function createShopifyProduct(plant, variants) {
  return shopifyRequest('POST', '/products.json', { product: buildProductPayload(plant, variants) });
}

// Update an existing Shopify product (title, description, variants, etc.)
async function updateShopifyProduct(shopifyProductId, plant, variants) {
  return shopifyRequest('PUT', `/products/${shopifyProductId}.json`, {
    product: { id: shopifyProductId, ...buildProductPayload(plant, variants) },
  });
}

// Get all locations
async function getLocations() {
  return shopifyRequest('GET', '/locations.json');
}

// Fetch a product
async function getProduct(shopifyProductId) {
  return shopifyRequest('GET', `/products/${shopifyProductId}.json`);
}

// Fetch all products with all variants (paginated, 250 per page)
async function getAllProducts() {
  const products = [];
  let url = `/products.json?limit=250&fields=id,title,variants`;
  while (url) {
    const fetch = (await import('node-fetch')).default;
    const token = await getAccessToken();
    const res = await fetch(`https://${SHOPIFY_SHOP}/admin/api/2025-01${url}`, {
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Shopify getAllProducts failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    products.push(...(data.products ?? []));
    // Follow Link header for next page
    const link = res.headers.get('link') || '';
    const next = link.match(/<[^>]*\/admin\/api\/[^>]*\/products\.json([^>]*)>;\s*rel="next"/);
    url = next ? `/products.json${next[1]}` : null;
  }
  return products;
}

// ── Theme management ──────────────────────────────────────────────────────────

// List all themes
async function getThemes() {
  return shopifyRequest('GET', '/themes.json');
}

// Get a single theme asset (e.g. key = 'assets/theme.css')
async function getThemeAsset(themeId, key) {
  return shopifyRequest('GET', `/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
}

// Create or update a theme asset.
// Pass assetData as { value } for text files or { attachment } for binary (base64).
async function putThemeAsset(themeId, key, assetData) {
  return shopifyRequest('PUT', `/themes/${themeId}/assets.json`, {
    asset: { key, ...assetData },
  });
}

// List all asset keys for a theme
async function listThemeAssets(themeId) {
  return shopifyRequest('GET', `/themes/${themeId}/assets.json`);
}

// Register a webhook
async function registerWebhook(topic, address) {
  return shopifyRequest('POST', '/webhooks.json', {
    webhook: { topic, address, format: 'json' },
  });
}

// List registered webhooks
async function listWebhooks() {
  return shopifyRequest('GET', '/webhooks.json');
}

// Count open (unfulfilled) Shopify orders
async function getOpenOrdersCount() {
  const data = await shopifyRequest('GET', '/orders/count.json?status=open&fulfillment_status=unfulfilled');
  return data.count ?? 0;
}

module.exports = {
  syncPriceToShopify,
  syncInventoryToShopify,
  createShopifyProduct,
  updateShopifyProduct,
  getLocations,
  getProduct,
  getAllProducts,
  registerWebhook,
  listWebhooks,
  getThemes,
  getThemeAsset,
  putThemeAsset,
  listThemeAssets,
  getOpenOrdersCount,
};
