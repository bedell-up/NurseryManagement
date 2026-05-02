import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Package, DollarSign,
  ShoppingBag, Truck, Star, Upload, LogOut, Menu, X, Leaf, ClipboardList, Sprout, Building2, MapPin, LayoutGrid, Wheat, Users, Shuffle, Tags, TreePine, ChevronDown, Map, ScanBarcode, Barcode, ShoppingCart, BarChart2, Receipt, Layers, PackageCheck, ArrowLeftRight, MapPinOff, GitMerge
} from 'lucide-react';
import { useState } from 'react';
import bdLogo from '../../assets/BD_logo.jpg';
import { usePageTitle } from '../../hooks/usePageTitle';

const navGroups = [
  {
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Plants',
    items: [
      { to: '/admin/plants',       label: 'Plants',        icon: Leaf },
      { to: '/admin/plants/merge', label: 'Merge Dupes',   icon: GitMerge },
      { to: '/admin/production',  label: 'In Production', icon: Sprout },
      { to: '/admin/in-ground',   label: 'In Ground',     icon: TreePine },
      { to: '/admin/job-map',     label: 'Job Map',       icon: Map },
      { to: '/admin/seed-bank',   label: 'Seed Bank',     icon: Wheat },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/admin/inventory',         label: 'Inventory',     icon: Package },
      { to: '/admin/inventory/scan',    label: 'Scan Items',    icon: ScanBarcode },
      { to: '/admin/inventory/count',        label: 'Count Entry',    icon: ClipboardList },
      { to: '/admin/inventory/count-report', label: 'Count Report',   icon: BarChart2 },
      { to: '/admin/inventory/sheets',       label: 'Barcode Sheets', icon: Barcode },
      { to: '/admin/inventory/transfer',     label: 'Transfer',       icon: ArrowLeftRight },
      { to: '/admin/inventory/no-location',  label: 'No Location',    icon: MapPinOff },
      { to: '/admin/deliveries',      label: 'Deliveries',    icon: Truck },
      { to: '/admin/vendor-orders',   label: 'Vendor Orders', icon: PackageCheck },
      { to: '/admin/merchandise',     label: 'Merchandise',   icon: ShoppingCart },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/admin/pricing',         label: 'Pricing',         icon: DollarSign },
      { to: '/admin/preorders',        label: 'Pre-orders',      icon: ShoppingBag },
      { to: '/admin/nursery-orders',   label: 'Nursery Orders',  icon: Receipt },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/spotlights', label: 'Spotlights', icon: Star },
    ],
  },
  {
    label: 'Setup',
    items: [
      { to: '/admin/vendors',              label: 'Vendors',          icon: Building2 },
      { to: '/admin/pot-size-pricing',     label: 'Container Pricing', icon: DollarSign },
      { to: '/admin/locations',            label: 'Locations',        icon: MapPin },
      { to: '/admin/tray-types',           label: 'Trays & Pots',  icon: LayoutGrid },
      { to: '/admin/plant-types',           label: 'Plant Types',   icon: Layers },
      { to: '/admin/plant-type-defaults',  label: 'Type Defaults', icon: Shuffle },
      { to: '/admin/sku-generator',        label: 'SKU Generator', icon: Tags },
      { to: '/admin/import',               label: 'Import',        icon: Upload },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
    ],
  },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(new Set());

  usePageTitle('Admin');
  const handleLogout = () => { logout(); navigate('/admin/login'); };

  const toggleGroup = (label) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const Sidebar = () => (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-forest-700">
        <div className="flex items-center gap-2.5">
          <img src={bdLogo} alt="Bloomsday Natives" className="h-9 w-auto rounded" />
          <span className="font-serif text-white text-lg font-semibold">Bloomsday Natives</span>
        </div>
        <p className="text-forest-400 text-xs mt-1">Admin Panel</p>
      </div>
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group, gi) => {
          const isCollapsed = group.label && collapsed.has(group.label);
          return (
            <div key={gi}>
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 mb-1 group/header"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-forest-500 group-hover/header:text-forest-300 transition-colors">
                    {group.label}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-forest-600 group-hover/header:text-forest-400 transition-all duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
              )}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to} to={to} end={end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-forest-600 text-white'
                            : 'text-forest-300 hover:bg-forest-700 hover:text-white'
                        }`
                      }
                    >
                      <Icon size={16} />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="p-4 border-t border-forest-700">
        <div className="text-forest-400 text-xs mb-3 truncate">{user?.email}</div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-forest-400 hover:text-white text-sm transition-colors w-full">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-forest-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-forest-900 flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative z-50 flex flex-col w-56 h-full bg-forest-900">
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-forest-100">
          <button onClick={() => setOpen(true)} className="text-forest-600">
            <Menu size={20} />
          </button>
          <img src={bdLogo} alt="Bloomsday Natives" className="h-7 w-auto rounded" />
          <span className="font-serif font-semibold text-forest-800">Bloomsday Natives Admin</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
