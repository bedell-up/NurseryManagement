/**
 * One-time migration: convert existing landscaping job inventory deductions
 * from quantity_on_hand reductions → quantity_reserved reservations.
 *
 * Previously, adding a plant to a job immediately reduced quantity_on_hand.
 * Going forward, it increments quantity_reserved instead (available = on_hand - reserved).
 * This means bulk counts can accurately reflect physical stock without overwriting job allocations.
 *
 * For each active project plant that has a landscaping_transfer log:
 *   - Add plant.quantity back to quantity_on_hand (undo the old deduction)
 *   - Add plant.quantity to quantity_reserved (mark as reserved for job)
 *
 * Run dry-run:  node scripts/reconcile-job-inventory.js
 * Run for real: node scripts/reconcile-job-inventory.js --confirm
 */

require('dotenv').config();
const { sequelize } = require('../src/models');

const DRY_RUN = !process.argv.includes('--confirm');
if (DRY_RUN) console.log('DRY RUN — pass --confirm to apply\n');
else         console.log('LIVE RUN\n');

async function run() {
  // Sum active job quantities per variant
  const rows = await sequelize.query(`
    SELECT
      pp.variant_id,
      SUM(pp.quantity) AS total_job_qty,
      i.id             AS inv_id,
      i.quantity_on_hand,
      i.quantity_reserved,
      COUNT(il.id)     AS transfer_log_count
    FROM landscaping_project_plants pp
    JOIN inventory i ON i.variant_id = pp.variant_id
    LEFT JOIN inventory_logs il
      ON il.variant_id = pp.variant_id AND il.change_type = 'landscaping_transfer'
    WHERE pp.status != 'removed'
    GROUP BY pp.variant_id, i.id, i.quantity_on_hand, i.quantity_reserved
    HAVING COUNT(il.id) > 0   -- only rows where the old deduction actually logged
       AND i.quantity_reserved < SUM(pp.quantity)  -- not yet reconciled
  `, { type: 'SELECT' });

  console.log(`Found ${rows.length} inventory record(s) to reconcile\n`);

  const t = await sequelize.transaction();
  let done = 0;
  try {
    for (const r of rows) {
      const jobQty    = parseInt(r.total_job_qty, 10);
      const alreadyReserved = parseInt(r.quantity_reserved, 10) || 0;
      const additional = jobQty - alreadyReserved; // how much isn't yet reserved
      if (additional <= 0) continue;

      const newOnHand   = parseInt(r.quantity_on_hand, 10) + additional;
      const newReserved = alreadyReserved + additional;

      console.log(
        `  variant ${r.variant_id}: on_hand ${r.quantity_on_hand}→${newOnHand},` +
        ` reserved ${r.quantity_reserved}→${newReserved} (job total: ${jobQty})`
      );

      if (!DRY_RUN) {
        await sequelize.query(
          `UPDATE inventory SET quantity_on_hand = $1, quantity_reserved = $2 WHERE id = $3`,
          { bind: [newOnHand, newReserved, r.inv_id], transaction: t }
        );
      }
      done++;
    }

    if (DRY_RUN) {
      await t.rollback();
      console.log(`\nWould update ${done} record(s).`);
    } else {
      await t.commit();
      console.log(`\nUpdated ${done} record(s).`);
    }
  } catch (e) {
    await t.rollback();
    console.error('Error:', e.message);
    process.exit(1);
  }
  process.exit(0);
}

run();
