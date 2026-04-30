/**
 * One-time backfill: generate barcode values for any plant_variants rows
 * that were created before the barcode column was added.
 *
 * Usage: node scripts/backfill-barcodes.js
 */

require('dotenv').config();
const crypto = require('crypto');
const sequelize = require('../src/config/database');

const BARCODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateBarcode() {
  const bytes = crypto.randomBytes(8);
  let code = 'BD';
  for (let i = 0; i < 8; i++) code += BARCODE_CHARS[bytes[i] % BARCODE_CHARS.length];
  return code;
}

async function run() {
  await sequelize.authenticate();
  console.log('Connected to database.');

  const [rows] = await sequelize.query(
    `SELECT id FROM plant_variants WHERE barcode IS NULL ORDER BY created_at`
  );

  if (rows.length === 0) {
    console.log('All variants already have barcodes. Nothing to do.');
    await sequelize.close();
    return;
  }

  console.log(`Backfilling barcodes for ${rows.length} variant(s)...`);

  let success = 0;
  for (const row of rows) {
    let barcode;
    let attempts = 0;
    // Retry on the rare chance of a collision
    while (attempts < 10) {
      barcode = generateBarcode();
      const [[existing]] = await sequelize.query(
        `SELECT id FROM plant_variants WHERE barcode = :barcode LIMIT 1`,
        { replacements: { barcode } }
      );
      if (!existing) break;
      attempts++;
    }
    await sequelize.query(
      `UPDATE plant_variants SET barcode = :barcode WHERE id = :id`,
      { replacements: { barcode, id: row.id } }
    );
    success++;
    if (success % 50 === 0) console.log(`  ${success}/${rows.length} done...`);
  }

  console.log(`Done. ${success} barcode(s) assigned.`);
  await sequelize.close();
}

run().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
