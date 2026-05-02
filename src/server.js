require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');

    // Extend enum types before sync (ALTER TYPE cannot run inside a transaction)
    await sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_inventory_logs_change_type') THEN
          ALTER TYPE "enum_inventory_logs_change_type" ADD VALUE IF NOT EXISTS 'landscaping_transfer';
          ALTER TYPE "enum_inventory_logs_change_type" ADD VALUE IF NOT EXISTS 'location_transfer';
        END IF;
      END $$;
    `).catch(() => {});

    // Convert plants.plant_type from ENUM to VARCHAR to allow dynamic types
    await sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'plants' AND column_name = 'plant_type' AND data_type = 'USER-DEFINED'
        ) THEN
          ALTER TABLE plants ALTER COLUMN plant_type TYPE VARCHAR(50) USING plant_type::text;
        END IF;
      END $$;
    `).catch(() => {});

    // Sync models — use migrations in production
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Models synced');

    // Seed default pot size pricing if table is empty
    await sequelize.query(`
      INSERT INTO pot_size_costs (id, label, retail_price, wholesale_price, sort_order, created_at, updated_at)
      SELECT gen_random_uuid(), t.label, t.retail, t.wholesale, t.sort_order, NOW(), NOW()
      FROM (VALUES
        ('2⅜" Bandpot',       6.00,  NULL,  1),
        ('2¾" Bandpot',       7.00,  NULL,  2),
        ('3.5" Container',    7.00,  NULL,  3),
        ('4" Band',           7.00,  NULL,  4),
        ('4" Tall Band',      NULL,  NULL,  5),
        ('Qt (Quart)',         NULL,  NULL,  6),
        ('1 gal Grass',      12.00,  NULL,  7),
        ('1 gal Tree/Shrub', 15.00,  NULL,  8)
      ) AS t(label, retail, wholesale, sort_order)
      WHERE NOT EXISTS (SELECT 1 FROM pot_size_costs LIMIT 1);
    `).catch(() => {});

    // Seed default plant types if none exist yet
    await sequelize.query(`
      INSERT INTO plant_types (id, name, label, sort_order, is_active, created_at, updated_at)
      SELECT gen_random_uuid(), t.name, t.label, t.sort_order, true, NOW(), NOW()
      FROM (VALUES
        ('tree',                'Tree',                1),
        ('shrub',               'Shrub',               2),
        ('perennial',           'Perennial',           3),
        ('annual',              'Annual',              4),
        ('graminoid',           'Graminoid',           5),
        ('fern',                'Fern',                6),
        ('vine',                'Vine',                7),
        ('groundcover',         'Groundcover',         8),
        ('bulb',                'Bulb',                9),
        ('aquatic',             'Aquatic',            10),
        ('perennial_vegetable', 'Perennial Vegetable',11),
        ('other',               'Other',              12)
      ) AS t(name, label, sort_order)
      ON CONFLICT (name) DO NOTHING;
    `).catch(() => {});

    // Set up full-text search trigger
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS plants_search_vector_gin
      ON plants USING GIN(search_vector);
    `).catch(() => {});

    app.listen(PORT, () => {
      console.log(`Natives API running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
