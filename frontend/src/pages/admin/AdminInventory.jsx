import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventory, pricing, locations as locationsApi, landscaping } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { SortHeader, MultiSortBar } from '../../components/ui/SortControls';
import { useMultiSort, applyMultiSort } from '../../hooks/useMultiSort';
import { FileDown, Tag, ChevronRight, ChevronDown, Plus, Trash2, MapPin, ArrowDownToLine } from 'lucide-react';
import { generateWholesalePdf } from '../../utils/wholesalePdf';
import { generateLocationPdf } from '../../utils/locationInventoryPdf';
import { generateRetailReadyPdf } from '../../utils/retailReadyPdf';

const AVAILABILITY_PRESETS = [
  'NOW',
  'Early Spring 26',
  'Late Spring 26',
  'Early Summer 26',
  'Late Summer 26',
  'Fall 26',
  'TBD',
];

const AVAIL_FILTER_OPTIONS = [
  { value: '',             label: 'All' },
  { value: 'in_stock',     label: 'In Stock' },
  { value: 'early_spring', label: 'Early Spring 26' },
  { value: 'late_spring',  label: 'Late Spring 26' },
  { value: 'incoming',     label: 'Incoming' },
  { value: 'has_label',    label: 'Has Availability Label' },
  { value: 'unavailable',  label: 'Unavailable' },
];

function matchesAvailFilter(item, filter) {
  if (!filter) return true;
  const onHand    = Number(item.quantity_on_hand  || 0);
  const reserved  = Number(item.quantity_reserved || 0);
  const available = onHand - reserved;
  const incoming  = Number(item.quantity_incoming || 0);
  const label     = (item.availability_label || '').trim().toLowerCase();

  switch (filter) {
    case 'in_stock':     return available > 0;
    case 'early_spring': return label.includes('early spring');
    case 'late_spring':  return label.includes('late spring');
    case 'incoming':     return available <= 0 && !label && incoming > 0;
    case 'has_label':    return !!label;
    case 'unavailable':  return available <= 0 && !label && incoming <= 0;
    default: return true;
  }
}

function LabelModal({ item, onClose }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(item.availability_label ?? '');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => inventory.update(item.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error || 'Failed to save'),
  });

  const submit = (e) => {
    e.preventDefault();
    mutation.mutate({ availability_label: label.trim() || null });
  };

  const plant = item.variant?.plant;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-4 text-sm">
        <div className="font-medium italic text-forest-900">{plant?.scientific_name || plant?.common_name}</div>
        {plant?.scientific_name && <div className="text-forest-500 text-xs">{plant?.common_name}</div>}
        <div className="text-forest-400 text-xs mt-0.5">{item.variant?.container_size}</div>
      </div>

      <div>
        <label className="label">Availability Label</label>
        <p className="text-xs text-forest-500 mb-2">
          Shown when stock is unavailable. Leave blank to clear.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {AVAILABILITY_PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setLabel(p === 'NOW' ? '' : p)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                (p === 'NOW' ? label === '' : label === p)
                  ? 'bg-forest-700 text-white border-forest-700'
                  : 'border-forest-200 text-forest-600 hover:border-forest-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          className="input"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Early Spring 26 or leave blank for none"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">Save</button>
      </div>
    </form>
  );
}

function LocationSelect({ value, onChange, locationList, placeholder = 'No location' }) {
  return (
    <select className="select text-sm" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {locationList.map(loc => (
        <option key={loc.id} value={loc.name}>{loc.name}</option>
      ))}
    </select>
  );
}

