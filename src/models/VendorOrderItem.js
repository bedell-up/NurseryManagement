const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VendorOrderItem = sequelize.define('VendorOrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'vendor_orders', key: 'id' },
    onDelete: 'CASCADE',
  },
  variant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plant_variants', key: 'id' },
    onDelete: 'RESTRICT',
  },
  quantity_ordered: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  quantity_received: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  unit_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'vendor_order_items',
  underscored: true,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['variant_id'] },
  ],
});

module.exports = VendorOrderItem;
