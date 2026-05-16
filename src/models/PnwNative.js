const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PnwNative = sequelize.define('PnwNative', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  scientific_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  common_name:    { type: DataTypes.STRING(255), allowNull: true },
  category:       { type: DataTypes.STRING(100), allowNull: true },  // Conifer, Broadleaved Tree, Shrub, Wildflower, Fern, Grass, Sedge, Rush, Vine
  family:         { type: DataTypes.STRING(100), allowNull: true },
  sun:            { type: DataTypes.STRING(100), allowNull: true },
  moisture:       { type: DataTypes.STRING(100), allowNull: true },
  height:         { type: DataTypes.STRING(100), allowNull: true },
  region:         { type: DataTypes.STRING(255), allowNull: true },  // Westside, Eastside, Both, Coast, etc.
  habitat:        { type: DataTypes.TEXT,        allowNull: true },
  wildlife_value: { type: DataTypes.TEXT,        allowNull: true },
  notes:          { type: DataTypes.TEXT,        allowNull: true },
}, {
  tableName: 'pnw_natives',
  underscored: true,
  indexes: [
    { unique: true, fields: ['scientific_name'] },
    { fields: ['category'] },
    { fields: ['family'] },
  ],
});

module.exports = PnwNative;