function AdjustModal({ item, onClose, initialLocation = '' }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [type, setType] = useState('adjustment');
  const [location, setLocation] = useState(initialLocation);
  const [notes, setNotes] = useState('');
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState([{ qty: '', location: initialLocation }]);
  const [error, setError] = useState('');

  const { data: locationList = [] } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => locationsApi.list({ active: 'true' }).then(r => r.data),
    staleTime: 60_000,
  });

  const isDelivery = type === 'delivery_received';
  const splitTotal = splits.reduce((s, r) => s + (parseInt(r.qty, 10) || 0), 0);

  const adjustMutation = useMutation({
    mutationFn: (data) => inventory.adjust(data),
  });

  const addSplitRow = () => setSplits(prev => [...prev, { qty: '', location: '' }]);
  const removeSplitRow = (i) => setSplits(prev => prev.filter((_, idx) => idx !== i));
  const updateSplit = (i, field, val) => setSplits(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (isDelivery && isSplit) {
      if (splits.some(r => !r.qty || isNaN(r.qty) || parseInt(r.qty, 10) <= 0)) {
        return setError('All split rows need a quantity greater than 0');
      }
      if (splitTotal <= 0) return setError('Total quantity must be greater than 0');

      try {
        for (const row of splits) {
          await adjustMutation.mutateAsync({
            variant_id: item.variant_id,
            quantity_change: parseInt(row.qty, 10),
            change_type: type,
            notes,
            location: row.location || undefined,
          });
        }
        qc.invalidateQueries({ queryKey: ['inventory'] });
        onClose();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to save one or more splits');
      }
      return;
    }

    if (!qty || isNaN(qty)) return setError('Enter a valid number');
    try {
      await adjustMutation.mutateAsync({
        variant_id: item.variant_id,
        quantity_change: parseInt(qty, 10),
        change_type: type,
        notes,
        location: location || undefined,
      });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const plant = item.variant?.plant;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-4 text-sm">
        <div className="font-medium italic text-forest-900">{plant?.scientific_name || plant?.common_name}</div>
        {plant?.scientific_name && <div className="text-forest-500 text-xs">{plant?.common_name}</div>}
        <div className="text-forest-400 text-xs mt-0.5">{item.variant?.container_size} &bull; Current total: <strong>{item.quantity_on_hand}</strong></div>
      </div>

      <div>
        <label className="label">Change Type</label>
        <select className="select" value={type} onChange={e => { setType(e.target.value); setIsSplit(false); }}>
          <option value="adjustment">Manual Adjustment</option>
          <option value="delivery_received">Delivery Received</option>
          <option value="damage">Damage / Loss</option>
          <option value="return">Return</option>
          <option value="sale">Sale</option>
        </select>
      </div>

      {isDelivery && (
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isSplit}
            onChange={e => setIsSplit(e.target.checked)}
            className="w-4 h-4 rounded border-forest-300"
          />
          <span className="text-forest-700 font-medium">Split delivery across multiple locations</span>
        </label>
      )}

      {isDelivery && isSplit ? (
        <div>
          <label className="label mb-2">Delivery Splits</label>
          <div className="space-y-2">
            {splits.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input text-sm w-24 flex-shrink-0"
                  type="number"
                  min="1"
                  value={row.qty}
                  onChange={e => updateSplit(i, 'qty', e.target.value)}
                  placeholder="Qty"
                />
                <div className="flex-1">
                  <LocationSelect
                    value={row.location}
                    onChange={val => updateSplit(i, 'location', val)}
                    locationList={locationList}
                    placeholder="No location"
                  />
                </div>
                {splits.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSplitRow(i)}
                    className="btn-ghost p-1.5 text-forest-400 hover:text-red-500 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <button type="button" onClick={addSplitRow} className="btn-ghost text-xs text-forest-500 flex items-center gap-1">
              <Plus size={13} /> Add split
            </button>
            <span className="text-xs text-forest-500">
              Total: <strong className="text-forest-800">{splitTotal}</strong> units
            </span>
          </div>
        </div>
      ) : (
        <div>
          <label className="label">Quantity Change</label>
          {!isDelivery && <p className="text-xs text-forest-500 mb-1">Use negative numbers to reduce (e.g. -5)</p>}
          <input
            className="input"
            type="number"
            value={qty}
            onChange={e => setQty(e.target.value)}
            placeholder={isDelivery ? 'Units received' : 'e.g. 10 or -3'}
            required
          />
        </div>
      )}

      {(!isSplit || !isDelivery) && (
        <div>
          <label className="label">Location {isDelivery ? '' : '(optional)'}</label>
          <LocationSelect
            value={location}
            onChange={setLocation}
            locationList={locationList}
            placeholder={isDelivery ? 'Select storage location' : 'No location change'}
          />
        </div>
      )}

      <div>
        <label className="label">Notes (optional)</label>
        <input className="input" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={adjustMutation.isPending} className="btn-primary">
          {adjustMutation.isPending ? 'Saving…' : isDelivery ? 'Receive Delivery' : 'Apply'}
        </button>
      </div>
    </form>
  );
}

