const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vendor = sequelize.define('Vendor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
  },
  contact_person: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'vendors',
  underscored: true,
  indexes: [
    { unique: true, fields: ['code'] },
  ],
});

module.exports = Vendor;
