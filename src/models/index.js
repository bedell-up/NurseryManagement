const sequelize = require('../config/database');
const Plant = require('./Plant');
const PlantVariant = require('./PlantVariant');
const Inventory = require('./Inventory');
const InventoryLog = require('./InventoryLog');
const Pricing = require('./Pricing');
const Preorder = require('./Preorder');
const DeliveryWindow = require('./DeliveryWindow');
const DeliveryWindowItem = require('./DeliveryWindowItem');
const Spotlight = require('./Spotlight');
const User = require('./User');
const Production = require('./Production');
const ProductionBatchGroup = require('./ProductionBatchGroup');
const TrayType = require('./TrayType');
const VendorSku = require('./VendorSku');
const Vendor = require('./Vendor');
const StorageLocation = require('./StorageLocation');
const InventoryLocationSplit = require('./InventoryLocationSplit');
const SeedLot = require('./SeedLot');
const PlantTypeDefault = require('./PlantTypeDefault');
const PlantType = require('./PlantType');
const LandscapingProject = require('./LandscapingProject');
const LandscapingProjectPlant = require('./LandscapingProjectPlant');
const JobPhoto = require('./JobPhoto');
const Merchandise = require('./Merchandise');
const NurseryOrder = require('./NurseryOrder');
const NurseryOrderItem = require('./NurseryOrderItem');

// Plant -> PlantVariant (one plant, many size/container variants)
Plant.hasMany(PlantVariant, { foreignKey: 'plant_id', as: 'variants' });
PlantVariant.belongsTo(Plant, { foreignKey: 'plant_id', as: 'plant' });

// PlantVariant -> Inventory (one-to-one)
PlantVariant.hasOne(Inventory, { foreignKey: 'variant_id', as: 'inventory' });
Inventory.belongsTo(PlantVariant, { foreignKey: 'variant_id', as: 'variant' });

// PlantVariant -> Pricing (one-to-one)
PlantVariant.hasOne(Pricing, { foreignKey: 'variant_id', as: 'pricing' });
Pricing.belongsTo(PlantVariant, { foreignKey: 'variant_id', as: 'variant' });

// PlantVariant -> Preorders (one variant, many preorders)
PlantVariant.hasMany(Preorder, { foreignKey: 'variant_id', as: 'preorders' });
Preorder.belongsTo(PlantVariant, { foreignKey: 'variant_id', as: 'variant' });

// PlantVariant -> InventoryLog
PlantVariant.hasMany(InventoryLog, { foreignKey: 'variant_id', as: 'inventory_logs' });
InventoryLog.belongsTo(PlantVariant, { foreignKey: 'variant_id', as: 'variant' });

// DeliveryWindow -> DeliveryWindowItems
DeliveryWindow.hasMany(DeliveryWindowItem, { foreignKey: 'delivery_window_id', as: 'items' });
DeliveryWindowItem.belongsTo(DeliveryWindow, { foreignKey: 'delivery_window_id', as: 'delivery_window' });
PlantVariant.hasMany(DeliveryWindowItem, { foreignKey: 'variant_id', as: 'delivery_items' });
DeliveryWindowItem.belongsTo(PlantVariant, { foreignKey: 'variant_id', as: 'variant' });

// Spotlight -> Plant (optional)
Plant.hasMany(Spotlight, { foreignKey: 'plant_id', as: 'spotlights' });
Spotlight.belongsTo(Plant, { foreignKey: 'plant_id', as: 'plant' });

// User -> InventoryLog
User.hasMany(InventoryLog, { foreignKey: 'user_id', as: 'inventory_logs' });
InventoryLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Plant -> Production batches
Plant.hasMany(Production, { foreignKey: 'plant_id', as: 'production_batches' });
Production.belongsTo(Plant, { foreignKey: 'plant_id', as: 'plant' });

// PlantVariant -> Production batches (optional target size)
PlantVariant.hasMany(Production, { foreignKey: 'variant_id', as: 'production_batches' });
Production.belongsTo(PlantVariant, { foreignKey: 'variant_id', as: 'variant' });

// StorageLocation -> Production batches (optional location)
StorageLocation.hasMany(Production, { foreignKey: 'location_id', as: 'production_batches' });
Production.belongsTo(StorageLocation, { foreignKey: 'location_id', as: 'location' });

// ProductionBatchGroup -> Production batches
ProductionBatchGroup.hasMany(Production, { foreignKey: 'group_id', as: 'batches' });
Production.belongsTo(ProductionBatchGroup, { foreignKey: 'group_id', as: 'group' });

// PlantVariant -> VendorSkus (one variant, many vendor-specific SKUs + COGS)
PlantVariant.hasMany(VendorSku, { foreignKey: 'variant_id', as: 'vendor_skus' });
VendorSku.belongsTo(PlantVariant, { foreignKey: 'variant_id', as: 'variant' });

// Inventory -> InventoryLocationSplit
Inventory.hasMany(InventoryLocationSplit, { foreignKey: 'inventory_id', as: 'location_splits' });
InventoryLocationSplit.belongsTo(Inventory, { foreignKey: 'inventory_id', as: 'inventory' });

// Plant -> SeedLots
Plant.hasMany(SeedLot, { foreignKey: 'plant_id', as: 'seed_lots' });
SeedLot.belongsTo(Plant, { foreignKey: 'plant_id', as: 'plant' });

// SeedLot -> Production batches
SeedLot.hasMany(Production, { foreignKey: 'seed_lot_id', as: 'production_batches' });
Production.belongsTo(SeedLot, { foreignKey: 'seed_lot_id', as: 'seed_lot' });

// LandscapingProject -> LandscapingProjectPlant
LandscapingProject.hasMany(LandscapingProjectPlant, { foreignKey: 'project_id', as: 'plants' });
LandscapingProjectPlant.belongsTo(LandscapingProject, { foreignKey: 'project_id', as: 'project' });

// PlantVariant -> LandscapingProjectPlant
PlantVariant.hasMany(LandscapingProjectPlant, { foreignKey: 'variant_id', as: 'landscaping_plants' });
LandscapingProjectPlant.belongsTo(PlantVariant, { foreignKey: 'variant_id', as: 'variant' });

// LandscapingProject -> JobPhoto
LandscapingProject.hasMany(JobPhoto, { foreignKey: 'project_id', as: 'photos' });
JobPhoto.belongsTo(LandscapingProject, { foreignKey: 'project_id', as: 'project' });

// NurseryOrder -> NurseryOrderItems
NurseryOrder.hasMany(NurseryOrderItem, { foreignKey: 'order_id', as: 'items' });
NurseryOrderItem.belongsTo(NurseryOrder, { foreignKey: 'order_id', as: 'order' });

// NurseryOrderItem -> PlantVariant
PlantVariant.hasMany(NurseryOrderItem, { foreignKey: 'variant_id', as: 'nursery_order_items' });
NurseryOrderItem.belongsTo(PlantVariant, { foreignKey: 'variant_id', as: 'variant' });

module.exports = {
  Merchandise,
  NurseryOrder,
  NurseryOrderItem,
  Vendor,
  TrayType,
  SeedLot,
  PlantTypeDefault,
  PlantType,
  sequelize,
  Plant,
  PlantVariant,
  Inventory,
  InventoryLog,
  Pricing,
  Preorder,
  DeliveryWindow,
  DeliveryWindowItem,
  Spotlight,
  User,
  Production,
  ProductionBatchGroup,
  VendorSku,
  StorageLocation,
  InventoryLocationSplit,
  LandscapingProject,
  LandscapingProjectPlant,
  JobPhoto,
};
