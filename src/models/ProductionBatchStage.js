const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductionBatchStage = sequelize.define('ProductionBatchStage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  batch_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'production_batches', key: 'id' },
  },
  // potted = moved to individual containers
  // tray   = still in germination tray (explicit snapshot)
  // loss   = died / culled / failed
  stage: {
    type: DataTypes.ENUM('potted', 'tray', 'loss'),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'production_batch_stages',
  underscored: true,
  indexes: [
    { fields: ['batch_id'] },
    { fields: ['date'] },
  ],
});

module.exports = ProductionBatchStage;
