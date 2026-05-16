const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Plant = sequelize.define('Plant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Taxonomy
  common_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    index: true,
  },
  scientific_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    index: true,
  },
  genus: {
    type: DataTypes.STRING(100),
    allowNull: true,
    index: true,
  },
  species: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  cultivar: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  family: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  // Classification
  plant_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    index: true,
  },
  native_region: {
    type: DataTypes.STRING(255),
    allowNull: true,
    index: true,
  },
  // Characteristics
  sun_requirements: {
    type: DataTypes.ENUM('full_sun', 'part_shade', 'partial_shade_to_shade', 'full_shade', 'sun_to_part_shade'),
    allowNull: true,
  },
  water_requirements: {
    type: DataTypes.ENUM('dry', 'medium', 'wet', 'wet_to_medium', 'dry_to_medium'),
    allowNull: true,
  },
  soil_type: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  bloom_time: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  bloom_color: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  mature_height_min_ft: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  mature_height_max_ft: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  mature_width_min_ft: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  mature_width_max_ft: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  hardiness_zone_min: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  hardiness_zone_max: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  // Wildlife value
  attracts_pollinators: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  attracts_birds: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  attracts_butterflies: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  deer_resistant: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Spreadsheet-specific attributes
  plant_code: {
    // 2-letter nursery code (e.g. "Jp", "Am")
    type: DataTypes.STRING(10),
    allowNull: true,
    index: true,
  },
  is_edible: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_medicinal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_pet_friendly: {
    type: DataTypes.BOOLEAN,
    allowNull: true,   // null = unknown
  },
  is_fire_resistant: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  bouquet_use: {
    // What parts work for cut flowers/foliage (e.g. "Blooms,Foliage", "-")
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  usda_profile_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  gbif_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  more_info_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  portland_plant_list: {
    // Whether it's on the Portland Approved Plant List
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  // Info
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  landscape_use: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  seeds_per_gram: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  // Shopify sync
  shopify_product_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    index: true,
  },
  shopify_synced_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Status
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    index: true,
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    index: true,
  },
  // Full-text search vector (populated via trigger)
  search_vector: {
    type: DataTypes.TSVECTOR,
    allowNull: true,
  },
}, {
  tableName: 'plants',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['common_name'] },
    { fields: ['scientific_name'] },
    { fields: ['genus'] },
    { fields: ['plant_type'] },
    { fields: ['native_region'] },
    { fields: ['is_active'] },
    { fields: ['is_featured'] },
    { fields: ['shopify_product_id'] },
    { type: 'FULLTEXT', fields: ['search_vector'], using: 'GIN', name: 'plants_search_vector_idx' },
  ],
});

module.exports = Plant;
