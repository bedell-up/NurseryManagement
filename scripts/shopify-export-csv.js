/**
 * shopify-export-csv.js
 *
 * Exports in-stock plants (qty >= 2) as a Shopify product import CSV.
 * Import the output file via: Shopify Admin → Products → Import.
 *
 * Usage:
 *   node scripts/shopify-export-csv.js                  # writes shopify-import.csv
 *   node scripts/shopify-export-csv.js --min-qty 1      # include qty >= 1
 *   node scripts/shopify-export-csv.js --out my.csv     # custom filename
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Plant, PlantVariant, Inventory, Pricing, sequelize } = require('../src/models');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const minQtyIdx = args.indexOf('--min-qty');
const MIN_QTY   = minQtyIdx !== -1 ? parseInt(args[minQtyIdx + 1], 10) : 2;
const outIdx    = args.indexOf('--out');
const OUT_FILE  = outIdx !== -1 ? args[outIdx + 1] : 'shopify-import.csv';

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function csvCell(val) {
  const s = val == null ? '' : String(val);
  // Wrap in quotes if it contains comma, quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

// Shopify CSV column headers (exact order from product_template.csv)
const HEADERS = [
  'Title', 'URL handle', 'Description', 'Vendor', 'Product category', 'Type', 'Tags',
  'Published on online store', 'Status',
  'SKU', 'Barcode',
  'Option1 name', 'Option1 value', 'Option1 Linked To',
  'Option2 name', 'Option2 value', 'Option2 Linked To',
  'Option3 name', 'Option3 value', 'Option3 Linked To',
  'Price', 'Compare-at price', 'Cost per item',
  'Charge tax', 'Tax code',
  'Unit price total measure', 'Unit price total measure unit',
  'Unit price base measure', 'Unit price base measure unit',
  'Inventory tracker', 'Inventory quantity', 'Continue selling when out of stock',
  'Weight value (grams)', 'Weight unit for display',
  'Requires shipping', 'Fulfillment service',
  'Product image URL', 'Image position', 'Image alt text',
  'Variant image URL', 'Gift card',
  'SEO title', 'SEO description',
  'Color (product.metafields.shopify.color-pattern)',
  'Google Shopping / Google product category',
  'Google Shopping / Gender', 'Google Shopping / Age group',
  'Google Shopping / Manufacturer part number (MPN)',
  'Google Shopping / Ad group name', 'Google Shopping / Ads labels',
  'Google Shopping / Condition', 'Google Shopping / Custom product',
  'Google Shopping / Custom label 0', 'Google Shopping / Custom label 1',
  'Google Shopping / Custom label 2', 'Google Shopping / Custom label 3',
  'Google Shopping / Custom label 4',
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Querying plants with qty >= ${MIN_QTY}…`);

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
            where: sequelize.literal(
              `"variants->inventory"."quantity_on_hand" - "variants->inventory"."quantity_reserved" >= ${MIN_QTY}`
            ),
            required: true,
          },
          { model: Pricing, as: 'pricing', required: false },
        ],
      },
    ],
    order: [['common_name', 'ASC']],
  });

  console.log(`Found ${plants.length} plants.`);

  const rows = [HEADERS.map(h => h)]; // header row (no quoting needed)

  for (const plant of plants) {
    // Only eligible variants (in case Sequelize returns extras)
    const variants = plant.variants.filter(v => {
      const avail = (v.inventory?.quantity_on_hand ?? 0) - (v.inventory?.quantity_reserved ?? 0);
      return avail >= MIN_QTY;
    });
    if (!variants.length) continue;

    const multiSize = variants.length > 1;
    const handle    = slugify(plant.common_name);
    const vendor    = 'Bloomsday Natives';
    const tags      = [
      plant.native_region,
      plant.plant_type,
      plant.bloom_color,
      plant.attracts_pollinators ? 'pollinator' : null,
      plant.attracts_birds       ? 'bird-friendly' : null,
      plant.deer_resistant       ? 'deer-resistant' : null,
    ].filter(Boolean).join(', ');

    variants.forEach((variant, idx) => {
      const isFirst  = idx === 0;
      const price    = variant.pricing?.retail_price    ?? '';
      const salePrice = variant.pricing?.sale_price     ?? '';
      const cost     = variant.pricing?.cost            ?? '';
      const available = (variant.inventory?.quantity_on_hand ?? 0) - (variant.inventory?.quantity_reserved ?? 0);

      const cells = [
        /* Title */                 isFirst ? plant.common_name : '',
        /* URL handle */            handle,
        /* Description */           isFirst ? (plant.description || '') : '',
        /* Vendor */                isFirst ? vendor : '',
        /* Product category */      '',
        /* Type */                  isFirst ? (plant.plant_type || 'Plant') : '',
        /* Tags */                  isFirst ? tags : '',
        /* Published */             isFirst ? 'TRUE' : '',
        /* Status */                isFirst ? 'active' : '',
        /* SKU */                   variant.sku || '',
        /* Barcode */               variant.barcode || '',
        /* Option1 name */          multiSize ? (isFirst ? 'Size' : '') : '',
        /* Option1 value */         multiSize ? variant.container_size : '',
        /* Option1 Linked To */     '',
        /* Option2 name */          '',
        /* Option2 value */         '',
        /* Option2 Linked To */     '',
        /* Option3 name */          '',
        /* Option3 value */         '',
        /* Option3 Linked To */     '',
        /* Price */                 salePrice || price,
        /* Compare-at price */      salePrice ? price : '',
        /* Cost per item */         cost,
        /* Charge tax */            'TRUE',
        /* Tax code */              '',
        /* Unit price total */      '',
        /* Unit price total unit */ '',
        /* Unit price base */       '',
        /* Unit price base unit */  '',
        /* Inventory tracker */     'shopify',
        /* Inventory quantity */    available,
        /* Continue selling */      'DENY',
        /* Weight (g) */            '',
        /* Weight unit */           '',
        /* Requires shipping */     'TRUE',
        /* Fulfillment service */   'manual',
        /* Product image URL */     isFirst && plant.image_url ? plant.image_url : '',
        /* Image position */        isFirst && plant.image_url ? '1' : '',
        /* Image alt text */        isFirst && plant.image_url ? plant.common_name : '',
        /* Variant image URL */     '',
        /* Gift card */             'FALSE',
        /* SEO title */             '',
        /* SEO description */       '',
        /* Color metafield */       '',
        /* G Shopping category */   '',
        /* G Shopping gender */     '',
        /* G Shopping age */        '',
        /* G Shopping MPN */        '',
        /* G Shopping ad group */   '',
        /* G Shopping labels */     '',
        /* G Shopping condition */  '',
        /* G Shopping custom */     '',
        /* G label 0 */             '',
        /* G label 1 */             '',
        /* G label 2 */             '',
        /* G label 3 */             '',
        /* G label 4 */             '',
      ];

      rows.push(cells);
    });
  }

  const csv     = rows.map(csvRow).join('\n');
  const outPath = path.resolve(process.cwd(), OUT_FILE);
  fs.writeFileSync(outPath, csv, 'utf8');

  const variantCount = rows.length - 1; // subtract header
  console.log(`\nExported ${variantCount} variant rows for ${plants.length} plants.`);
  console.log(`File: ${outPath}`);
  console.log('\nNext: Shopify Admin → Products → Import → upload this file.');
  await sequelize.close();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  sequelize.close();
  process.exit(1);
});
