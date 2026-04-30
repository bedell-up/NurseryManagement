require('dotenv').config();
const { Plant, PlantVariant, sequelize } = require('../src/models');
const { generateSku } = require('../src/utils/sku');

async function run() {
  await sequelize.authenticate();

  const variants = await PlantVariant.findAll({
    include: [{ model: Plant, as: 'plant' }],
  });

  const seen = new Map();
  let updated = 0;
  const conflicts = [];

  for (const variant of variants) {
    const plant = variant.plant;
    if (!plant) {
      console.warn(`Variant ${variant.id} has no associated plant — skipping`);
      continue;
    }

    let sku = generateSku(plant.genus, plant.species, variant.container_size);
    if (!sku) {
      console.warn(`Could not generate SKU for variant ${variant.id} (${plant.scientific_name} / ${variant.container_size})`);
      continue;
    }

    // Deduplicate: append -2, -3, etc. for collisions within this run
    const base = sku;
    let counter = 1;
    while (seen.has(sku)) {
      counter++;
      sku = `${base}-${counter}`;
    }
    if (counter > 1) {
      conflicts.push({ sku: base, resolved: sku, plant: plant.scientific_name, size: variant.container_size });
    }
    seen.set(sku, variant.id);

    await variant.update({ sku });
    updated++;
  }

  console.log(`\nUpdated ${updated} variant SKUs.`);
  if (conflicts.length) {
    console.log('\nCollisions resolved with numeric suffix:');
    conflicts.forEach(c => console.log(`  ${c.plant} (${c.size}): ${c.sku} → ${c.resolved}`));
  }

  await sequelize.close();
}

run().catch(err => { console.error(err); process.exit(1); });
