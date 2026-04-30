const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VendorSku = sequelize.define('VendorSku', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  variant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plant_variants', key: 'id' },
    onDelete: 'CASCADE',
  },
  vendor_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  vendor_code: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  sku: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'vendor_skus',
  underscored: true,
  indexes: [
    { fields: ['variant_id'] },
    { unique: true, fields: ['variant_id', 'vendor_code'] },
  ],
});

module.exports = VendorSku;
