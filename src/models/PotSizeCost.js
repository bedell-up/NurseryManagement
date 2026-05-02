const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PotSizeCost = sequelize.define('PotSizeCost', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  label: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  retail_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  wholesale_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  plant_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
}, {
  tableName: 'pot_size_costs',
  underscored: true,
  indexes: [
    { fields: ['sort_order'] },
  ],
});

module.exports = PotSizeCost;
