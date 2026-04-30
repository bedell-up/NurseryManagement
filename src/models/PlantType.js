const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlantType = sequelize.define('PlantType', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  label: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
}, {
  tableName: 'plant_types',
  underscored: true,
  timestamps: true,
  indexes: [
    { unique: true, fields: ['name'] },
  ],
});

module.exports = PlantType;
