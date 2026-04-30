const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LandscapingProjectPlant = sequelize.define('LandscapingProjectPlant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'landscaping_projects', key: 'id' },
  },
  variant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plant_variants', key: 'id' },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  install_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('planned', 'installed', 'removed'),
    defaultValue: 'planned',
    allowNull: false,
  },
  location_note: {
    // Specific spot or area within the project
    type: DataTypes.STRING(300),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'landscaping_project_plants',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['project_id'] },
    { fields: ['variant_id'] },
  ],
});

module.exports = LandscapingProjectPlant;
