const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NurseryOrderItem = sequelize.define('NurseryOrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'nursery_orders', key: 'id' },
  },
  variant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plant_variants', key: 'id' },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
}, {
  tableName: 'nursery_order_items',
  timestamps: true,
  underscored: true,
});

module.exports = NurseryOrderItem;
