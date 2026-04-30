const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JobPhoto = sequelize.define('JobPhoto', {
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
  filename: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  original_name: {
    type: DataTypes.STRING(300),
    allowNull: true,
  },
  caption: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  mime_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  uploaded_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
}, {
  tableName: 'job_photos',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['project_id'] }],
});

module.exports = JobPhoto;
