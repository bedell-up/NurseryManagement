const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryLocationSplit = sequelize.define('InventoryLocationSplit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  inventory_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'inventory', key: 'id' },
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
}, {
  tableName: 'inventory_location_splits',
  underscored: true,
  indexes: [
    { unique: true, fields: ['inventory_id', 'location'] },
  ],
});

module.exports = InventoryLocationSplit;
