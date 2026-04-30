// Delivery windows define when a batch of plants is expected to be available
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryWindow = sequelize.define('DeliveryWindow', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    // e.g. "Spring 2025 Batch 1", "Fall Pre-Order Wave"
  },
  expected_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    index: true,
  },
  confirmed_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('planned', 'ordered', 'in_transit', 'arrived', 'cancelled'),
    defaultValue: 'planned',
    index: true,
  },
  supplier_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_visible_to_customers: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'delivery_windows',
  timestamps: true,
  underscored: true,
});

module.exports = DeliveryWindow;
