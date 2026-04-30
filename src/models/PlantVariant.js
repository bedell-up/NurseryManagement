// Represents a specific size/container combination of a plant (e.g. 1-gallon, 3-gallon, bare root)
const crypto = require('crypto');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Unambiguous chars (no 0/O, 1/I) for scan-friendly barcodes
const BARCODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateBarcode() {
  const bytes = crypto.randomBytes(8);
  let code = 'BD';
  for (let i = 0; i < 8; i++) code += BARCODE_CHARS[bytes[i] % BARCODE_CHARS.length];
  return code;
}

const PlantVariant = sequelize.define('PlantVariant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  plant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plants', key: 'id' },
    index: true,
  },
  container_size: {
    // e.g. "1 gallon", "3 gallon", "bare root", "plug", "#5"
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  sku: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    index: true,
  },
  barcode: {
    // Internal scan identifier — auto-generated, stable, never user-facing in edit forms.
    // Format: BD + 8 unambiguous alphanumeric chars (e.g. BDKP73RNXA). Encodable as Code 128 or QR.
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    index: true,
  },
  shopify_variant_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    index: true,
  },
  shopify_inventory_item_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    index: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'plant_variants',
  timestamps: true,
  underscored: true,
});

PlantVariant.addHook('beforeCreate', (variant) => {
  if (!variant.barcode) variant.barcode = generateBarcode();
});

module.exports = PlantVariant;
