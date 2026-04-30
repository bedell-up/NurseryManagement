import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import './index.css';

import PublicLayout    from './components/layout/PublicLayout';
import AdminLayout     from './components/layout/AdminLayout';
import RequireAuth     from './components/layout/RequireAuth';

import Home            from './pages/public/Home';
import Catalog         from './pages/public/Catalog';
import PlantDetail     from './pages/public/PlantDetail';
import Preorder        from './pages/public/Preorder';
import Deliveries      from './pages/public/Deliveries';

import AdminLogin      from './pages/admin/AdminLogin';
import AdminDashboard  from './pages/admin/AdminDashboard';
import AdminPlants     from './pages/admin/AdminPlants';
import AdminInventory  from './pages/admin/AdminInventory';
import AdminPricing    from './pages/admin/AdminPricing';
import AdminPreorders  from './pages/admin/AdminPreorders';
import AdminSpotlights from './pages/admin/AdminSpotlights';
import AdminImport          from './pages/admin/AdminImport';
import AdminInventoryCount  from './pages/admin/AdminInventoryCount';
import AdminProduction      from './pages/admin/AdminProduction';
import AdminVendors        from './pages/admin/AdminVendors';
import AdminLocations      from './pages/admin/AdminLocations';
import AdminTrayTypes      from './pages/admin/AdminTrayTypes';
import AdminSeedBank       from './pages/admin/AdminSeedBank';
import AdminUsers               from './pages/admin/AdminUsers';
import AdminPlantTypeDefaults   from './pages/admin/AdminPlantTypeDefaults';
import AdminSkuGenerator        from './pages/admin/AdminSkuGenerator';
import AdminInGround            from './pages/admin/AdminInGround';
import AdminJobMap              from './pages/admin/AdminJobMap';
import AdminBarcodeScan         from './pages/admin/AdminBarcodeScan';
import AdminBarcodeSheets       from './pages/admin/AdminBarcodeSheets';
import AdminMerchandise         from './pages/admin/AdminMerchandise';
import AdminCountReport        from './pages/admin/AdminCountReport';
import AdminNurseryOrders      from './pages/admin/AdminNurseryOrders';
import AdminPlantTypes         from './pages/admin/AdminPlantTypes';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function AdminDeliveries() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-serif font-semibold text-forest-900 mb-4">Deliveries</h1>
      <p className="text-forest-500 mb-2">Full delivery window UI coming soon.</p>
      <p className="text-forest-400 text-sm">Use the API at <code className="text-xs bg-forest-100 px-1.5 py-0.5 rounded">/api/deliveries</code> to create and manage delivery windows in the meantime.</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route element={<PublicLayout />}>
              <Route index              element={<Home />} />
              <Route path="catalog"     element={<Catalog />} />
              <Route path="plant/:id"   element={<PlantDetail />} />
              <Route path="preorder"    element={<Preorder />} />
              <Route path="deliveries"  element={<Deliveries />} />
            </Route>

            {/* Admin login (standalone) */}
            <Route path="admin/login" element={<AdminLogin />} />

            {/* Scan PWA — standalone, no sidebar, installable to home screen */}
            <Route path="admin/inventory/scan" element={<RequireAuth><AdminBarcodeScan /></RequireAuth>} />

            {/* Admin (protected) */}
            <Route path="admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
              <Route index               element={<AdminDashboard />} />
              <Route path="plants"       element={<AdminPlants />} />
              <Route path="inventory"    element={<AdminInventory />} />
              <Route path="inventory/count"         element={<AdminInventoryCount />} />
              <Route path="inventory/count-report"  element={<AdminCountReport />} />
              <Route path="inventory/sheets"        element={<AdminBarcodeSheets />} />
              <Route path="production"   element={<AdminProduction />} />
              <Route path="pricing"          element={<AdminPricing />} />
              <Route path="preorders"        element={<AdminPreorders />} />
              <Route path="nursery-orders"   element={<AdminNurseryOrders />} />
              <Route path="deliveries"   element={<AdminDeliveries />} />
              <Route path="spotlights"   element={<AdminSpotlights />} />
              <Route path="import"       element={<AdminImport />} />
              <Route path="vendors"      element={<AdminVendors />} />
              <Route path="locations"    element={<AdminLocations />} />
              <Route path="tray-types"   element={<AdminTrayTypes />} />
              <Route path="seed-bank"    element={<AdminSeedBank />} />
              <Route path="users"              element={<AdminUsers />} />
              <Route path="plant-types"         element={<AdminPlantTypes />} />
              <Route path="plant-type-defaults" element={<AdminPlantTypeDefaults />} />
              <Route path="sku-generator"       element={<AdminSkuGenerator />} />
              <Route path="in-ground"           element={<AdminInGround />} />
              <Route path="job-map"             element={<AdminJobMap />} />
              <Route path="merchandise"         element={<AdminMerchandise />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
