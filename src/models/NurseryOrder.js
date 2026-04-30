const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NurseryOrder = sequelize.define('NurseryOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  order_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  customer_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  customer_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  customer_phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft',
    validate: { isIn: [['draft', 'confirmed', 'fulfilled', 'cancelled']] },
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fulfilled_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  fulfilled_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
}, {
  tableName: 'nursery_orders',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['created_at'] },
  ],
});

module.exports = NurseryOrder;
