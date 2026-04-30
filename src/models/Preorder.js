const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Preorder = sequelize.define('Preorder', {
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
  customer_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  customer_email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    index: true,
  },
  customer_phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'ready', 'fulfilled', 'cancelled'),
    defaultValue: 'pending',
    index: true,
  },
  deposit_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  deposit_paid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  shopify_order_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    index: true,
  },
  estimated_availability_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'preorders',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['customer_email'] },
    { fields: ['variant_id'] },
    { fields: ['shopify_order_id'] },
    { fields: ['estimated_availability_date'] },
  ],
});

module.exports = Preorder;
