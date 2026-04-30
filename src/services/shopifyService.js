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

  return {
    title: plant.common_name,
    body_html: plant.description || '',
    vendor: 'PSC Natives',
    product_type: plant.plant_type || 'Plant',
    tags: [
      plant.native_region,
      plant.plant_type,
      plant.bloom_color,
      plant.attracts_pollinators ? 'pollinator' : null,
      plant.attracts_birds ? 'bird-friendly' : null,
      plant.deer_resistant ? 'deer-resistant' : null,
    ].filter(Boolean).join(', '),
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
};
