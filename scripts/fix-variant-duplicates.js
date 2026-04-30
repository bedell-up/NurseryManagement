/**
 * fix-variant-duplicates.js
 *
 * Merges duplicate/placeholder variants into their canonical counterparts,
 * transferring stock and logging each adjustment.
 *
 * Usage:
 *   node scripts/fix-variant-duplicates.js           # dry run (default)
 *   node scripts/fix-variant-duplicates.js --commit  # actually make changes
 */

require('dotenv').config();

const { PlantVariant, Inventory, InventoryLog, sequelize } = require('../src/models');

const COMMIT = process.argv.includes('--commit');

// Pairs to merge: [keepSku, deleteSku]
// Stock from deleteSku is added to keepSku, then deleteSku variant is removed.
const MERGES = [
  ['CARAMP-1G',  'CARAMP-1g'],
  ['CRADOU-2G',  'CRADOU-2g'],
  ['RIBAUR-1G',  'RIBAUR-1g'],
  ['GERORE-1G',  'GERORE-1g'],
  ['FAGDIB-1G',  'FAGDIB-1g'],
  ['RHUGLA-1G',  'RHUGLA-1g'],
  ['RIBDIV-2G',  'RIBDIV-2g'],
  // Snowberry: 77 TBD plants are 4" Tall Band — merge into existing variant
  ['SYMALB-4TB', 'SYMALB-TBD'],
];

function log(...parts) {
  console.log(...parts);
}

async function main() {
  if (!COMMIT) {
    log('DRY RUN — no changes will be saved. Pass --commit to apply.\n');
  } else {
    log('COMMIT mode — changes will be written to the database.\n');
  }

  const t = COMMIT ? await sequelize.transaction() : null;

  try {
    // ── 1. Merge duplicate variants ─────────────────────────────────────────
    log('── Variant merges ──────────────────────────────────────────────────');

    for (const [keepSku, deleteSku] of MERGES) {
      const keeper = await PlantVariant.findOne({ where: { sku: keepSku } });
      const dupe   = await PlantVariant.findOne({ where: { sku: deleteSku } });

      if (!keeper) { log(`  SKIP  keeper SKU not found: ${keepSku}`); continue; }
      if (!dupe)   { log(`  SKIP  dupe SKU not found: ${deleteSku}`); continue; }

      let keepInv = await Inventory.findOne({ where: { variant_id: keeper.id } });
      const dupeInv = await Inventory.findOne({ where: { variant_id: dupe.id } });

      if (!keepInv) {
        log(`  NOTE  keeper ${keepSku} has no inventory record — will create one`);
        if (COMMIT) {
          keepInv = await Inventory.create({ variant_id: keeper.id, quantity_on_hand: 0 }, { transaction: t });
        } else {
          // Simulate for dry run
          keepInv = { quantity_on_hand: 0 };
        }
      }

      const dupeQty  = dupeInv?.quantity_on_hand ?? 0;
      const beforeQty = keepInv.quantity_on_hand;
      const afterQty  = beforeQty + dupeQty;

      log(`  MERGE  "${deleteSku}" (${dupeQty}) → "${keepSku}" (${beforeQty} → ${afterQty})`);

      if (COMMIT) {
        // Add dupe stock to keeper
        await keepInv.update({ quantity_on_hand: afterQty }, { transaction: t });

        // Log the adjustment
        await InventoryLog.create({
          variant_id:      keeper.id,
          change_type:     'adjustment',
          quantity_before: beforeQty,
          quantity_change: dupeQty,
          quantity_after:  afterQty,
          notes:           `Merged duplicate variant ${deleteSku} (case normalization)`,
        }, { transaction: t });

        // Delete dupe inventory then dupe variant
        if (dupeInv) await dupeInv.destroy({ transaction: t });
        await dupe.destroy({ transaction: t });

        log(`         Deleted variant ${deleteSku}`);
      }
    }

    // ── Commit ───────────────────────────────────────────────────────────────
    if (COMMIT) {
      await t.commit();
      log('\nAll changes committed successfully.');
    } else {
      log('\nDry run complete. Run with --commit to apply these changes.');
    }
  } catch (err) {
    if (t) await t.rollback();
    console.error('Error — transaction rolled back:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
