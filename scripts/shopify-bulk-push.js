/**
 * shopify-bulk-push.js
 *
 * Pushes all active plants with at least one variant available (qty > 1) to Shopify.
 * Variants with multiple container sizes are listed as Size options on a single product.
 * Stores shopify_product_id / shopify_variant_id back into the local DB so the
 * order webhook can decrement inventory automatically.
 *
 * Usage:
 *   node scripts/shopify-bulk-push.js [options]
 *
 * Options:
 *   --dry-run         Print what would be pushed without making any Shopify API calls
 *   --force           Re-push plants that already have a shopify_product_id
 *   --location-id N   Shopify location ID to sync inventory levels to.
 *                     If omitted the script fetches your locations and uses the first one.
 *   --min-qty N       Minimum available quantity to include a variant (default: 2)
 */

require('dotenv').config();

const { Op } = require('sequelize');
const { Plant, PlantVariant, Inventory, Pricing, sequelize } = require('../src/models');
const shopifyService = require('../src/services/shopifyService');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const FORCE     = args.includes('--force');
const minQtyIdx = args.indexOf('--min-qty');
const MIN_QTY   = minQtyIdx !== -1 ? parseInt(args[minQtyIdx + 1], 10) : 2;
const locIdx    = args.indexOf('--location-id');
let   LOCATION_ID = locIdx !== -1 ? args[locIdx + 1] : null;

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Shopify Admin API: 2 calls/sec on the standard plan. We stay under it.
const RATE_LIMIT_MS = 600;

let created = 0;
let updated = 0;
let skipped = 0;
let errors  = 0;

function log(...parts) {
  console.log(new Date().toISOString(), ...parts);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (DRY_RUN) log('[DRY RUN] No changes will be made to Shopify.');

  // Resolve location ID
  if (!LOCATION_ID) {
    if (DRY_RUN) {
      LOCATION_ID = 'DRY_RUN_LOCATION';
    } else {
      log('Fetching Shopify locations…');
      const { locations } = await shopifyService.getLocations();
      if (!locations?.length) throw new Error('No Shopify locations found. Check your API credentials.');
      LOCATION_ID = String(locations[0].id);
      log(`Using location: "${locations[0].name}" (${LOCATION_ID})`);
    }
  }

  // Query plants that have at least one variant with enough stock
  log(`Querying plants with at least one variant having qty > ${MIN_QTY - 1}…`);

  const plants = await Plant.findAll({
    where: { is_active: true },
    include: [
      {
        model: PlantVariant,
        as: 'variants',
        where: { is_active: true },
        required: true,
        include: [
          {
            model: Inventory,
            as: 'inventory',
            where: {
              [Op.and]: [
                sequelize.literal(`"variants->inventory"."quantity_on_hand" - "variants->inventory"."quantity_reserved" >= ${MIN_QTY}`),
              ],
            },
            required: true,
          },
          {
            model: Pricing,
            as: 'pricing',
            required: false,
          },
        ],
      },
    ],
    order: [['common_name', 'ASC']],
  });

  log(`Found ${plants.length} plants to process.`);

  for (const plant of plants) {
    // Filter variants to only those meeting the qty threshold
    const eligibleVariants = plant.variants.filter(v => {
      const avail = (v.inventory?.quantity_on_hand ?? 0) - (v.inventory?.quantity_reserved ?? 0);
      return avail >= MIN_QTY;
    });

    if (!eligibleVariants.length) {
      skipped++;
      continue;
    }

    const alreadySynced = !!plant.shopify_product_id;

    if (alreadySynced && !FORCE) {
      log(`  SKIP  "${plant.common_name}" — already on Shopify (${plant.shopify_product_id}). Use --force to re-push.`);
      skipped++;
      continue;
    }

    const variantSummary = eligibleVariants
      .map(v => `${v.container_size} (qty ${(v.inventory.quantity_on_hand - v.inventory.quantity_reserved)})`)
      .join(', ');

    if (DRY_RUN) {
      log(`  DRY   "${plant.common_name}" — ${eligibleVariants.length} variant(s): ${variantSummary}`);
      continue;
    }

    try {
      let shopifyProduct;

      if (alreadySynced && FORCE) {
        // Update existing product
        log(`  UPDATE "${plant.common_name}" (${plant.shopify_product_id})…`);
        const result = await shopifyService.updateShopifyProduct(plant.shopify_product_id, plant, eligibleVariants);
        shopifyProduct = result.product;
        updated++;
      } else {
        // Create new product
        log(`  CREATE "${plant.common_name}" — ${eligibleVariants.length} variant(s)…`);
        const result = await shopifyService.createShopifyProduct(plant, eligibleVariants);
        shopifyProduct = result.product;
        created++;
      }

      // Store Shopify product ID back to local plant
      await plant.update({
        shopify_product_id: String(shopifyProduct.id),
        shopify_synced_at: new Date(),
      });

      // Match returned Shopify variants back to local variants by SKU, store IDs + sync inventory
      for (const sv of shopifyProduct.variants) {
        const localVariant = eligibleVariants.find(v => v.sku === sv.sku);
        if (!localVariant) continue;

        await localVariant.update({ shopify_variant_id: String(sv.id) });

        // Sync inventory level
        const available = (localVariant.inventory.quantity_on_hand ?? 0)
                        - (localVariant.inventory.quantity_reserved ?? 0);
        try {
          await shopifyService.syncInventoryToShopify(sv.inventory_item_id, LOCATION_ID, available);
        } catch (invErr) {
          log(`    WARN  Could not sync inventory for SKU ${localVariant.sku}: ${invErr.message}`);
        }

        await sleep(RATE_LIMIT_MS);
      }
    } catch (err) {
      log(`  ERROR "${plant.common_name}": ${err.message}`);
      errors++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  log('─'.repeat(60));
  log(`Done. Created: ${created}  Updated: ${updated}  Skipped: ${skipped}  Errors: ${errors}`);

  await sequelize.close();
}

main().catch(err => {
  console.error('Fatal:', err);
  sequelize.close();
  process.exit(1);
});
