// Links specific plant variants to a delivery window with expected quantities
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryWindowItem = sequelize.define('DeliveryWindowItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  delivery_window_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'delivery_windows', key: 'id' },
    index: true,
  },
  variant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plant_variants', key: 'id' },
    index: true,
  },
  quantity_expected: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  quantity_received: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'delivery_window_items',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['delivery_window_id'] },
    { fields: ['variant_id'] },
  ],
});

module.exports = DeliveryWindowItem;
