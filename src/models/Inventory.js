const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  variant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'plant_variants', key: 'id' },
    index: true,
  },
  quantity_on_hand: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  quantity_reserved: {
    // Reserved for preorders
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  quantity_available: {
    // Computed: on_hand - reserved
    type: DataTypes.VIRTUAL,
    get() {
      return (this.quantity_on_hand || 0) - (this.quantity_reserved || 0);
    },
  },
quantity_incoming: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
},
availability_label: {
  type: DataTypes.STRING(100),
  allowNull: true,
},
availability_date: {
  type: DataTypes.DATE,
  allowNull: true,
},
reorder_threshold: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
},
  reorder_threshold: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  location: {
    // Physical nursery location / section
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  inventory_status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'retail_ready',
    validate: {
      isIn: [['retail_ready', 'just_potted', 'available_soon', 'on_hold', 'damaged']],
    },
  },
  last_counted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'inventory',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['variant_id'] },
  ],
});

module.exports = Inventory;
