const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SeedLot = sequelize.define('SeedLot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  plant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plants', key: 'id' },
  },
  sourced_from: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  qty_per_gram: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  seed_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  quantity_grams: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0,
  },
  sourced_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'seed_lots',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['plant_id'] }],
});

module.exports = SeedLot;
