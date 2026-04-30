const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LandscapingProject = sequelize.define('LandscapingProject', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('in_ground', 'landscaping_job'),
    defaultValue: 'landscaping_job',
    allowNull: false,
  },
  client_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING(300),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('planned', 'active', 'completed', 'cancelled'),
    defaultValue: 'active',
    allowNull: false,
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  lat: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  lng: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
}, {
  tableName: 'landscaping_projects',
  timestamps: true,
  underscored: true,
});

module.exports = LandscapingProject;