// Modal for distributing existing inventory across locations without changing the total
function DistributeModal({ item, onClose }) {
  const qc = useQueryClient();
  const existing = item.location_splits ?? [];
  const [splits, setSplits] = useState(
    existing.length > 0
      ? existing.map(s => ({ location: s.location, qty: String(s.quantity) }))
      : [{ location: '', qty: '' }]
  );
  const [error, setError] = useState('');

  const { data: locationList = [] } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => locationsApi.list({ active: 'true' }).then(r => r.data),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (data) => inventory.setLocationSplits(item.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error || 'Failed to save'),
  });

  const addRow = () => setSplits(prev => [...prev, { location: '', qty: '' }]);
  const removeRow = (i) => setSplits(prev => prev.filter((_, idx) => idx !== i));
  const update = (i, field, val) => setSplits(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const total = splits.reduce((s, r) => s + (parseInt(r.qty, 10) || 0), 0);

  const submit = (e) => {
    e.preventDefault();
    const active = splits.filter(r => r.location && parseInt(r.qty, 10) > 0);
    if (active.length === 0) return setError('Add at least one location with a quantity');
    const hasDup = active.map(r => r.location).some((loc, i, arr) => arr.indexOf(loc) !== i);
    if (hasDup) return setError('Duplicate locations — each location must appear only once');
    mutation.mutate(active.map(r => ({ location: r.location, quantity: parseInt(r.qty, 10) })));
  };

  const plant = item.variant?.plant;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-4 text-sm">
        <div className="font-medium italic text-forest-900">{plant?.scientific_name || plant?.common_name}</div>
        {plant?.scientific_name && <div className="text-forest-500 text-xs">{plant?.common_name}</div>}
        <div className="text-forest-400 text-xs mt-0.5">
          {item.variant?.container_size} &bull; Total on hand: <strong>{item.quantity_on_hand}</strong>
        </div>
      </div>

      <p className="text-xs text-forest-500">
        Record how existing stock is distributed across locations. This does not change the total quantity on hand.
      </p>

      <div className="space-y-2">
        {splits.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input text-sm w-24 flex-shrink-0"
              type="number"
              min="0"
              value={row.qty}
              onChange={e => update(i, 'qty', e.target.value)}
              placeholder="Qty"
            />
            <div className="flex-1">
              <LocationSelect
                value={row.location}
                onChange={val => update(i, 'location', val)}
                locationList={locationList}
                placeholder="Select location"
              />
            </div>
            {splits.length > 1 && (
              <button type="button" onClick={() => removeRow(i)} className="btn-ghost p-1.5 text-forest-400 hover:text-red-500 flex-shrink-0">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow} className="btn-ghost text-xs text-forest-500 flex items-center gap-1">
          <Plus size={13} /> Add location
        </button>
        <span className={`text-xs ${total !== item.quantity_on_hand && total > 0 ? 'text-amber-600' : 'text-forest-500'}`}>
          Distributed: <strong>{total}</strong> / {item.quantity_on_hand}
          {total !== item.quantity_on_hand && total > 0 && ' (doesn\'t match total)'}
        </span>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">Save Distribution</button>
      </div>
    </form>
  );
}

// Modal to transfer inventory to a landscaping project or in-ground location
function TransferToProjectModal({ item, onClose }) {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [qty, setQty] = useState('1');
  const [installDate, setInstallDate] = useState('');
  const [status, setStatus] = useState('planned');
  const [locationNote, setLocationNote] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: projectsData } = useQuery({
    queryKey: ['landscaping-projects', 'all'],
    queryFn: () => Promise.all([
      landscaping.listProjects({ type: 'in_ground' }).then(r => r.data.projects),
      landscaping.listProjects({ type: 'landscaping_job' }).then(r => r.data.projects),
    ]).then(([inGround, jobs]) => ({ inGround, jobs })),
    staleTime: 30_000,
  });

  const available = (item.quantity_on_hand || 0) - (item.quantity_reserved || 0);

  const mutation = useMutation({
    mutationFn: (data) => landscaping.addPlant(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['landscaping-projects'] });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.error || 'Transfer failed'),
  });

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!projectId) return setError('Select a destination project or location');
    const quantity = parseInt(qty, 10);
    if (!quantity || quantity <= 0) return setError('Enter a valid quantity');
    if (quantity > available) return setError(`Only ${available} available in inventory`);
    mutation.mutate({
      variant_id: item.variant_id,
      quantity,
      install_date: installDate || undefined,
      status,
      location_note: locationNote || undefined,
      notes: notes || undefined,
      deduct_inventory: true,
    });
  };

  const plant = item.variant?.plant;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-4 text-sm">
        <div className="font-medium italic text-forest-900">{plant?.scientific_name || plant?.common_name}</div>
        {plant?.scientific_name && <div className="text-forest-500 text-xs">{plant?.common_name}</div>}
        <div className="text-forest-400 text-xs mt-0.5">
          {item.variant?.container_size} &bull; <span className={available <= 0 ? 'text-red-600 font-semibold' : 'font-semibold'}>{available}</span> available
        </div>
      </div>

      <div>
        <label className="label">Transfer To *</label>
        <select className="select" value={projectId} onChange={e => setProjectId(e.target.value)} required>
          <option value="">— Select destination —</option>
          {projectsData?.inGround?.length > 0 && (
            <optgroup label="In Ground Locations">
              {projectsData.inGround.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.location ? ` – ${p.location}` : ''}</option>
              ))}
            </optgroup>
          )}
          {projectsData?.jobs?.length > 0 && (
            <optgroup label="Landscaping Jobs">
              {projectsData.jobs.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.client_name ? ` (${p.client_name})` : ''}</option>
              ))}
            </optgroup>
          )}
        </select>
        {!projectsData?.inGround?.length && !projectsData?.jobs?.length && (
          <p className="text-xs text-amber-700 mt-1">No in-ground locations or landscaping jobs exist yet. Create one under <strong>In Ground</strong> first.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Quantity *</label>
          <input
            className="input"
            type="number"
            min="1"
            max={available}
            value={qty}
            onChange={e => setQty(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Plant Status</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="planned">Planned</option>
            <option value="installed">Installed</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Install Date</label>
        <input className="input" type="date" value={installDate} onChange={e => setInstallDate(e.target.value)} />
      </div>

      <div>
        <label className="label">Location / Spot (optional)</label>
        <input className="input" value={locationNote} onChange={e => setLocationNote(e.target.value)} placeholder="e.g. North bed, near entrance" />
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <input className="input" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        This will deduct {qty || '0'} unit{parseInt(qty) !== 1 ? 's' : ''} from inventory.
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending || available <= 0} className="btn-primary">
          {mutation.isPending ? 'Transferring…' : 'Transfer to Project'}
        </button>
      </div>
    </form>
  );
}

const INV_SORT_COLS = [
  { value: 'name',    label: 'Plant Name' },
  { value: 'on_hand', label: 'On Hand' },
];

function invGetVal(group, col) {
  if (col === 'name') return (group.plant?.scientific_name || group.plant?.common_name || '').toLowerCase();
  if (col === 'on_hand') return group.variants.reduce((s, v) => s + (v.quantity_on_hand || 0), 0);
  return '';
}

function getAvailabilityText(item) {
  const onHand    = Number(item.quantity_on_hand  || 0);
  const reserved  = Number(item.quantity_reserved || 0);
  const available = onHand - reserved;
  const incoming  = Number(item.quantity_incoming || 0);
  const label     = item.availability_label?.trim();

  if (available > 0) return `In Stock: ${available}`;
  if (label)         return label;
  if (incoming > 0)  return `Incoming: ${incoming}`;
  return 'Unavailable';
}

function getAvailabilityClass(item) {
  const onHand    = Number(item.quantity_on_hand  || 0);
  const reserved  = Number(item.quantity_reserved || 0);
  const available = onHand - reserved;
  const incoming  = Number(item.quantity_incoming || 0);
  const label     = item.availability_label?.trim();

  if (available > 0) return 'text-green-700 font-semibold';
  if (label)         return 'text-sky-700 font-medium';
  if (incoming > 0)  return 'text-amber-600 font-medium';
  return 'text-forest-400';
}

export default function AdminInventory() {
  const [page, setPage] = useState(1);
  const [lowOnly, setLowOnly] = useState(false);
  const [availFilter, setAvailFilter] = useState('');
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustInitialLocation, setAdjustInitialLocation] = useState('');
  const [labelItem, setLabelItem] = useState(null);
  const [distributeItem, setDistributeItem] = useState(null);
  const [transferItem, setTransferItem] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [retailPdfLoading, setRetailPdfLoading] = useState(false);
  const [locationReport, setLocationReport] = useState('');
  const { sortCol, sortDir, sort2Col, setSort2Col, sort2Dir, setSort2Dir, handleSort } = useMultiSort('name');
  const [expandedPlants, setExpandedPlants] = useState(new Set());

  const isFiltered = !!availFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', isFiltered ? 'all' : page, lowOnly, availFilter],
    queryFn: () => inventory.list({
      page:      isFiltered ? 1    : page,
      limit:     isFiltered ? 9999 : 9999,
      low_stock: lowOnly || undefined,
    }).then(r => r.data),
    keepPreviousData: true,
  });

  const allItems      = data?.inventory ?? [];
  const filteredItems = availFilter ? allItems.filter(i => matchesAvailFilter(i, availFilter)) : allItems;

  const { data: pricingData } = useQuery({
    queryKey: ['pricing', 'all'],
    queryFn: () => pricing.list({ limit: 9999 }).then(r => r.data),
    staleTime: 60_000,
  });
  const priceByVariant = Object.fromEntries(
    (pricingData?.pricing ?? []).map(p => [p.variant_id, p])
  );

  const { data: locationsData } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => locationsApi.list({ active: 'true' }).then(r => r.data),
    staleTime: 60_000,
  });
  const locationOptions = (locationsData?.locations ?? locationsData ?? []).filter(l => l.is_active !== false);

  const groupedPlants = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const plantId = item.variant?.plant?.id;
      if (!plantId) return;
      if (!groups[plantId]) groups[plantId] = { plant: item.variant.plant, variants: [] };
      groups[plantId].variants.push(item);
    });
    return applyMultiSort(Object.values(groups), sortCol, sortDir, sort2Col, sort2Dir, invGetVal);
  }, [filteredItems, sortCol, sortDir, sort2Col, sort2Dir]);

  const togglePlant = (plantId) => {
    setExpandedPlants(prev => {
      const next = new Set(prev);
      next.has(plantId) ? next.delete(plantId) : next.add(plantId);
      return next;
    });
  };

  const allExpanded = groupedPlants.length > 0 && groupedPlants.every(g => expandedPlants.has(g.plant.id));
  const toggleAll = () => {
    setExpandedPlants(allExpanded ? new Set() : new Set(groupedPlants.map(g => g.plant.id)));
  };

  const openAdjust = (item, loc = '') => {
    setAdjustItem(item);
    setAdjustInitialLocation(loc);
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try { await generateWholesalePdf(); }
    finally { setPdfLoading(false); }
  };

  const handleRetailReadyPdf = () => {
    setRetailPdfLoading(true);
    try { generateRetailReadyPdf(allItems, priceByVariant); }
    finally { setRetailPdfLoading(false); }
  };

  const handleAvailFilter = (val) => { setAvailFilter(val); setPage(1); };

  const totalPlants   = groupedPlants.length;
  const totalVariants = filteredItems.length;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Inventory</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            {isLoading ? '…' : `${totalPlants} species · ${totalVariants} variants`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={availFilter}
            onChange={e => handleAvailFilter(e.target.value)}
            className={`select text-sm ${availFilter ? 'border-forest-500 text-forest-800' : ''}`}
          >
            {AVAIL_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={e => { setLowOnly(e.target.checked); setPage(1); }}
              className="w-4 h-4 rounded border-forest-300 text-red-500 focus:ring-red-400"
            />
            <span className="text-forest-700">Low stock only</span>
          </label>

          <MultiSortBar
            columns={INV_SORT_COLS}
            sortCol={sortCol}
            sort2Col={sort2Col}
            setSort2Col={setSort2Col}
            sort2Dir={sort2Dir}
            setSort2Dir={setSort2Dir}
          />

          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="btn-secondary text-sm gap-2 flex items-center"
          >
            <FileDown size={15} />
            {pdfLoading ? 'Generating…' : 'Wholesale PDF'}
          </button>

          <button
            onClick={handleRetailReadyPdf}
            disabled={retailPdfLoading || isLoading}
            className="btn-secondary text-sm gap-2 flex items-center"
          >
            <FileDown size={15} />
            {retailPdfLoading ? 'Generating…' : 'Retail Ready PDF'}
          </button>

          <div className="flex items-center gap-1.5">
            <select
              className="select text-sm"
              value={locationReport}
              onChange={e => setLocationReport(e.target.value)}
            >
              <option value="">Location report…</option>
              {locationOptions.map(l => (
                <option key={l.id} value={l.name}>{l.name}</option>
              ))}
            </select>
            <button
              onClick={() => generateLocationPdf(locationReport, allItems, priceByVariant)}
              disabled={!locationReport}
              className="btn-secondary text-sm gap-2 flex items-center disabled:opacity-40 disabled:pointer-events-none"
            >
              <FileDown size={15} />
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50 border-b border-forest-100 text-left">
                <th className="px-3 py-3 w-8">
                  <button
                    onClick={toggleAll}
                    title={allExpanded ? 'Collapse all' : 'Expand all'}
                    className="text-forest-400 hover:text-forest-700 transition-colors"
                  >
                    {allExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                </th>
                <SortHeader label="Plant" col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 font-medium text-forest-600">Size</th>
                <SortHeader label="On Hand" col="on_hand" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center hidden sm:table-cell" />
                <th className="px-4 py-3 font-medium text-forest-600 text-center hidden sm:table-cell">Reserved</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-center hidden md:table-cell">Availability</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-right hidden lg:table-cell">Wholesale</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-center hidden md:table-cell">Location</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-3">
                      <div className="h-4 bg-forest-100 rounded animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : groupedPlants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-forest-400 text-sm">
                    No inventory records match this filter.
                  </td>
                </tr>
              ) : groupedPlants.map(({ plant, variants: plantVariants }) => {
                const isExpanded = expandedPlants.has(plant.id);
                const totalOnHand = plantVariants.reduce((s, v) => s + (v.quantity_on_hand || 0), 0);
                const hasLow = plantVariants.some(v => v.quantity_on_hand <= v.reorder_threshold && v.reorder_threshold > 0);

                return (
                  <>
                    {/* Plant group header row */}
                    <tr
                      key={`plant-${plant.id}`}
                      onClick={() => togglePlant(plant.id)}
                      className={`cursor-pointer transition-colors ${hasLow ? 'bg-red-50/40 hover:bg-red-50/60' : 'bg-forest-50/70 hover:bg-forest-100/60'}`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <ChevronRight
                          size={14}
                          className={`text-forest-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </td>
                      <td className="px-4 py-2.5" colSpan={2}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium italic text-forest-900">{plant.scientific_name || plant.common_name}</span>
                          {plant.scientific_name && plant.common_name && (
                            <span className="text-xs text-forest-500">{plant.common_name}</span>
                          )}
                          <span className="text-xs text-forest-400 bg-white border border-forest-200 px-1.5 py-0.5 rounded-full">
                            {plantVariants.length} {plantVariants.length === 1 ? 'size' : 'sizes'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                        <span className={`font-semibold text-sm ${totalOnHand <= 0 ? 'text-red-600' : hasLow ? 'text-amber-600' : 'text-forest-700'}`}>
                          {totalOnHand}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell" />
                      <td className="hidden md:table-cell" />
                      <td className="hidden lg:table-cell" />
                      <td className="hidden md:table-cell" />
                      <td />
                    </tr>

                    {/* Variant sub-rows */}
                    {isExpanded && plantVariants.map(item => {
                      const splits = item.location_splits ?? [];
                      const hasSplits = splits.length > 0;

                      return (
                        <>
                          <tr
                            key={item.id}
                            className={`transition-colors ${item.quantity_on_hand <= item.reorder_threshold && item.reorder_threshold > 0 ? 'bg-red-50/20' : 'hover:bg-forest-50/40'}`}
                          >
                            <td className="px-3 py-2.5">
                              <div className="w-px h-full" />
                            </td>
                            <td className="px-4 py-2.5 text-forest-400 text-xs pl-8">↳</td>
                            <td className="px-4 py-2.5 text-forest-600 font-medium text-sm">
                              {item.variant?.container_size}
                            </td>
                            <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                              <span className={`font-bold ${item.quantity_on_hand <= 0 ? 'text-red-600' : item.quantity_on_hand <= item.reorder_threshold && item.reorder_threshold > 0 ? 'text-amber-600' : 'text-forest-900'}`}>
                                {item.quantity_on_hand}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center text-forest-500 hidden sm:table-cell">{item.quantity_reserved}</td>
                            <td className={`px-4 py-2.5 text-center text-xs hidden md:table-cell ${getAvailabilityClass(item)}`}>
                              {getAvailabilityText(item)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-forest-700 text-sm hidden lg:table-cell">
                              {priceByVariant[item.variant_id]?.wholesale_price
                                ? `$${Number(priceByVariant[item.variant_id].wholesale_price).toFixed(2)}`
                                : <span className="text-forest-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center hidden md:table-cell">
                              {hasSplits ? (
                                <span className="inline-flex items-center gap-1 text-xs text-forest-500">
                                  <MapPin size={11} className="text-forest-400" />
                                  {splits.length} locations
                                </span>
                              ) : (
                                <span className="text-forest-400 text-xs">{item.location || '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={e => { e.stopPropagation(); setLabelItem(item); }}
                                  title="Set availability label"
                                  className="btn-ghost px-2 py-1.5 text-forest-400 hover:text-sky-600"
                                >
                                  <Tag size={14} />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setDistributeItem(item); }}
                                  title="Set location distribution"
                                  className="btn-ghost px-2 py-1.5 text-forest-400 hover:text-forest-700"
                                >
                                  <MapPin size={14} />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setTransferItem(item); }}
                                  title="Transfer to in-ground location or landscaping job"
                                  className="btn-ghost px-2 py-1.5 text-forest-400 hover:text-green-700"
                                >
                                  <ArrowDownToLine size={14} />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); openAdjust(item); }}
                                  className="btn-secondary text-xs px-3 py-1.5"
                                >
                                  Adjust
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Location split sub-rows */}
                          {hasSplits && splits.map(split => (
                            <tr
                              key={`${item.id}-split-${split.id}`}
                              className="bg-forest-50/30 border-t border-dashed border-forest-100"
                            >
                              <td colSpan={2} />
                              <td className="px-4 py-1.5 pl-12 text-forest-400 text-xs">
                                <span className="flex items-center gap-1">
                                  <MapPin size={10} className="text-forest-300 flex-shrink-0" />
                                  {split.location}
                                </span>
                              </td>
                              <td className="px-4 py-1.5 text-center text-xs font-medium text-forest-600 hidden sm:table-cell">
                                {split.quantity}
                              </td>
                              <td className="hidden sm:table-cell" />
                              <td className="hidden md:table-cell" />
                              <td className="hidden lg:table-cell" />
                              <td className="hidden md:table-cell" />
                              <td className="px-4 py-1.5 text-right">
                                <button
                                  onClick={e => { e.stopPropagation(); openAdjust(item, split.location); }}
                                  className="text-xs text-forest-400 hover:text-forest-700 underline"
                                >
                                  Adjust
                                </button>
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {adjustItem && (
        <Modal title="Adjust Inventory" onClose={() => setAdjustItem(null)} size="sm">
          <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} initialLocation={adjustInitialLocation} />
        </Modal>
      )}

      {labelItem && (
        <Modal title="Set Availability Label" onClose={() => setLabelItem(null)} size="sm">
          <LabelModal item={labelItem} onClose={() => setLabelItem(null)} />
        </Modal>
      )}

      {distributeItem && (
        <Modal title="Set Location Distribution" onClose={() => setDistributeItem(null)} size="sm">
          <DistributeModal item={distributeItem} onClose={() => setDistributeItem(null)} />
        </Modal>
      )}

      {transferItem && (
        <Modal title="Transfer to In Ground / Landscaping Job" onClose={() => setTransferItem(null)} size="sm">
          <TransferToProjectModal item={transferItem} onClose={() => setTransferItem(null)} />
        </Modal>
      )}
    </div>
  );
}
