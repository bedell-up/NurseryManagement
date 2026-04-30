const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StorageLocation = sequelize.define('StorageLocation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  shopify_location_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'storage_locations',
  underscored: true,
  indexes: [
    { unique: true, fields: ['name'] },
  ],
});

module.exports = StorageLocation;
