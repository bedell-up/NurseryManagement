const crypto = require('crypto');
const { Plant, PlantVariant, Inventory, Pricing, InventoryLog, StorageLocation, InventoryLocationSplit } = require('../models');
const shopifyService = require('../services/shopifyService');

// Verify Shopify webhook signature
function verifyWebhook(req) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const body = req.rawBody;
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  return hmac === hash;
}

// Webhook: order created — handle if it contains plant products
async function webhookOrderCreated(req, res) {
  if (!verifyWebhook(req)) return res.status(401).send('Unauthorized');
  res.status(200).send('OK'); // Acknowledge quickly

  // req.rawBody captured before express.json() consumed the stream
  const order = typeof req.body === 'object' && req.body !== null
    ? req.body
    : JSON.parse(req.rawBody || '{}');
  for (const item of order.line_items || []) {
    const variant = await PlantVariant.findOne({ where: { shopify_variant_id: String(item.variant_id) } });
    if (!variant) continue;

    const inv = await Inventory.findOne({ where: { variant_id: variant.id } });
    if (inv) {
      const before = inv.quantity_on_hand;
      const after = Math.max(0, before - item.quantity);
      await inv.update({ quantity_on_hand: after });
      await InventoryLog.create({
        variant_id: variant.id,
        change_type: 'sale',
        quantity_before: before,
        quantity_change: -item.quantity,
        quantity_after: after,
        reference_id: String(order.id),
      });
    }
  }
}

// Push a plant's product to Shopify (creates or updates)
async function pushProduct(req, res) {
  const plant = await Plant.findByPk(req.params.plant_id, {
    include: [{ association: 'variants', include: ['pricing'] }],
  });
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  let shopifyProduct;
  let action;

  if (plant.shopify_product_id) {
    // Update existing product
    const result = await shopifyService.updateShopifyProduct(plant.shopify_product_id, plant, plant.variants);
    shopifyProduct = result.product;
    action = 'updated';
  } else {
    // Create new product
    const result = await shopifyService.createShopifyProduct(plant, plant.variants);
    shopifyProduct = result.product;
    action = 'created';
  }

  await plant.update({ shopify_product_id: String(shopifyProduct.id), shopify_synced_at: new Date() });

  // Save/update variant IDs
  for (const sv of shopifyProduct.variants) {
    const localVariant = plant.variants.find((v) => v.sku === sv.sku || v.container_size === sv.title);
    if (localVariant) {
      await localVariant.update({ shopify_variant_id: String(sv.id) });
    }
  }

  res.json({ message: `Product ${action} on Shopify`, shopify_product_id: shopifyProduct.id, action });
}

async function getLocations(req, res) {
  const data = await shopifyService.getLocations();
  res.json(data);
}

// Webhook: orders/fulfilled — deduct inventory from the fulfillment location
async function webhookFulfillmentCreated(req, res) {
  if (!verifyWebhook(req)) return res.status(401).send('Unauthorized');
  res.status(200).send('OK');

  // orders/fulfilled sends the full order; process each fulfillment in it
  const order = typeof req.body === 'object' && req.body !== null
    ? req.body
    : JSON.parse(req.rawBody || '{}');
  for (const fulfillment of order.fulfillments || []) {
    await processFulfillment(fulfillment, order.id);
  }
}

async function processFulfillment(fulfillment, orderId) {
  const shopifyLocationId = String(fulfillment.location_id || '');

  // Find matching backend location (may be null if not mapped)
  const backendLocation = shopifyLocationId
    ? await StorageLocation.findOne({ where: { shopify_location_id: shopifyLocationId } })
    : null;

  for (const item of fulfillment.line_items || []) {
    const variant = await PlantVariant.findOne({ where: { shopify_variant_id: String(item.variant_id) } });
    if (!variant) continue;

    const inv = await Inventory.findOne({ where: { variant_id: variant.id } });
    if (!inv) continue;

    const qty      = item.quantity || 0;
    const before   = inv.quantity_on_hand;
    const after    = Math.max(0, before - qty);

    await inv.update({ quantity_on_hand: after });

    await InventoryLog.create({
      variant_id:      variant.id,
      change_type:     'sale',
      quantity_before: before,
      quantity_change: -qty,
      quantity_after:  after,
      reference_id:    String(orderId),
      location:        backendLocation?.name || null,
      notes:           `Shopify fulfillment #${fulfillment.id}${backendLocation ? ` — ${backendLocation.name}` : ''}`,
    });

    // Deduct from the location split if we have a match
    if (backendLocation) {
      const split = await InventoryLocationSplit.findOne({
        where: { inventory_id: inv.id, location: backendLocation.name },
      });
      if (split) {
        const splitAfter = Math.max(0, (split.quantity || 0) - qty);
        await split.update({ quantity: splitAfter });
      }
    }
  }
}

// Register the order webhook so Shopify notifies us on every sale
async function registerWebhooks(req, res) {
  const appUrl = process.env.APP_URL || 'https://native.pscapps.com';
  const webhooks = [
    { topic: 'orders/create',    address: `${appUrl}/api/shopify/webhooks/order-created` },
    { topic: 'orders/fulfilled', address: `${appUrl}/api/shopify/webhooks/fulfillment-created` },
  ];
  const results = [];
  for (const { topic, address } of webhooks) {
    try {
      const r = await shopifyService.registerWebhook(topic, address);
      results.push({ topic, id: r.webhook?.id, status: 'registered' });
    } catch (err) {
      results.push({ topic, status: err.message.includes('422') ? 'already_exists' : 'error', error: err.message });
    }
  }
  res.json({ results });
}

async function listWebhooks(req, res) {
  const data = await shopifyService.listWebhooks();
  res.json(data);
}

async function getOpenOrdersCount(req, res) {
  const count = await shopifyService.getOpenOrdersCount();
  res.json({ count });
}

module.exports = { webhookOrderCreated, webhookFulfillmentCreated, pushProduct, getLocations, registerWebhooks, listWebhooks, getOpenOrdersCount };
