/**
 * One-time migration: normalize container_size case and merge duplicate variants.
 *
 * Canonical form: matches TrayType.name (e.g. "1 Gal" not "1 gal").
 * For each plant, variants that share the same LOWER(container_size) are merged:
 *   - Inventory quantities are summed into the canonical variant
 *   - All FK references (orders, pricing, production, logs, etc.) are reassigned
 *   - The duplicate variant is deactivated
 *
 * Run dry-run first:
 *   node scripts/normalize-container-sizes.js
 *
 * Run for real:
 *   node scripts/normalize-container-sizes.js --confirm
 */

require('dotenv').config();
const { sequelize } = require('../src/models');

const DRY_RUN = !process.argv.includes('--confirm');

if (DRY_RUN) {
  console.log('DRY RUN — pass --confirm to apply changes\n');
} else {
  console.log('LIVE RUN — changes will be written\n');
}

async function run() {
  const t = await sequelize.transaction();
  try {
    // 1. Find all active variants, grouped by plant + normalized container_size, with 2+ members
    const groups = await sequelize.query(`
      SELECT
        plant_id,
        LOWER(TRIM(container_size)) AS normalized,
        array_agg(id ORDER BY
          CASE WHEN container_size = INITCAP(container_size) OR container_size ~ '^[0-9]+ [A-Z]' THEN 0 ELSE 1 END,
          created_at ASC
        ) AS variant_ids,
        array_agg(container_size ORDER BY
          CASE WHEN container_size = INITCAP(container_size) OR container_size ~ '^[0-9]+ [A-Z]' THEN 0 ELSE 1 END,
          created_at ASC
        ) AS container_sizes
      FROM plant_variants
      WHERE is_active = true
      GROUP BY plant_id, LOWER(TRIM(container_size))
      HAVING COUNT(*) > 1
    `, { type: 'SELECT', transaction: t });

    console.log(`Found ${groups.length} plant+size groups with duplicates\n`);

    let mergedCount = 0;
    let inventoryMerged = 0;
    let shopifyWarnings = [];

    for (const group of groups) {
      const [canonicalId, ...duplicateIds] = group.variant_ids;
      const [canonicalSize, ...duplicateSizes] = group.container_sizes;

      console.log(`  Plant ${group.plant_id}: keeping "${canonicalSize}" (${canonicalId})`);
      console.log(`    Deactivating: ${duplicateIds.map((id, i) => `"${duplicateSizes[i]}" (${id})`).join(', ')}`);

      if (!DRY_RUN) {
        // Get canonical inventory record
        const [canonicalInv] = await sequelize.query(
          `SELECT * FROM inventory WHERE variant_id = $1 LIMIT 1`,
          { bind: [canonicalId], type: 'SELECT', transaction: t }
        );

        for (const dupId of duplicateIds) {
          // Check if duplicate has a Shopify ID (warn but continue)
          const [dupVariant] = await sequelize.query(
            `SELECT shopify_variant_id, container_size FROM plant_variants WHERE id = $1`,
            { bind: [dupId], type: 'SELECT', transaction: t }
          );
          if (dupVariant?.shopify_variant_id) {
            shopifyWarnings.push({ plant_id: group.plant_id, dup_id: dupId, shopify_id: dupVariant.shopify_variant_id });
          }

          // Get duplicate inventory record
          const [dupInv] = await sequelize.query(
            `SELECT * FROM inventory WHERE variant_id = $1 LIMIT 1`,
            { bind: [dupId], type: 'SELECT', transaction: t }
          );

          if (dupInv) {
            if (canonicalInv) {
              // Both have inventory — sum quantities, transfer location splits, delete duplicate inventory
              await sequelize.query(`
                UPDATE inventory SET
                  quantity_on_hand  = quantity_on_hand  + COALESCE($2, 0),
                  quantity_reserved = quantity_reserved + COALESCE($3, 0),
                  quantity_incoming = quantity_incoming + COALESCE($4, 0)
                WHERE id = $1
              `, { bind: [canonicalInv.id, dupInv.quantity_on_hand, dupInv.quantity_reserved, dupInv.quantity_incoming], transaction: t });

              // Move location splits to canonical inventory
              await sequelize.query(
                `UPDATE inventory_location_splits SET inventory_id = $1 WHERE inventory_id = $2`,
                { bind: [canonicalInv.id, dupInv.id], transaction: t }
              );
              // Remove duplicate inventory row
              await sequelize.query(`DELETE FROM inventory WHERE id = $1`, { bind: [dupInv.id], transaction: t });
              inventoryMerged++;
            } else {
              // Canonical has no inventory — reassign duplicate's inventory
              await sequelize.query(
                `UPDATE inventory SET variant_id = $1 WHERE variant_id = $2`,
                { bind: [canonicalId, dupId], transaction: t }
              );
            }
          }

          // Reassign pricing (if canonical has no pricing, take duplicate's)
          const [canonicalPricing] = await sequelize.query(
            `SELECT id FROM pricing WHERE variant_id = $1 LIMIT 1`,
            { bind: [canonicalId], type: 'SELECT', transaction: t }
          );
          if (!canonicalPricing) {
            await sequelize.query(
              `UPDATE pricing SET variant_id = $1 WHERE variant_id = $2`,
              { bind: [canonicalId, dupId], transaction: t }
            );
          } else {
            await sequelize.query(`DELETE FROM pricing WHERE variant_id = $1`, { bind: [dupId], transaction: t });
          }

          // Reassign all other FK references
          const fkTables = [
            'inventory_logs',
            'preorders',
            'delivery_window_items',
            'production_batches',
            'nursery_order_items',
            'vendor_order_items',
            'landscaping_project_plants',
          ];
          for (const table of fkTables) {
            await sequelize.query(
              `UPDATE ${table} SET variant_id = $1 WHERE variant_id = $2`,
              { bind: [canonicalId, dupId], transaction: t }
            );
          }

          // Vendor SKUs: transfer if no conflict, delete if duplicate vendor_code exists on canonical
          const dupVendorSkus = await sequelize.query(
            `SELECT id, vendor_code FROM vendor_skus WHERE variant_id = $1`,
            { bind: [dupId], type: 'SELECT', transaction: t }
          );
          for (const vs of dupVendorSkus) {
            const [conflict] = await sequelize.query(
              `SELECT id FROM vendor_skus WHERE variant_id = $1 AND vendor_code = $2`,
              { bind: [canonicalId, vs.vendor_code], type: 'SELECT', transaction: t }
            );
            if (conflict) {
              await sequelize.query(`DELETE FROM vendor_skus WHERE id = $1`, { bind: [vs.id], transaction: t });
            } else {
              await sequelize.query(
                `UPDATE vendor_skus SET variant_id = $1 WHERE id = $2`,
                { bind: [canonicalId, vs.id], transaction: t }
              );
            }
          }

          // Deactivate duplicate
          await sequelize.query(
            `UPDATE plant_variants SET is_active = false WHERE id = $1`,
            { bind: [dupId], transaction: t }
          );
        }
      }

      mergedCount += duplicateIds.length;
    }

    // 2. Normalize container_size on all remaining active variants to match TrayType canonical names
    //    Only apply when an exact TrayType name match exists (case-insensitive)
    if (!DRY_RUN) {
      await sequelize.query(`
        UPDATE plant_variants pv
        SET container_size = tt.name
        FROM tray_types tt
        WHERE LOWER(TRIM(pv.container_size)) = LOWER(TRIM(tt.name))
          AND pv.container_size != tt.name
          AND pv.is_active = true
      `, { transaction: t });
      console.log('\nNormalized container_size values to match TrayType canonical names');
    }

    if (DRY_RUN) {
      console.log(`\nWould deactivate ${mergedCount} duplicate variant(s).`);
      await t.rollback();
    } else {
      await t.commit();
      console.log(`\nDeactivated ${mergedCount} duplicate variant(s), merged inventory for ${inventoryMerged}.`);
      if (shopifyWarnings.length > 0) {
        console.log('\nSHOPIFY WARNING — these duplicates had shopify_variant_id set (manual cleanup needed):');
        shopifyWarnings.forEach(w => console.log(`  plant ${w.plant_id}, variant ${w.dup_id}, shopify_id ${w.shopify_id}`));
      }
    }
  } catch (err) {
    await t.rollback();
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }

  process.exit(0);
}

run();
