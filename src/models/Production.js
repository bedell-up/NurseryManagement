const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Production = sequelize.define('Production', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  plant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plants', key: 'id' },
    index: true,
  },
  // Target container size (optional — may not know yet when starting seeds)
  variant_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'plant_variants', key: 'id' },
  },
  propagation_type: {
    type: DataTypes.ENUM('seed', 'cutting', 'division', 'layering', 'grafting', 'other'),
    allowNull: false,
    defaultValue: 'seed',
  },
  // Where the seed or plant material came from
  source_description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Seeds sown / cuttings taken / divisions made
  quantity_started: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  // Germinated / rooted successfully (updated over time)
  quantity_successful: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // How many healthy plants we're aiming to finish with
  quantity_target: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  date_started: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  germination_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  estimated_ready_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'active',
  },
  location_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'storage_locations', key: 'id' },
  },
  group_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'production_batch_groups', key: 'id' },
  },
  substrate_type: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tray_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  pot_size: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  seed_lot_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'seed_lots', key: 'id' },
  },
  seeds_used_g: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
  },
  seeds_used_unit: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'production_batches',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['plant_id'] },
    { fields: ['status'] },
    { fields: ['date_started'] },
  ],
});

module.exports = Production;
