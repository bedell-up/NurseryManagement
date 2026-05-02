const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VendorOrder = sequelize.define('VendorOrder', {
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
  vendor_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'vendors', key: 'id' },
    onDelete: 'RESTRICT',
  },
  status: {
    type: DataTypes.ENUM('draft', 'ordered', 'received', 'cancelled'),
    defaultValue: 'draft',
    allowNull: false,
  },
  order_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  expected_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  received_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL',
  },
}, {
  tableName: 'vendor_orders',
  underscored: true,
});

// Auto-assign sequential order_number before creation
VendorOrder.addHook('beforeCreate', async (order) => {
  const max = await VendorOrder.max('order_number');
  order.order_number = (max || 0) + 1;
});

module.exports = VendorOrder;
