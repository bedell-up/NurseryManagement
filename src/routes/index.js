const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// File upload config — spreadsheets
const storage = multer.diskStorage({
  destination: 'uploads/spreadsheets/',
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// File upload config — job photos
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/job-photos';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Controllers
const authCtrl = require('../controllers/authController');
const plantCtrl = require('../controllers/plantController');
const inventoryCtrl = require('../controllers/inventoryController');
const pricingCtrl = require('../controllers/pricingController');
const preorderCtrl = require('../controllers/preorderController');
const deliveryCtrl = require('../controllers/deliveryController');
const spotlightCtrl = require('../controllers/spotlightController');
const importCtrl = require('../controllers/importController');
const shopifyCtrl = require('../controllers/shopifyController');
const inatCtrl = require('../controllers/iNaturalistController');
const productionCtrl = require('../controllers/productionController');
const productionGroupCtrl = require('../controllers/productionGroupController');
const productionStageCtrl = require('../controllers/productionStageController');
const usdaCtrl = require('../controllers/usdaController');
const variantCtrl = require('../controllers/variantController');
const vendorSkuCtrl = require('../controllers/vendorSkuController');
const skuCtrl = require('../controllers/skuController');
const skuGeneratorCtrl = require('../controllers/skuGeneratorController');
const vendorCtrl = require('../controllers/vendorController');
const locationCtrl = require('../controllers/locationController');
const trayTypeCtrl = require('../controllers/trayTypeController');
const seedLotCtrl = require('../controllers/seedLotController');
const userCtrl = require('../controllers/userController');
const plantTypeDefaultCtrl = require('../controllers/plantTypeDefaultController');
const plantTypeCtrl = require('../controllers/plantTypeController');
const landscapingCtrl = require('../controllers/landscapingController');
const jobPhotoCtrl    = require('../controllers/jobPhotoController');
const scanCtrl        = require('../controllers/scanController');
const merchandiseCtrl    = require('../controllers/merchandiseController');
const nurseryOrderCtrl   = require('../controllers/nurseryOrderController');
const vendorOrderCtrl    = require('../controllers/vendorOrderController');
const potSizeCostCtrl    = require('../controllers/potSizeCostController');

// --- Auth ---
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.me);

// --- Users (admin only) ---
router.get('/users', authenticate, requireRole('admin'), userCtrl.list);
router.post('/users', authenticate, requireRole('admin'), userCtrl.create);
router.put('/users/:id', authenticate, requireRole('admin'), userCtrl.update);
router.delete('/users/:id', authenticate, requireRole('admin'), userCtrl.remove);

// --- Plant Types (dynamic, user-managed) ---
router.get('/plant-types', authenticate, plantTypeCtrl.list);
router.post('/plant-types', authenticate, requireRole('admin', 'manager'), plantTypeCtrl.create);
router.put('/plant-types/:id', authenticate, requireRole('admin', 'manager'), plantTypeCtrl.update);
router.delete('/plant-types/:id', authenticate, requireRole('admin', 'manager'), plantTypeCtrl.remove);

// --- Plant Type Defaults ---
router.get('/plant-type-defaults', authenticate, plantTypeDefaultCtrl.list);
router.put('/plant-type-defaults/:plant_type', authenticate, requireRole('admin', 'manager'), plantTypeDefaultCtrl.upsert);

// --- Plants (public read, protected write) ---
router.get('/plants/usda-lookup', authenticate, usdaCtrl.lookup);
router.get('/plants/duplicates', authenticate, requireRole('admin', 'manager'), plantCtrl.duplicates);
router.post('/plants/merge', authenticate, requireRole('admin', 'manager'), plantCtrl.merge);
router.get('/plants', plantCtrl.list);
router.get('/plants/:id', plantCtrl.get);
router.post('/plants', authenticate, requireRole('admin', 'manager'), plantCtrl.create);
router.put('/plants/:id', authenticate, requireRole('admin', 'manager'), plantCtrl.update);
router.post('/plants/bulk-delete', authenticate, requireRole('admin'), plantCtrl.bulkRemove);
router.delete('/plants/:id', authenticate, requireRole('admin'), plantCtrl.remove);

// --- Inventory ---
router.get('/inventory/barcode-sheet', authenticate, inventoryCtrl.barcodeSheet);
router.get('/inventory/count-report/users', authenticate, inventoryCtrl.countReportUsers);
router.get('/inventory/count-report', authenticate, inventoryCtrl.countReport);
router.get('/inventory/without-location', authenticate, inventoryCtrl.withoutLocation);
router.post('/inventory/transfer', authenticate, requireRole('admin', 'manager', 'staff'), inventoryCtrl.transfer);
router.get('/inventory', authenticate, inventoryCtrl.list);
router.post('/inventory/adjust', authenticate, requireRole('admin', 'manager', 'staff'), inventoryCtrl.adjust);
router.post('/inventory/count', authenticate, requireRole('admin', 'manager', 'staff'), inventoryCtrl.bulkCount);
router.patch('/inventory/:id', authenticate, requireRole('admin', 'manager', 'staff'), inventoryCtrl.update);
router.put('/inventory/:id/location-splits', authenticate, requireRole('admin', 'manager', 'staff'), inventoryCtrl.setLocationSplits);
router.post('/inventory/:variant_id/sync-shopify', authenticate, requireRole('admin', 'manager'), inventoryCtrl.syncToShopify);

// --- Pricing ---
router.get('/pricing', authenticate, pricingCtrl.list);
router.put('/pricing/:variant_id', authenticate, requireRole('admin', 'manager'), pricingCtrl.update);
router.post('/pricing/bulk-update', authenticate, requireRole('admin', 'manager'), pricingCtrl.bulkUpdate);
router.post('/pricing/backfill', authenticate, requireRole('admin', 'manager'), pricingCtrl.backfill);
router.post('/pricing/sync-shopify', authenticate, requireRole('admin', 'manager'), pricingCtrl.syncAllToShopify);

// --- Preorders ---
router.get('/preorders', authenticate, preorderCtrl.list);
router.get('/preorders/:id', authenticate, preorderCtrl.get);
router.post('/preorders', authenticate, requireRole('admin', 'manager', 'staff'), preorderCtrl.create);
router.patch('/preorders/:id/status', authenticate, requireRole('admin', 'manager'), preorderCtrl.updateStatus);

// --- Delivery Windows ---
router.get('/deliveries', authenticate, deliveryCtrl.list);
router.get('/deliveries/:id', authenticate, deliveryCtrl.get);
router.post('/deliveries', authenticate, requireRole('admin', 'manager'), deliveryCtrl.create);
router.put('/deliveries/:id', authenticate, requireRole('admin', 'manager'), deliveryCtrl.update);
router.post('/deliveries/:id/arrived', authenticate, requireRole('admin', 'manager'), deliveryCtrl.markArrived);

// --- Spotlights (public read, protected write) ---
router.get('/spotlights', spotlightCtrl.listActive);
router.get('/spotlights/all', authenticate, spotlightCtrl.listAll);
router.post('/spotlights', authenticate, requireRole('admin', 'manager'), spotlightCtrl.create);
router.put('/spotlights/:id', authenticate, requireRole('admin', 'manager'), spotlightCtrl.update);
router.delete('/spotlights/:id', authenticate, requireRole('admin', 'manager'), spotlightCtrl.remove);

// --- Plant Variants ---
router.post('/plants/:plant_id/variants', authenticate, requireRole('admin', 'manager'), variantCtrl.create);
router.put('/variants/:id', authenticate, requireRole('admin', 'manager'), variantCtrl.update);
router.delete('/variants/:id', authenticate, requireRole('admin', 'manager'), variantCtrl.remove);

// --- Tray Types ---
router.get('/tray-types', authenticate, trayTypeCtrl.list);
router.post('/tray-types', authenticate, requireRole('admin', 'manager'), trayTypeCtrl.create);
router.put('/tray-types/:id', authenticate, requireRole('admin', 'manager'), trayTypeCtrl.update);
router.delete('/tray-types/:id', authenticate, requireRole('admin', 'manager'), trayTypeCtrl.remove);

// --- Storage Locations ---
router.get('/locations', authenticate, locationCtrl.list);
router.post('/locations', authenticate, requireRole('admin', 'manager'), locationCtrl.create);
router.put('/locations/:id', authenticate, requireRole('admin', 'manager'), locationCtrl.update);
router.delete('/locations/:id', authenticate, requireRole('admin', 'manager'), locationCtrl.remove);

// --- Vendors ---
router.get('/vendors', authenticate, vendorCtrl.list);
router.post('/vendors', authenticate, requireRole('admin', 'manager'), vendorCtrl.create);
router.put('/vendors/:id', authenticate, requireRole('admin', 'manager'), vendorCtrl.update);
router.delete('/vendors/:id', authenticate, requireRole('admin', 'manager'), vendorCtrl.remove);

// --- Seed Bank ---
router.get('/seed-lots', authenticate, seedLotCtrl.list);
router.post('/seed-lots', authenticate, requireRole('admin', 'manager'), seedLotCtrl.create);
router.put('/seed-lots/:id', authenticate, requireRole('admin', 'manager'), seedLotCtrl.update);
router.delete('/seed-lots/:id', authenticate, requireRole('admin', 'manager'), seedLotCtrl.remove);

// --- SKU Utilities ---
router.post('/skus/regenerate', authenticate, requireRole('admin', 'manager'), skuCtrl.regenerateAll);
router.get('/skus/auto-generate/preview', authenticate, requireRole('admin', 'manager'), skuGeneratorCtrl.preview);
router.post('/skus/auto-generate', authenticate, requireRole('admin', 'manager'), skuGeneratorCtrl.generate);

// --- Vendor SKUs ---
router.get('/variants/:variant_id/vendor-skus', authenticate, vendorSkuCtrl.list);
router.post('/variants/:variant_id/vendor-skus', authenticate, requireRole('admin', 'manager'), vendorSkuCtrl.create);
router.put('/vendor-skus/:id', authenticate, requireRole('admin', 'manager'), vendorSkuCtrl.update);
router.delete('/vendor-skus/:id', authenticate, requireRole('admin', 'manager'), vendorSkuCtrl.remove);

// --- Production Batches ---
router.get('/production', authenticate, productionCtrl.list);
// Stage routes before /:id so 'stages' isn't caught as an id param
router.put('/production/stages/:stage_id', authenticate, requireRole('admin', 'manager', 'staff'), productionStageCtrl.update);
router.delete('/production/stages/:stage_id', authenticate, requireRole('admin', 'manager', 'staff'), productionStageCtrl.remove);
router.get('/production/:id/stages', authenticate, productionStageCtrl.list);
router.post('/production/:id/stages', authenticate, requireRole('admin', 'manager', 'staff'), productionStageCtrl.create);
router.get('/production/:id', authenticate, productionCtrl.get);
router.post('/production', authenticate, requireRole('admin', 'manager', 'staff'), productionCtrl.create);
router.put('/production/:id', authenticate, requireRole('admin', 'manager', 'staff'), productionCtrl.update);
router.delete('/production/:id', authenticate, requireRole('admin', 'manager'), productionCtrl.remove);

// --- Production Batch Groups ---
router.get('/production-groups', authenticate, productionGroupCtrl.list);
router.get('/production-groups/:id', authenticate, productionGroupCtrl.get);
router.post('/production-groups', authenticate, requireRole('admin', 'manager', 'staff'), productionGroupCtrl.create);
router.put('/production-groups/:id', authenticate, requireRole('admin', 'manager', 'staff'), productionGroupCtrl.update);
router.delete('/production-groups/:id', authenticate, requireRole('admin', 'manager'), productionGroupCtrl.remove);

// --- Import ---
router.post('/import/spreadsheet',
  authenticate,
  requireRole('admin', 'manager'),
  upload.single('file'),
  importCtrl.upload
);

// --- Shopify ---
router.post('/shopify/webhooks/order-created', shopifyCtrl.webhookOrderCreated);
router.post('/shopify/webhooks/fulfillment-created', shopifyCtrl.webhookFulfillmentCreated);
router.post('/shopify/products/:plant_id/push', authenticate, requireRole('admin', 'manager'), shopifyCtrl.pushProduct);
router.get('/shopify/locations', authenticate, shopifyCtrl.getLocations);
router.post('/shopify/webhooks/register', authenticate, requireRole('admin'), shopifyCtrl.registerWebhooks);
router.get('/shopify/webhooks', authenticate, requireRole('admin'), shopifyCtrl.listWebhooks);
router.get('/shopify/orders/open-count', authenticate, shopifyCtrl.getOpenOrdersCount);

// --- iNaturalist photo lookup ---
router.get('/inaturalist/preview',                  authenticate, inatCtrl.previewPhoto);
router.post('/inaturalist/fetch/:id',               authenticate, requireRole('admin','manager'), inatCtrl.fetchPhotoForPlant);
router.get('/inaturalist/bulk-fetch/log',           authenticate, requireRole('admin','manager'), inatCtrl.getLastLog);
router.get('/inaturalist/bulk-fetch/stream',        authenticate, requireRole('admin','manager'), inatCtrl.bulkFetchStream);

// --- Landscaping Projects & In Ground Assets ---
router.get('/landscaping/projects', authenticate, landscapingCtrl.listProjects);
router.get('/landscaping/projects/:id', authenticate, landscapingCtrl.getProject);
router.post('/landscaping/projects', authenticate, requireRole('admin', 'manager'), landscapingCtrl.createProject);
router.put('/landscaping/projects/:id', authenticate, requireRole('admin', 'manager'), landscapingCtrl.updateProject);
router.post('/landscaping/projects/:id/geocode', authenticate, requireRole('admin', 'manager'), landscapingCtrl.geocodeProject);
router.delete('/landscaping/projects/:id', authenticate, requireRole('admin', 'manager'), landscapingCtrl.deleteProject);
router.post('/landscaping/projects/:id/plants', authenticate, requireRole('admin', 'manager', 'staff'), landscapingCtrl.addPlantToProject);
router.put('/landscaping/project-plants/:id', authenticate, requireRole('admin', 'manager', 'staff'), landscapingCtrl.updateProjectPlant);
router.delete('/landscaping/project-plants/:id', authenticate, requireRole('admin', 'manager'), landscapingCtrl.removeProjectPlant);

// --- Job Photos ---
router.get('/landscaping/projects/:id/photos',  authenticate, jobPhotoCtrl.listPhotos);
router.post('/landscaping/projects/:id/photos', authenticate, requireRole('admin', 'manager', 'staff'), uploadPhoto.array('photos', 20), jobPhotoCtrl.uploadPhotos);
router.get('/landscaping/photos/:id/file',      jobPhotoCtrl.serveFile);  // no auth — UUID filenames are unguessable
router.patch('/landscaping/photos/:id',         authenticate, requireRole('admin', 'manager', 'staff'), jobPhotoCtrl.updateCaption);
router.delete('/landscaping/photos/:id',        authenticate, requireRole('admin', 'manager'), jobPhotoCtrl.deletePhoto);

// --- Scan (PWA barcode / QR lookup) ---
// All three require auth so inventory counts aren't publicly accessible.
// barcode  — internal auto-generated code printed on labels (e.g. BDKP73RNXA)
// sku      — human-readable user SKU (case-insensitive, e.g. ACMI-1G-V01)
// plant/:code — plant_code lookup returning all active variants
router.get('/scan/barcode/:barcode', authenticate, scanCtrl.byBarcode);
router.get('/scan/sku/:sku',         authenticate, scanCtrl.byUserSku);
router.get('/scan/plant/:code',      authenticate, scanCtrl.byPlantCode);

// --- Merchandise Inventory ---
router.get('/merchandise',          authenticate, merchandiseCtrl.list);
router.get('/merchandise/:id',      authenticate, merchandiseCtrl.get);
router.post('/merchandise',         authenticate, requireRole('admin', 'manager'), merchandiseCtrl.create);
router.put('/merchandise/:id',      authenticate, requireRole('admin', 'manager'), merchandiseCtrl.update);
router.post('/merchandise/adjust',  authenticate, requireRole('admin', 'manager', 'staff'), merchandiseCtrl.adjust);
router.delete('/merchandise/:id',   authenticate, requireRole('admin', 'manager'), merchandiseCtrl.remove);

// --- Nursery Orders ---
router.get('/nursery-orders',                  authenticate, nurseryOrderCtrl.list);
router.get('/nursery-orders/:id',              authenticate, nurseryOrderCtrl.get);
router.post('/nursery-orders',                 authenticate, requireRole('admin','manager','staff'), nurseryOrderCtrl.create);
router.put('/nursery-orders/:id',              authenticate, requireRole('admin','manager','staff'), nurseryOrderCtrl.update);
router.post('/nursery-orders/:id/fulfill',     authenticate, requireRole('admin','manager'), nurseryOrderCtrl.fulfill);
router.post('/nursery-orders/:id/cancel',      authenticate, requireRole('admin','manager'), nurseryOrderCtrl.cancel);
router.post('/nursery-orders/:id/email',       authenticate, requireRole('admin','manager','staff'), nurseryOrderCtrl.emailReport);
router.delete('/nursery-orders/:id',           authenticate, requireRole('admin','manager'), nurseryOrderCtrl.remove);

// --- Vendor Orders ---
router.get('/vendor-orders',                        authenticate, vendorOrderCtrl.list);
router.get('/vendor-orders/:id',                    authenticate, vendorOrderCtrl.get);
router.post('/vendor-orders',                       authenticate, requireRole('admin','manager','staff'), vendorOrderCtrl.create);
router.put('/vendor-orders/:id',                    authenticate, requireRole('admin','manager','staff'), vendorOrderCtrl.update);
router.post('/vendor-orders/:id/mark-ordered',      authenticate, requireRole('admin','manager','staff'), vendorOrderCtrl.markOrdered);
router.post('/vendor-orders/:id/receive',           authenticate, requireRole('admin','manager'), vendorOrderCtrl.receive);
router.post('/vendor-orders/:id/cancel',            authenticate, requireRole('admin','manager'), vendorOrderCtrl.cancel);
router.delete('/vendor-orders/:id',                 authenticate, requireRole('admin','manager'), vendorOrderCtrl.remove);

// --- Pot Size Pricing ---
router.get('/pot-size-costs',      authenticate, potSizeCostCtrl.list);
router.post('/pot-size-costs',     authenticate, requireRole('admin','manager'), potSizeCostCtrl.create);
router.put('/pot-size-costs/:id',  authenticate, requireRole('admin','manager'), potSizeCostCtrl.update);
router.delete('/pot-size-costs/:id', authenticate, requireRole('admin','manager'), potSizeCostCtrl.remove);

// --- Health ---
router.get('/health', (req, res) => res.json({ status: 'ok', app: 'natives', timestamp: new Date() }));

module.exports = router;
