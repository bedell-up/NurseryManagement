import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('natives_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const hadToken = !!localStorage.getItem('natives_token');
      localStorage.removeItem('natives_token');
      if (hadToken) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// Plants
export const plants = {
  list:       (params) => api.get('/plants', { params }),
  get:        (id)     => api.get(`/plants/${id}`),
  create:     (data)   => api.post('/plants', data),
  update:     (id, d)  => api.put(`/plants/${id}`, d),
  delete:     (id)     => api.delete(`/plants/${id}`),
  bulkDelete: (ids)    => api.post('/plants/bulk-delete', { ids }),
};

// Inventory
export const inventory = {
  list:             (params)     => api.get('/inventory', { params }),
  adjust:           (data)       => api.post('/inventory/adjust', data),
  update:           (id, data)   => api.patch(`/inventory/${id}`, data),
  bulkCount:        (rows)       => api.post('/inventory/count', rows),
  setLocationSplits:(id, splits) => api.put(`/inventory/${id}/location-splits`, splits),
  countReport:      (params)     => api.get('/inventory/count-report', { params }),
  countReportUsers: ()           => api.get('/inventory/count-report/users'),
};

// Pricing
export const pricing = {
  list:       (params) => api.get('/pricing', { params }),
  update:     (vid, d) => api.put(`/pricing/${vid}`, d),
  bulkUpdate: (data)   => api.post('/pricing/bulk-update', data),
};

// Preorders
export const preorders = {
  list:         (params) => api.get('/preorders', { params }),
  get:          (id)     => api.get(`/preorders/${id}`),
  create:       (data)   => api.post('/preorders', data),
  updateStatus: (id, d)  => api.patch(`/preorders/${id}/status`, d),
};

// Deliveries
export const deliveries = {
  list:        (params) => api.get('/deliveries', { params }),
  get:         (id)     => api.get(`/deliveries/${id}`),
  create:      (data)   => api.post('/deliveries', data),
  update:      (id, d)  => api.put(`/deliveries/${id}`, d),
  markArrived: (id, d)  => api.post(`/deliveries/${id}/arrived`, d),
};

// Spotlights
export const spotlights = {
  listActive: ()       => api.get('/spotlights'),
  listAll:    ()       => api.get('/spotlights/all'),
  create:     (data)   => api.post('/spotlights', data),
  update:     (id, d)  => api.put(`/spotlights/${id}`, d),
  delete:     (id)     => api.delete(`/spotlights/${id}`),
};

// Auth
export const auth = {
  login: (data) => api.post('/auth/login', data),
  me:    ()     => api.get('/auth/me'),
};

// Users
export const users = {
  list:   ()        => api.get('/users'),
  create: (data)    => api.post('/users', data),
  update: (id, d)   => api.put(`/users/${id}`, d),
  remove: (id)      => api.delete(`/users/${id}`),
};

// iNaturalist
export const inat = {
  preview:    (scientific_name) => api.get('/inaturalist/preview', { params: { scientific_name } }),
  fetchPhoto: (plantId)        => api.post(`/inaturalist/fetch/${plantId}`),
  getLog:     ()               => api.get('/inaturalist/bulk-fetch/log'),
};

// Plant Variants
export const variants = {
  create: (plantId, data) => api.post(`/plants/${plantId}/variants`, data),
  update: (id, data)     => api.put(`/variants/${id}`, data),
  remove: (id)           => api.delete(`/variants/${id}`),
};

// Vendor SKUs
export const vendorSkus = {
  list:   (variantId)       => api.get(`/variants/${variantId}/vendor-skus`),
  create: (variantId, data) => api.post(`/variants/${variantId}/vendor-skus`, data),
  update: (id, data)        => api.put(`/vendor-skus/${id}`, data),
  remove: (id)              => api.delete(`/vendor-skus/${id}`),
};

// Production Batches
export const production = {
  list:   (params) => api.get('/production', { params }),
  get:    (id)     => api.get(`/production/${id}`),
  create: (data)   => api.post('/production', data),
  update: (id, d)  => api.put(`/production/${id}`, d),
  remove: (id)     => api.delete(`/production/${id}`),
};

// Production Batch Groups
export const productionGroups = {
  list:   ()        => api.get('/production-groups'),
  get:    (id)      => api.get(`/production-groups/${id}`),
  create: (data)    => api.post('/production-groups', data),
  update: (id, d)   => api.put(`/production-groups/${id}`, d),
  remove: (id)      => api.delete(`/production-groups/${id}`),
};

// Vendors
export const vendors = {
  list:   ()        => api.get('/vendors'),
  create: (data)    => api.post('/vendors', data),
  update: (id, d)   => api.put(`/vendors/${id}`, d),
  remove: (id)      => api.delete(`/vendors/${id}`),
};

// Plant Types
export const plantTypes = {
  list:   (params) => api.get('/plant-types', { params }),
  create: (data)   => api.post('/plant-types', data),
  update: (id, d)  => api.put(`/plant-types/${id}`, d),
  remove: (id)     => api.delete(`/plant-types/${id}`),
};

// Plant Type Defaults
export const plantTypeDefaults = {
  list:   ()             => api.get('/plant-type-defaults'),
  upsert: (plantType, d) => api.put(`/plant-type-defaults/${plantType}`, d),
};

// Tray Types
export const trayTypes = {
  list:   (params) => api.get('/tray-types', { params }),
  create: (data)   => api.post('/tray-types', data),
  update: (id, d)  => api.put(`/tray-types/${id}`, d),
  remove: (id)     => api.delete(`/tray-types/${id}`),
};

// Seed Bank
export const seedLots = {
  list:   ()        => api.get('/seed-lots'),
  create: (data)    => api.post('/seed-lots', data),
  update: (id, d)   => api.put(`/seed-lots/${id}`, d),
  remove: (id)      => api.delete(`/seed-lots/${id}`),
};

// Storage Locations
export const locations = {
  list:   (params)  => api.get('/locations', { params }),
  create: (data)    => api.post('/locations', data),
  update: (id, d)   => api.put(`/locations/${id}`, d),
  remove: (id)      => api.delete(`/locations/${id}`),
};

// SKU utilities
export const skuApi = {
  regenerateAll: () => api.post('/skus/regenerate'),
};

// SKU Auto-Generator
export const skuGenerator = {
  preview:  (vendor_id) => api.get('/skus/auto-generate/preview', { params: vendor_id ? { vendor_id } : {} }),
  generate: (vendor_id) => api.post('/skus/auto-generate', { vendor_id: vendor_id || null }),
};

// Landscaping Projects & In Ground Assets
export const landscaping = {
  listProjects:      (params)           => api.get('/landscaping/projects', { params }),
  getProject:        (id)               => api.get(`/landscaping/projects/${id}`),
  createProject:     (data)             => api.post('/landscaping/projects', data),
  updateProject:     (id, data)         => api.put(`/landscaping/projects/${id}`, data),
  deleteProject:     (id)               => api.delete(`/landscaping/projects/${id}`),
  geocodeProject:    (id)               => api.post(`/landscaping/projects/${id}/geocode`),
  addPlant:          (projectId, data)  => api.post(`/landscaping/projects/${projectId}/plants`, data),
  updatePlant:       (id, data)         => api.put(`/landscaping/project-plants/${id}`, data),
  removePlant:       (id, data)         => api.delete(`/landscaping/project-plants/${id}`, { data }),
};

// Job Photos
export const photoUrl = (photoId) => {
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  return `${base}/landscaping/photos/${photoId}/file`;
};

export const jobPhotos = {
  list:          (projectId)           => api.get(`/landscaping/projects/${projectId}/photos`),
  upload:        (projectId, files, onProgress) => {
    const fd = new FormData();
    files.forEach(f => fd.append('photos', f));
    return api.post(`/landscaping/projects/${projectId}/photos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },
  updateCaption: (id, caption) => api.patch(`/landscaping/photos/${id}`, { caption }),
  delete:        (id)          => api.delete(`/landscaping/photos/${id}`),
};

// Merchandise Inventory
export const merchandise = {
  list:   (params) => api.get('/merchandise', { params }),
  get:    (id)     => api.get(`/merchandise/${id}`),
  create: (data)   => api.post('/merchandise', data),
  update: (id, d)  => api.put(`/merchandise/${id}`, d),
  adjust: (data)   => api.post('/merchandise/adjust', data),
  remove: (id)     => api.delete(`/merchandise/${id}`),
};

// Nursery Orders
export const nurseryOrders = {
  list:    (params)  => api.get('/nursery-orders', { params }),
  get:     (id)      => api.get(`/nursery-orders/${id}`),
  create:  (data)    => api.post('/nursery-orders', data),
  update:  (id, d)   => api.put(`/nursery-orders/${id}`, d),
  fulfill: (id)      => api.post(`/nursery-orders/${id}/fulfill`),
  cancel:  (id)      => api.post(`/nursery-orders/${id}/cancel`),
  remove:  (id)      => api.delete(`/nursery-orders/${id}`),
};

// Barcode sheet (print)
export const barcodeSheet = {
  get: (location) => api.get('/inventory/barcode-sheet', { params: location ? { location } : {} }),
};

// Barcode / SKU scan lookup
export const scan = {
  byBarcode: (barcode) => api.get(`/scan/barcode/${encodeURIComponent(barcode.toUpperCase())}`),
  bySku:     (sku)     => api.get(`/scan/sku/${encodeURIComponent(sku)}`),
};

// Import
export const importApi = {
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/import/spreadsheet', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
