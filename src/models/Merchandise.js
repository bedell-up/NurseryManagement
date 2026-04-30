const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Merchandise = sequelize.define('Merchandise', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  sku: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  supplier: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  quantity_on_hand: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  reorder_threshold: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
}, {
  tableName: 'merchandise',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['category'] },
    { fields: ['active'] },
    { fields: ['sku'] },
  ],
});

module.exports = Merchandise;
