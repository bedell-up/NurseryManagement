/**
 * shopify-sku-sync.js
 *
 * One-time (and re-runnable) script that:
 *   1. Fetches all products + variants from Shopify
 *   2. Matches them to local PlantVariant records by SKU
 *   3. Writes shopify_variant_id, shopify_inventory_item_id back into plant_variants
 *   4. Writes shopify_product_id back into plants
 *   5. Fetches the first Shopify location and writes it to .env as SHOPIFY_LOCATION_ID
 *
 * Run after importing products to Shopify (CSV or API).
 *
 * Usage:
 *   node scripts/shopify-sku-sync.js           # dry run
 *   node scripts/shopify-sku-sync.js --commit  # save to DB
 */

require('dotenv').config();

const { Plant, PlantVariant, sequelize } = require('../src/models');
const shopifyService = require('../src/services/shopifyService');
const fs = require('fs');
const path = require('path');

const COMMIT = process.argv.includes('--commit');

async function main() {
  if (!COMMIT) console.log('DRY RUN — pass --commit to save changes.\n');
  else        console.log('COMMIT mode — writing to database.\n');

  // 1. Fetch location if not set (requires read_locations scope)
  if (!process.env.SHOPIFY_LOCATION_ID) {
    try {
      console.log('Fetching Shopify location…');
      const { locations } = await shopifyService.getLocations();
      if (locations?.length) {
        const locId = String(locations[0].id);
        console.log(`  Location: "${locations[0].name}" (${locId})`);
        if (COMMIT) {
          const envPath = path.resolve(__dirname, '../.env');
          let env = fs.readFileSync(envPath, 'utf8');
          env = env.replace(/^SHOPIFY_LOCATION_ID=.*$/m, `SHOPIFY_LOCATION_ID=${locId}`);
          fs.writeFileSync(envPath, env);
          process.env.SHOPIFY_LOCATION_ID = locId;
          console.log('  Saved to .env');
        }
      }
    } catch (err) {
      console.warn(`  SKIP location fetch (missing read_locations scope): ${err.message}`);
    }
  } else {
    console.log(`Using existing location: ${process.env.SHOPIFY_LOCATION_ID}`);
  }

  // 2. Fetch all Shopify products
  console.log('\nFetching all Shopify products…');
  const shopifyProducts = await shopifyService.getAllProducts();
  console.log(`  Found ${shopifyProducts.length} products on Shopify`);

  // 3. Build SKU → Shopify variant map
  const skuMap = {}; // sku → { shopify_product_id, shopify_variant_id, shopify_inventory_item_id }
  for (const product of shopifyProducts) {
    for (const variant of product.variants ?? []) {
      if (variant.sku) {
        skuMap[variant.sku.trim()] = {
          shopify_product_id:        String(product.id),
          shopify_variant_id:        String(variant.id),
          shopify_inventory_item_id: String(variant.inventory_item_id),
        };
      }
    }
  }
  console.log(`  Built SKU map with ${Object.keys(skuMap).length} variants`);

  // 4. Load all local variants
  const localVariants = await PlantVariant.findAll({
    where: { is_active: true },
    include: [{ association: 'plant', attributes: ['id', 'common_name', 'shopify_product_id'] }],
  });

  let matched = 0, unmatched = 0, alreadyLinked = 0;

  for (const v of localVariants) {
    if (!v.sku) { unmatched++; continue; }
    const shopify = skuMap[v.sku.trim()];
    if (!shopify) {
      console.log(`  NO MATCH  SKU ${v.sku} (${v.plant?.common_name})`);
      unmatched++;
      continue;
    }
    if (v.shopify_variant_id === shopify.shopify_variant_id) { alreadyLinked++; continue; }

    console.log(`  MATCH  ${v.sku} → variant ${shopify.shopify_variant_id}`);
    matched++;

    if (COMMIT) {
      await v.update({
        shopify_variant_id:        shopify.shopify_variant_id,
        shopify_inventory_item_id: shopify.shopify_inventory_item_id,
      });
      // Update plant's shopify_product_id if not set
      if (v.plant && !v.plant.shopify_product_id) {
        await Plant.update(
          { shopify_product_id: shopify.shopify_product_id, shopify_synced_at: new Date() },
          { where: { id: v.plant.id } }
        );
      }
    }
  }

  console.log(`\n── Results ──────────────────────────────────`);
  console.log(`  Newly matched:   ${matched}`);
  console.log(`  Already linked:  ${alreadyLinked}`);
  console.log(`  No Shopify match:${unmatched}`);

  if (!COMMIT && matched > 0) {
    console.log('\nRun with --commit to save these links to the database.');
  }

  await sequelize.close();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  sequelize.close();
  process.exit(1);
});
