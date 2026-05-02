import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plants as plantsApi, variants as variantsApi, vendorSkus as vendorSkusApi, vendors as vendorsApi, trayTypes as trayTypesApi, potSizeCosts as potSizeCostsApi } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Confirm from '../../components/ui/Confirm';
import Pagination from '../../components/ui/Pagination';
import PlantForm from '../../components/admin/PlantForm';
import { SortHeader, MultiSortBar } from '../../components/ui/SortControls';
import { useMultiSort, applyMultiSort } from '../../hooks/useMultiSort';
import {
  Plus, Search, Pencil, Trash2, Eye, EyeOff, ImagePlus,
  ChevronRight, ChevronDown, X, Store, CheckSquare,
} from 'lucide-react';
import { inat } from '../../api/client';

const TYPES = ['tree','shrub','perennial','annual','graminoid','fern','vine','groundcover','bulb','aquatic','perennial_vegetable','other'];

const TYPE_LABELS = {
  tree: 'Tree', shrub: 'Shrub', perennial: 'Perennial', annual: 'Annual',
  graminoid: 'Graminoid', fern: 'Fern', vine: 'Vine', groundcover: 'Groundcover',
  bulb: 'Bulb', aquatic: 'Aquatic', perennial_vegetable: 'Perennial Vegetable', other: 'Other',
};

function TypeBadge({ type }) {
  const colors = {
    tree: 'badge-green', shrub: 'badge-green', perennial: 'badge-blue',
    annual: 'badge-earth', graminoid: 'badge-gray', fern: 'badge-green',
    vine: 'badge-earth', aquatic: 'badge-blue', perennial_vegetable: 'badge-earth', other: 'badge-gray',
  };
  return <span className={colors[type] || 'badge-gray'}>{TYPE_LABELS[type] || type}</span>;
}

const PLANTS_SORT_COLS = [
  { value: 'scientific_name', label: 'Scientific Name' },
  { value: 'common_name',     label: 'Common Name' },
  { value: 'plant_type',      label: 'Type' },
  { value: 'native_region',   label: 'Region' },
];

function plantsGetVal(plant, col) {
  switch (col) {
    case 'scientific_name': return (plant.scientific_name || plant.common_name || '').toLowerCase();
    case 'common_name':     return (plant.common_name || '').toLowerCase();
    case 'plant_type':      return plant.plant_type || '';
    case 'native_region':   return (plant.native_region || '').toLowerCase();
    default:                return '';
  }
}

function VendorSkuRow({ row, onDelete }) {
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-forest-50 group text-xs">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-medium text-forest-800 truncate">{row.vendor_name}</span>
        <span className="font-mono text-forest-500 bg-forest-100 px-1.5 py-0.5 rounded shrink-0">{row.sku || row.vendor_code}</span>
        {row.cost != null && (
          <span className="text-earth-600 shrink-0">${Number(row.cost).toFixed(2)}</span>
        )}
        {row.notes && <span className="text-forest-400 truncate hidden sm:block">{row.notes}</span>}
      </div>
      <button
        onClick={() => onDelete(row)}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-0.5 rounded ml-2 shrink-0"
        title="Remove vendor SKU"
      >
        <X size={12} />
      </button>
    </div>
  );
}

const NEW_VENDOR_SENTINEL = '__new__';

