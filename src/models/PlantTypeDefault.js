const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlantTypeDefault = sequelize.define('PlantTypeDefault', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  plant_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  default_tray_types: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true,
    defaultValue: [],
  },
  default_pot_sizes: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true,
    defaultValue: [],
  },
}, {
  tableName: 'plant_type_defaults',
  underscored: true,
  timestamps: true,
  indexes: [{ unique: true, fields: ['plant_type'] }],
});

module.exports = PlantTypeDefault;
