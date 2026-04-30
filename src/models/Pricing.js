const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pricing = sequelize.define('Pricing', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  variant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plant_variants', key: 'id' },
    index: true,
  },
  retail_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  sale_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  cost: {
    // Internal cost — not exposed via public API
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  wholesale_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  preorder_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  sale_starts_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sale_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
  },
  shopify_synced_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'pricing',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['variant_id'] },
  ],
});

module.exports = Pricing;
