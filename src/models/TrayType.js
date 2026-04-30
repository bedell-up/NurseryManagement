const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TrayType = sequelize.define('TrayType', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('tray', 'pot'),
    allowNull: false,
    defaultValue: 'tray',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  sku_code: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  cell_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'tray_types',
  underscored: true,
  timestamps: true,
  indexes: [
    { unique: true, fields: ['name', 'category'] },
  ],
});

module.exports = TrayType;
