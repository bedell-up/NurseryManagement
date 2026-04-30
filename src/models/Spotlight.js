// Featured plant or project spotlights — the "clock elements" for highlighting
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Spotlight = sequelize.define('Spotlight', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM('plant', 'project', 'sale', 'announcement'),
    allowNull: false,
    defaultValue: 'plant',
    index: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  subtitle: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  // Optional link to a plant
  plant_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'plants', key: 'id' },
  },
  // Countdown / expiry timer
  countdown_label: {
    // e.g. "Available for", "Pre-order ends in", "Sale ends in"
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  countdown_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
    index: true,
  },
  // Display scheduling
  display_start_at: {
    type: DataTypes.DATE,
    allowNull: true,
    index: true,
  },
  display_end_at: {
    type: DataTypes.DATE,
    allowNull: true,
    index: true,
  },
  display_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    index: true,
  },
  cta_text: {
    // Call to action button label
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  cta_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'spotlights',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['is_active'] },
    { fields: ['display_order'] },
    { fields: ['countdown_ends_at'] },
    { fields: ['display_start_at', 'display_end_at'] },
  ],
});

module.exports = Spotlight;
