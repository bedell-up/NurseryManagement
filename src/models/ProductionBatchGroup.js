const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductionBatchGroup = sequelize.define('ProductionBatchGroup', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'archived'),
    allowNull: false,
    defaultValue: 'active',
  },
  date_started: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'production_batch_groups',
  timestamps: true,
  underscored: true,
});

module.exports = ProductionBatchGroup;
