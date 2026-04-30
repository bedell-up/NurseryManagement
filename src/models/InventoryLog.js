// Audit trail for all inventory changes
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryLog = sequelize.define('InventoryLog', {
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
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  change_type: {
    type: DataTypes.ENUM('adjustment', 'sale', 'preorder_reserve', 'preorder_release', 'delivery_received', 'damage', 'return', 'shopify_sync', 'count', 'landscaping_transfer'),
    allowNull: false,
    index: true,
  },
  quantity_before: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  quantity_change: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  quantity_after: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  reference_id: {
    // e.g. preorder_id, delivery_window_item_id, shopify_order_id
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  inventory_status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'retail_ready',
  },
}, {
  tableName: 'inventory_logs',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['variant_id'] },
    { fields: ['change_type'] },
    { fields: ['created_at'] },
  ],
});

module.exports = InventoryLog;