function VendorSkuPanel({ variant }) {
  const qc = useQueryClient();
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [newName, setNewName]   = useState('');
  const [newCode, setNewCode]   = useState('');
  const [cost, setCost]         = useState('');
  const [notes, setNotes]       = useState('');
  const [error, setError]       = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isNew = selectedVendorId === NEW_VENDOR_SENTINEL;
  const selectedVendor = null; // resolved below after query

  const { data: vendorList = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.list().then(r => r.data),
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['vendor-skus', variant.id],
    queryFn: () => vendorSkusApi.list(variant.id).then(r => r.data),
  });

  const resolved = vendorList.find(v => v.id === selectedVendorId);
  const vendorCode = isNew ? newCode.trim().toUpperCase() : (resolved?.code ?? '');
  const vendorName = isNew ? newName.trim() : (resolved?.name ?? '');
  const previewSku = vendorCode ? `${variant.sku || '??'}-${vendorCode}` : null;

  const createVendorMutation = useMutation({
    mutationFn: (data) => vendorsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  });

  const addMutation = useMutation({
    mutationFn: (payload) => vendorSkusApi.create(variant.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-skus', variant.id] });
      setSelectedVendorId(''); setNewName(''); setNewCode('');
      setCost(''); setNotes(''); setError('');
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to add'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => vendorSkusApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-skus', variant.id] }); setDeleteTarget(null); },
  });

  const handleAdd = async () => {
    if (!vendorName) return setError('Select or enter a vendor');
    if (!vendorCode) return setError('Vendor code is required');
    setError('');

    // If adding a brand-new vendor, create it in the vendors table first
    if (isNew) {
      try {
        await createVendorMutation.mutateAsync({ name: vendorName, code: vendorCode });
      } catch (e) {
        // Ignore duplicate-code errors — vendor may already exist
        if (!e.response?.data?.error?.includes('unique')) {
          return setError(e.response?.data?.error || 'Failed to create vendor');
        }
      }
    }

    addMutation.mutate({
      vendor_name: vendorName,
      vendor_code: vendorCode,
      cost: cost ? parseFloat(cost) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="mt-2 ml-4 border-l-2 border-forest-100 pl-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-forest-500 mb-1">
        <Store size={11} />
        Vendor SKUs
      </div>

      {isLoading ? (
        <div className="text-xs text-forest-400 animate-pulse">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-forest-300">No vendor SKUs yet.</div>
      ) : (
        rows.map(r => <VendorSkuRow key={r.id} row={r} onDelete={setDeleteTarget} />)
      )}

      <div className="pt-1 space-y-1.5">
        {/* Vendor selector */}
        <div className="flex gap-1.5">
          <select
            className="select flex-1 text-xs py-1"
            value={selectedVendorId}
            onChange={e => { setSelectedVendorId(e.target.value); setNewName(''); setNewCode(''); setError(''); }}
          >
            <option value="">Select a vendor…</option>
            {vendorList.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
            ))}
            <option value={NEW_VENDOR_SENTINEL}>＋ New vendor…</option>
          </select>

          {/* Code badge for existing, editable input for new */}
          {!isNew && vendorCode ? (
            <span className="input w-20 text-xs py-1 font-mono bg-forest-50 text-forest-600 flex items-center justify-center">
              {vendorCode}
            </span>
          ) : isNew ? (
            <input
              className="input w-20 text-xs py-1 font-mono uppercase"
              placeholder="Code"
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              maxLength={10}
            />
          ) : (
            <span className="w-20" />
          )}

          <input
            className="input w-20 text-xs py-1"
            placeholder="COGS $"
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={e => setCost(e.target.value)}
          />
        </div>

        {/* New vendor name field */}
        {isNew && (
          <input
            className="input w-full text-xs py-1"
            placeholder="Vendor name (e.g. Seven Oaks Nursery)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
        )}

        <div className="flex gap-1.5 items-center">
          <input
            className="input flex-1 text-xs py-1"
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending || createVendorMutation.isPending}
            className="btn-primary text-xs px-2.5 py-1 shrink-0"
          >
            {addMutation.isPending || createVendorMutation.isPending ? '…' : 'Add'}
          </button>
        </div>

        {previewSku && (
          <div className="text-xs text-forest-400">
            SKU preview: <span className="font-mono text-forest-600">{previewSku}</span>
          </div>
        )}
        {error && <p className="text-red-600 text-xs">{error}</p>}
      </div>

      {deleteTarget && (
        <Confirm
          title="Remove Vendor SKU"
          message={`Remove ${deleteTarget.sku || deleteTarget.vendor_code} (${deleteTarget.vendor_name})?`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function VariantRow({ variant, onDelete }) {
  const [vendorsOpen, setVendorsOpen] = useState(false);

  return (
    <div className="rounded border border-transparent hover:border-forest-100 transition-colors">
      <div className="flex items-center justify-between py-1 px-2 group">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-forest-700 font-medium shrink-0">{variant.container_size}</span>
          {variant.sku && <span className="text-xs text-forest-400 font-mono">{variant.sku}</span>}
          {!variant.is_active && <span className="text-xs text-forest-300">(inactive)</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setVendorsOpen(o => !o)}
            className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors ${
              vendorsOpen ? 'text-forest-700 bg-forest-100' : 'text-forest-400 hover:text-forest-600 hover:bg-forest-50'
            }`}
            title="Vendor SKUs"
          >
            <Store size={11} />
            {vendorsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          <button
            onClick={() => onDelete(variant)}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-0.5 rounded"
            title="Remove variant"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      {vendorsOpen && <VendorSkuPanel variant={variant} />}
    </div>
  );
}

function VariantsPanel({ plant, onClose }) {
  const qc = useQueryClient();
  const [selectedOpt, setSelectedOpt] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [newSku, setNewSku] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: potCostsData } = useQuery({
    queryKey: ['pot-size-costs'],
    queryFn: () => potSizeCostsApi.list().then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const { data: trayTypesData } = useQuery({
    queryKey: ['tray-types', 'pot'],
    queryFn: () => trayTypesApi.list({ category: 'pot' }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const sizeOptions = useMemo(() => {
    const fromCosts = (potCostsData?.pot_size_costs ?? []).map(p => p.label);
    const fromTrays = (trayTypesData ?? []).map(t => t.name);
    return [...new Set([...fromCosts, ...fromTrays])];
  }, [potCostsData, trayTypesData]);

  const effectiveSize = selectedOpt === '__custom__' ? customInput : selectedOpt;

  const addMutation = useMutation({
    mutationFn: (data) => variantsApi.create(plant.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plants'] });
      setSelectedOpt('');
      setCustomInput('');
      setNewSku('');
      setError('');
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to add'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => variantsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plants'] }); setDeleteTarget(null); },
  });

  const variants = plant.variants ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-3 text-sm">
        <div className="font-medium italic text-forest-900">{plant.scientific_name || plant.common_name}</div>
        {plant.scientific_name && <div className="text-forest-500 text-xs">{plant.common_name}</div>}
      </div>

      <div>
        <p className="text-xs text-forest-500 mb-2">
          {variants.length === 0 ? 'No sizes yet.' : `${variants.length} size${variants.length !== 1 ? 's' : ''}`}
        </p>
        {variants.map(v => (
          <VariantRow key={v.id} variant={v} onDelete={setDeleteTarget} />
        ))}
      </div>

      <div className="border-t border-forest-100 pt-3">
        <p className="text-xs font-medium text-forest-600 mb-2">Add Size</p>
        <div className="flex gap-2">
          <select
            className="input flex-1 text-sm"
            value={selectedOpt}
            onChange={e => { setSelectedOpt(e.target.value); setCustomInput(''); setError(''); }}
          >
            <option value="">— select size —</option>
            {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="__custom__">Other…</option>
          </select>
          <input
            className="input w-28 text-sm"
            placeholder="SKU (opt)"
            value={newSku}
            onChange={e => setNewSku(e.target.value)}
          />
          <button
            onClick={() => {
              if (!effectiveSize.trim()) return setError('Size is required');
              addMutation.mutate({ container_size: effectiveSize.trim(), sku: newSku.trim() || undefined });
            }}
            disabled={addMutation.isPending}
            className="btn-primary text-sm px-3"
          >
            Add
          </button>
        </div>
        {selectedOpt === '__custom__' && (
          <input
            className="input w-full text-sm mt-1.5"
            placeholder="Enter custom size…"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            autoFocus
          />
        )}
        {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
      </div>

      <div className="flex justify-end">
        <button onClick={onClose} className="btn-secondary text-sm">Done</button>
      </div>

      {deleteTarget && (
        <Confirm
          title="Remove Size"
          message={`Remove "${deleteTarget.container_size}" from ${plant.scientific_name || plant.common_name}? The variant will be deactivated but inventory history is preserved.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default function AdminPlants() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { sortCol, sortDir, sort2Col, setSort2Col, sort2Dir, setSort2Dir, handleSort } = useMultiSort('scientific_name');
  const [editPlant, setEditPlant] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [variantPlant, setVariantPlant] = useState(null);
  const [fetchingImageFor, setFetchingImageFor] = useState(null);
  const [imageMsg, setImageMsg] = useState('');

  const fetchImage = async (plant) => {
    setFetchingImageFor(plant.id);
    setImageMsg('');
    try {
      await inat.fetchPhoto(plant.id);
      setImageMsg(`Fetched image for "${plant.scientific_name || plant.common_name}"`);
      qc.invalidateQueries({ queryKey: ['plants'] });
    } catch {
      setImageMsg(`No image found for "${plant.scientific_name || plant.common_name}" on iNaturalist`);
    } finally {
      setFetchingImageFor(null);
      setTimeout(() => setImageMsg(''), 4000);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['plants', page, search, typeFilter],
    queryFn: () => plantsApi.list({ page, limit: 50, search: search || undefined, type: typeFilter || undefined })
      .then(r => r.data),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => plantsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plants'] }); setDeleteTarget(null); },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => plantsApi.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plants'] });
      setSelected(new Set());
      setBulkDeleteOpen(false);
    },
  });

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); setSelected(new Set()); };
  const handleType   = (e) => { setTypeFilter(e.target.value); setPage(1); setSelected(new Set()); };

  const sortedPlants = useMemo(
    () => applyMultiSort(data?.plants ?? [], sortCol, sortDir, sort2Col, sort2Dir, plantsGetVal),
    [data?.plants, sortCol, sortDir, sort2Col, sort2Dir],
  );

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const allPageSelected = sortedPlants.length > 0 && sortedPlants.every(p => selected.has(p.id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelected(prev => { const next = new Set(prev); sortedPlants.forEach(p => next.delete(p.id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); sortedPlants.forEach(p => next.add(p.id)); return next; });
    }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Plants</h1>
          <p className="text-forest-500 text-sm mt-0.5">{data?.total ?? '…'} plants in database</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary self-start sm:self-auto">
          <Plus size={16} /> Add Plant
        </button>
      </div>

      {imageMsg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${imageMsg.startsWith('Fetched') ? 'bg-forest-100 text-forest-700' : 'bg-red-50 text-red-700'}`}>
          {imageMsg}
        </div>
      )}

      <div className="card p-4 mb-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
            <input
              className="input pl-9"
              placeholder="Search by scientific name, common name, region, or SKU…"
              value={search}
              onChange={handleSearch}
            />
          </div>
          <select className="select w-44" value={typeFilter} onChange={handleType}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
          </select>
        </div>
        <MultiSortBar
          columns={PLANTS_SORT_COLS}
          sortCol={sortCol}
          sort2Col={sort2Col}
          setSort2Col={setSort2Col}
          sort2Dir={sort2Dir}
          setSort2Dir={setSort2Dir}
        />
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-forest-900 text-white px-4 py-2.5 rounded-lg">
          <CheckSquare size={15} className="text-forest-300" />
          <span className="text-sm font-medium">{selected.size} plant{selected.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className="ml-auto flex items-center gap-1.5 text-sm bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 size={13} /> Delete Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-forest-400 hover:text-white transition-colors text-xs">
            Clear
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50 border-b border-forest-100 text-left">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-forest-300 text-forest-700 cursor-pointer"
                    title={allPageSelected ? 'Deselect all on page' : 'Select all on page'}
                  />
                </th>
                <SortHeader label="Scientific Name" col="scientific_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Common Name" col="common_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                <SortHeader label="Type" col="plant_type" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                <SortHeader label="Region" col="native_region" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                <th className="px-4 py-3 font-medium text-forest-600 hidden xl:table-cell">Attributes</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-center">Sizes</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-center">Active</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {isLoading ? (
                Array.from({length:10}).map((_,i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-forest-100 rounded animate-pulse w-3/4" /></td></tr>
                ))
              ) : sortedPlants.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-forest-400">No plants found</td></tr>
              ) : sortedPlants.map(plant => (
                <tr key={plant.id} className={`hover:bg-forest-50/60 transition-colors ${selected.has(plant.id) ? 'bg-forest-50' : ''}`}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(plant.id)}
                      onChange={() => toggleSelect(plant.id)}
                      className="w-4 h-4 rounded border-forest-300 text-forest-700 cursor-pointer"
                    />
                  </td>
                  {/* Scientific name (primary) + image */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {plant.image_url
                        ? <img src={plant.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-forest-100" />
                        : <div className="w-10 h-10 rounded-lg bg-forest-100 flex-shrink-0 flex items-center justify-center text-forest-300 text-xs">🌿</div>
                      }
                      <div>
                        <div className="font-medium italic text-forest-900">
                          {plant.scientific_name || <span className="not-italic text-forest-500 text-sm">{plant.common_name}</span>}
                        </div>
                        {plant.scientific_name && (
                          <div className="text-xs text-forest-500">{plant.common_name}</div>
                        )}
                        {plant.plant_code && <span className="text-xs text-forest-400 font-mono">{plant.plant_code}</span>}
                      </div>
                    </div>
                  </td>

                  {/* Common name (secondary, only shown on medium+ screens as separate column) */}
                  <td className="px-4 py-3 text-forest-600 hidden md:table-cell">
                    {plant.common_name || <span className="text-forest-300">—</span>}
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell">
                    {plant.plant_type && <TypeBadge type={plant.plant_type} />}
                  </td>

                  <td className="px-4 py-3 hidden lg:table-cell text-forest-600 text-xs">{plant.native_region || '—'}</td>

                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {plant.attracts_pollinators && <span className="badge-green text-xs">🐝 Pollinators</span>}
                      {plant.attracts_birds       && <span className="badge-blue  text-xs">🐦 Birds</span>}
                      {plant.is_edible            && <span className="badge-earth text-xs">🌿 Edible</span>}
                      {plant.is_fire_resistant    && <span className="badge-red   text-xs">🔥 Fire Res.</span>}
                      {plant.portland_plant_list  && <span className="badge-gray  text-xs">PDX</span>}
                    </div>
                  </td>

                  {/* Variant count — click to manage */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setVariantPlant(plant)}
                      title="Manage sizes/variants"
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors hover:border-forest-400 hover:text-forest-800 ${
                        (plant.variants?.length ?? 0) > 0
                          ? 'border-forest-300 text-forest-600'
                          : 'border-dashed border-forest-200 text-forest-400'
                      }`}
                    >
                      {(plant.variants?.length ?? 0) > 0 ? `${plant.variants.length} size${plant.variants.length !== 1 ? 's' : ''}` : '+ add'}
                    </button>
                  </td>

                  <td className="px-4 py-3 text-center">
                    {plant.is_active
                      ? <Eye size={15} className="inline text-forest-500" />
                      : <EyeOff size={15} className="inline text-forest-300" />}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => fetchImage(plant)}
                        disabled={fetchingImageFor === plant.id}
                        className={`btn px-2 py-1.5 rounded-lg transition-colors ${plant.image_url ? 'text-forest-300 hover:text-earth-500 hover:bg-earth-50' : 'text-earth-500 hover:bg-earth-50'}`}
                        title={plant.image_url ? 'Refresh image from iNaturalist' : 'Fetch image from iNaturalist'}
                      >
                        {fetchingImageFor === plant.id
                          ? <span className="text-xs animate-pulse">…</span>
                          : <ImagePlus size={14} />}
                      </button>
                      <button onClick={() => setEditPlant(plant)} className="btn-ghost px-2 py-1.5" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(plant)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="px-4 py-3 border-t border-forest-100">
            <Pagination page={page} total={data.total} limit={50} onPage={setPage} />
          </div>
        )}
      </div>

      {addOpen && (
        <Modal title="Add New Plant" onClose={() => setAddOpen(false)} size="lg">
          <PlantForm onClose={() => setAddOpen(false)} />
        </Modal>
      )}

      {editPlant && (
        <Modal title={`Edit: ${editPlant.scientific_name || editPlant.common_name}`} onClose={() => setEditPlant(null)} size="lg">
          <PlantForm plant={editPlant} onClose={() => setEditPlant(null)} />
        </Modal>
      )}

      {variantPlant && (
        <Modal title="Manage Sizes" onClose={() => setVariantPlant(null)} size="md">
          <VariantsPanel plant={variantPlant} onClose={() => setVariantPlant(null)} />
        </Modal>
      )}

      {deleteTarget && (
        <Confirm
          title="Delete Plant"
          message={`Remove "${deleteTarget.scientific_name || deleteTarget.common_name}" from the database? This will also remove its inventory and pricing records.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {bulkDeleteOpen && (
        <Confirm
          title={`Delete ${selected.size} Plant${selected.size !== 1 ? 's' : ''}?`}
          message={`This will deactivate ${selected.size} plant${selected.size !== 1 ? 's' : ''} and hide them from the system. Inventory history is preserved.`}
          confirmLabel={`Delete ${selected.size} Plant${selected.size !== 1 ? 's' : ''}`}
          onConfirm={() => bulkDeleteMutation.mutate([...selected])}
          onCancel={() => setBulkDeleteOpen(false)}
        />
      )}
    </div>
  );
}
