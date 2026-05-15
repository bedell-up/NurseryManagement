import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  production as productionApi,
  productionGroups as groupsApi,
  productionStages as stagesApi,
  plants as plantsApi,
  locations as locationsApi,
  trayTypes as trayTypesApi,
  seedLots as seedLotsApi,
  plantTypeDefaults as plantTypeDefaultsApi,
} from '../../api/client';
import Modal from '../../components/ui/Modal';
import Confirm from '../../components/ui/Confirm';
import PlantSearchSelect from '../../components/admin/PlantSearchSelect';
import { SortHeader, MultiSortBar } from '../../components/ui/SortControls';
import { useMultiSort, applyMultiSort } from '../../hooks/useMultiSort';
import {
  Plus, Pencil, Trash2, ChevronRight,
  LayoutList, Layers, Sprout, FolderOpen, Leaf,
} from 'lucide-react';

const PROP_TYPES = ['seed', 'cutting', 'division', 'layering', 'grafting', 'other'];
const PROP_LABELS = {
  seed: 'Seed', cutting: 'Cutting', division: 'Division',
  layering: 'Layering', grafting: 'Grafting', other: 'Other',
};
const STATUS_OPTIONS = ['active', 'completed', 'failed', 'cancelled'];
const STATUS_COLORS = {
  active:    'bg-green-100 text-green-800',
  completed: 'bg-sky-100 text-sky-800',
  failed:    'bg-red-100 text-red-700',
  cancelled: 'bg-forest-100 text-forest-500',
};
const GROUP_STATUS_OPTIONS = ['active', 'completed', 'archived'];
const GROUP_STATUS_COLORS = {
  active:    'bg-green-100 text-green-800',
  completed: 'bg-sky-100 text-sky-800',
  archived:  'bg-forest-100 text-forest-500',
};

function germRate(batch) {
  if (!batch.quantity_successful || !batch.quantity_started) return null;
  return Math.round((batch.quantity_successful / batch.quantity_started) * 100);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PROD_SORT_COLS = [
  { value: 'plant',            label: 'Plant' },
  { value: 'status',           label: 'Status' },
  { value: 'propagation_type', label: 'Type' },
  { value: 'location',         label: 'Location' },
  { value: 'date_started',     label: 'Date Started' },
  { value: 'quantity_started', label: 'Qty Started' },
  { value: 'rate',             label: 'Rate' },
];

function prodGetVal(row, col) {
  switch (col) {
    case 'plant':            return (row.plant?.scientific_name || row.plant?.common_name || '').toLowerCase();
    case 'location':         return (row.location?.name || '').toLowerCase();
    case 'status':           return row.status || '';
    case 'propagation_type': return row.propagation_type || '';
    case 'date_started':     return row.date_started || '';
    case 'quantity_started': return row.quantity_started ?? 0;
    case 'rate':             return germRate(row) ?? -1;
    default:                 return '';
  }
}

function sortBatches(rows, sortCol, sortDir, sort2Col, sort2Dir) {
  return applyMultiSort(rows, sortCol, sortDir, sort2Col, sort2Dir, prodGetVal);
}

// ─── Group Form ───────────────────────────────────────────────────────────────

const EMPTY_GROUP = {
  name: '',
  description: '',
  status: 'active',
  date_started: '',
  notes: '',
};

function GroupForm({ group, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!group?.id;
  const [form, setForm] = useState(
    group ? { ...EMPTY_GROUP, ...group, date_started: group.date_started || '' } : { ...EMPTY_GROUP }
  );
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = (k) => ({ value: form[k] ?? '', onChange: e => set(k, e.target.value) });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? groupsApi.update(group.id, data) : groupsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-groups'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error || 'Save failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.name?.trim()) return setError('Name is required');
    mutation.mutate({
      ...form,
      date_started: form.date_started || null,
      description: form.description || null,
      notes: form.notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Group Name *</label>
        <input className="input" {...inp('name')} placeholder="e.g. Spring 2026 Seed Run" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Status</label>
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            {GROUP_STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date Started</label>
          <input className="input" type="date" {...inp('date_started')} />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <input className="input" {...inp('description')} placeholder="Brief description of this batch group" />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} {...inp('notes')} placeholder="Goals, conditions, observations…" />
      </div>
      {error && <p className="text-red-600 text-sm bg-red-50 rounded px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2 border-t border-forest-100">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Group'}
        </button>
      </div>
    </form>
  );
}

// ─── Batch Form ───────────────────────────────────────────────────────────────

const WEIGHT_UNITS = [
  { value: 'g',  label: 'g',  factor: 1 },
  { value: 'oz', label: 'oz', factor: 28.3495 },
  { value: 'lb', label: 'lb', factor: 453.592 },
  { value: 'kg', label: 'kg', factor: 1000 },
];

function toGrams(value, unit) {
  const u = WEIGHT_UNITS.find(u => u.value === unit);
  return parseFloat(value || 0) * (u?.factor ?? 1);
}

function fromGrams(grams, unit) {
  const u = WEIGHT_UNITS.find(u => u.value === unit);
  return grams / (u?.factor ?? 1);
}

const EMPTY_BATCH = {
  plant_id: '',
  variant_id: '',
  propagation_type: 'seed',
  source_description: '',
  seed_lot_id: '',
  location_id: '',
  group_id: '',
  substrate_type: '',
  tray_type: '',
  pot_size: '',
  seeds_used_g: '',
  seeds_used_unit: 'g',
  quantity_started: '',
  quantity_target: '',
  quantity_successful: '',
  date_started: '',
  germination_date: '',
  estimated_ready_date: '',
  status: 'active',
  notes: '',
};

function BatchForm({ batch, onClose, defaultPlantId, defaultGroupId }) {
  const qc = useQueryClient();
  const isEdit = !!batch?.id;
  const [selectedLotId, setSelectedLotId] = useState('custom');

  const [form, setForm] = useState(
    batch
      ? {
          ...EMPTY_BATCH,
          ...batch,
          plant_id: batch.plant_id || '',
          variant_id: batch.variant_id || '',
          location_id: batch.location_id || '',
          group_id: batch.group_id || '',
          quantity_started: batch.quantity_started ?? '',
          quantity_target: batch.quantity_target ?? '',
          quantity_successful: batch.quantity_successful ?? '',
          date_started: batch.date_started || '',
          germination_date: batch.germination_date || '',
          estimated_ready_date: batch.estimated_ready_date || '',
        }
      : { ...EMPTY_BATCH, plant_id: defaultPlantId || '', group_id: defaultGroupId || '' }
  );
  const [error, setError] = useState('');

  const { data: plantsData } = useQuery({
    queryKey: ['plants-all'],
    queryFn: () => plantsApi.list({ limit: 9999 }).then(r => r.data),
    staleTime: 60_000,
  });
  const plants = (plantsData?.plants ?? []).slice().sort((a, b) => {
    const na = (a.scientific_name || a.common_name || '').toLowerCase();
    const nb = (b.scientific_name || b.common_name || '').toLowerCase();
    return na.localeCompare(nb);
  });
  const selectedPlant = plants.find(p => p.id === form.plant_id);
  const variants = selectedPlant?.variants ?? [];

  const { data: locationsData } = useQuery({
    queryKey: ['locations-all'],
    queryFn: () => locationsApi.list().then(r => r.data),
    staleTime: 60_000,
  });
  const locations = (locationsData?.locations ?? locationsData ?? []).filter(l => l.is_active !== false);

  const { data: groupsData } = useQuery({
    queryKey: ['production-groups'],
    queryFn: () => groupsApi.list().then(r => r.data),
    staleTime: 60_000,
  });
  const groups = (groupsData?.groups ?? []).filter(g => g.status !== 'archived');

  const { data: trayTypesData } = useQuery({
    queryKey: ['tray-types', 'tray'],
    queryFn: () => trayTypesApi.list({ category: 'tray' }).then(r => r.data),
    staleTime: 60_000,
  });
  const trayTypeOptions = (trayTypesData ?? []).filter(t => t.is_active);

  const { data: potSizesData } = useQuery({
    queryKey: ['tray-types', 'pot'],
    queryFn: () => trayTypesApi.list({ category: 'pot' }).then(r => r.data),
    staleTime: 60_000,
  });
  const potSizeOptions = (potSizesData ?? []).filter(t => t.is_active);

  const { data: plantTypeDefaultsList = [] } = useQuery({
    queryKey: ['plant-type-defaults'],
    queryFn: () => plantTypeDefaultsApi.list().then(r => r.data),
    staleTime: 60_000,
  });
  const plantTypeDefaultsMap = useMemo(
    () => Object.fromEntries(plantTypeDefaultsList.map(d => [d.plant_type, d])),
    [plantTypeDefaultsList]
  );

  const { data: allSeedLots = [] } = useQuery({
    queryKey: ['seed-lots'],
    queryFn: () => seedLotsApi.list().then(r => r.data),
    staleTime: 60_000,
  });
  const plantSeedLots = useMemo(
    () => allSeedLots.filter(l => l.plant_id === form.plant_id),
    [allSeedLots, form.plant_id]
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = (k) => ({ value: form[k] ?? '', onChange: e => set(k, e.target.value) });

  const [numTrays, setNumTrays] = useState('');

  const selectedTray = trayTypeOptions.find(t => t.name === form.tray_type) ?? null;
  const cellCount = selectedTray?.cell_count ?? 1;

  const handleTrayChange = (trayName) => {
    set('tray_type', trayName);
    if (numTrays !== '') {
      const tray = trayTypeOptions.find(t => t.name === trayName);
      const cells = tray?.cell_count ?? 1;
      set('quantity_started', String(parseInt(numTrays, 10) * cells));
    }
  };

  const handleNumTraysChange = (val) => {
    setNumTrays(val);
    if (val !== '' && !isNaN(parseInt(val, 10))) {
      set('quantity_started', String(parseInt(val, 10) * cellCount));
    }
  };

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? productionApi.update(batch.id, data)
      : productionApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production'] });
      qc.invalidateQueries({ queryKey: ['production-groups'] });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.error || 'Save failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.plant_id) return setError('Select a plant');
    if (!form.quantity_started || Number(form.quantity_started) < 1) return setError('Quantity started must be at least 1');

    const payload = {
      ...form,
      variant_id: form.variant_id || null,
      location_id: form.location_id || null,
      group_id: form.group_id || null,
      quantity_started: parseInt(form.quantity_started, 10),
      quantity_target: form.quantity_target !== '' ? parseInt(form.quantity_target, 10) : null,
      quantity_successful: form.quantity_successful !== '' ? parseInt(form.quantity_successful, 10) : null,
      date_started: form.date_started || null,
      germination_date: form.germination_date || null,
      estimated_ready_date: form.estimated_ready_date || null,
      source_description: form.source_description || null,
      seed_lot_id: form.seed_lot_id || null,
      substrate_type: form.substrate_type || null,
      tray_type: form.tray_type || null,
      pot_size: form.pot_size || null,
      seeds_used_g: form.seeds_used_g !== '' ? toGrams(form.seeds_used_g, form.seeds_used_unit) : null,
      seeds_used_unit: form.seeds_used_g !== '' ? form.seeds_used_unit : null,
      notes: form.notes || null,
    };
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Plant picker */}
      <div>
        <label className="label">Plant *</label>
        <PlantSearchSelect
          plants={plants}
          value={form.plant_id}
          disabled={!!defaultPlantId && isEdit}
          required
          onChange={(plantId, plant) => {
            set('plant_id', plantId);
            set('variant_id', '');
            setSelectedLotId('custom');
            if (plant?.plant_type) {
              const defaults = plantTypeDefaultsMap[plant.plant_type];
              if (defaults?.default_tray_types?.[0]) set('tray_type', defaults.default_tray_types[0]);
            }
          }}
        />
      </div>

      {/* Target size (optional) */}
      {variants.length > 0 && (
        <div>
          <label className="label">Target Size <span className="text-forest-400 font-normal">(optional)</span></label>
          <select className="select" value={form.variant_id} onChange={e => set('variant_id', e.target.value)}>
            <option value="">— not yet determined —</option>
            {variants.map(v => <option key={v.id} value={v.id}>{v.container_size}{v.sku ? ` · ${v.sku}` : ''}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Propagation Type *</label>
          <select className="select" value={form.propagation_type} onChange={e => set('propagation_type', e.target.value)}>
            {PROP_TYPES.map(t => <option key={t} value={t}>{PROP_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Location</label>
          <select className="select" value={form.location_id} onChange={e => set('location_id', e.target.value)}>
            <option value="">— not specified —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Batch Group</label>
          <select className="select" value={form.group_id} onChange={e => set('group_id', e.target.value)}>
            <option value="">— no group —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Source / Origin</label>
        {plantSeedLots.length > 0 ? (
          <div className="space-y-2">
            <select
              className="select"
              value={selectedLotId}
              onChange={e => {
                const lotId = e.target.value;
                setSelectedLotId(lotId);
                if (lotId !== 'custom') {
                  const lot = plantSeedLots.find(l => l.id === lotId);
                  if (lot) {
                    const parts = [lot.sourced_from].filter(Boolean);
                    if (lot.sourced_date) parts.push(lot.sourced_date);
                    set('source_description', parts.join(' · '));
                    set('seed_lot_id', lot.id);
                  }
                } else {
                  set('seed_lot_id', '');
                }
              }}
            >
              <option value="custom">— custom / new entry —</option>
              {plantSeedLots.map(lot => (
                <option key={lot.id} value={lot.id}>
                  {lot.sourced_from || 'Unknown source'}
                  {lot.sourced_date ? ` · ${lot.sourced_date}` : ''}
                  {parseFloat(lot.quantity_grams) > 0 ? ` (${parseFloat(lot.quantity_grams)}g on hand)` : ''}
                </option>
              ))}
            </select>
            <input
              className="input text-sm"
              {...inp('source_description')}
              placeholder={selectedLotId === 'custom' ? 'e.g. Wild collected, Trillium Creek 2025' : 'Auto-filled from seed bank — edit if needed'}
            />
          </div>
        ) : (
          <input className="input" {...inp('source_description')} placeholder="e.g. Wild collected, Trillium Creek 2025 · Purchased from Xera Plants" />
        )}
      </div>

      {/* Seeds Used — only shown for seed propagation */}
      {form.propagation_type === 'seed' && (() => {
        const activeLot = plantSeedLots.find(l => l.id === form.seed_lot_id);
        const usedG = form.seeds_used_g !== '' ? toGrams(form.seeds_used_g, form.seeds_used_unit) : 0;
        const remainingG = activeLot ? Math.max(0, parseFloat(activeLot.quantity_grams || 0) - usedG) : null;
        const selectedPlantData = plants.find(p => p.id === form.plant_id);
        const spg = parseFloat(selectedPlantData?.seeds_per_gram);
        const estimatedG = (!isNaN(spg) && spg > 0 && form.quantity_started !== '')
          ? parseInt(form.quantity_started, 10) / spg
          : null;

        return (
          <div className="bg-forest-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-forest-700">Seeds Used</span>
              {activeLot && (
                <span className="text-xs text-forest-500">
                  {parseFloat(activeLot.quantity_grams || 0).toFixed(3)} g in bank
                  {remainingG !== null && form.seeds_used_g !== '' && (
                    <span className={`ml-1 font-medium ${remainingG <= 0 ? 'text-red-600' : 'text-forest-700'}`}>
                      → {remainingG.toFixed(3)} g after
                    </span>
                  )}
                </span>
              )}
            </div>

            {estimatedG !== null && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2.5 py-1.5">
                Estimated: ~{fromGrams(estimatedG, form.seeds_used_unit).toFixed(3)} {form.seeds_used_unit} needed
                ({estimatedG.toFixed(3)} g) based on {spg} seeds/g × {form.quantity_started} seeds
              </p>
            )}

            <div className="flex items-center gap-3">
              <input
                className="input w-32"
                type="number"
                min="0"
                step="0.001"
                value={form.seeds_used_g}
                onChange={e => set('seeds_used_g', e.target.value)}
                placeholder="Amount"
              />
              <div className="flex gap-3">
                {WEIGHT_UNITS.map(u => (
                  <label key={u.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="seeds_used_unit"
                      value={u.value}
                      checked={form.seeds_used_unit === u.value}
                      onChange={() => set('seeds_used_unit', u.value)}
                      className="text-forest-600"
                    />
                    <span className="text-sm text-forest-700">{u.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {form.seeds_used_g !== '' && form.seeds_used_unit !== 'g' && (
              <p className="text-xs text-forest-400">= {toGrams(form.seeds_used_g, form.seeds_used_unit).toFixed(4)} g</p>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Substrate Type</label>
          <input className="input" {...inp('substrate_type')} placeholder="e.g. Perlite/peat mix" />
        </div>
        <div>
          <label className="label">Tray Type</label>
          <select className="select" value={form.tray_type} onChange={e => handleTrayChange(e.target.value)}>
            <option value="">— not specified —</option>
            {trayTypeOptions.map(t => (
              <option key={t.id} value={t.name}>
                {t.name}{t.cell_count > 1 ? ` (${t.cell_count} cells)` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Pot Size</label>
          <select className="select" value={form.pot_size} onChange={e => set('pot_size', e.target.value)}>
            <option value="">— not specified —</option>
            {potSizeOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="label"># Trays / Containers</label>
          <input
            className="input"
            type="number"
            min="1"
            value={numTrays}
            onChange={e => handleNumTraysChange(e.target.value)}
            placeholder="e.g. 5"
          />
          {numTrays !== '' && form.tray_type && (
            <p className="text-xs text-forest-500 mt-1">
              {numTrays} × {cellCount} = <span className="font-medium text-forest-700">{parseInt(numTrays, 10) * cellCount}</span> seeds
            </p>
          )}
        </div>
        <div>
          <label className="label">Qty Started *</label>
          <input className="input" type="number" min="1" {...inp('quantity_started')} placeholder="auto-filled or enter" required />
        </div>
        <div>
          <label className="label">Success Target</label>
          <input className="input" type="number" min="0" {...inp('quantity_target')} placeholder="e.g. 150" />
        </div>
        <div>
          <label className="label">Qty Successful <span className="text-forest-400 font-normal">(so far)</span></label>
          <input className="input" type="number" min="0" {...inp('quantity_successful')} placeholder="germinated / rooted" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Date Started</label>
          <input className="input" type="date" {...inp('date_started')} />
        </div>
        <div>
          <label className="label">Germination Date</label>
          <input className="input" type="date" {...inp('germination_date')} />
        </div>
        <div>
          <label className="label">Est. Ready Date</label>
          <input className="input" type="date" {...inp('estimated_ready_date')} />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} {...inp('notes')} placeholder="Germination conditions, observations…" />
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 rounded px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-forest-100">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Batch'}
        </button>
      </div>
    </form>
  );
}

// ─── Potting Stages Modal ─────────────────────────────────────────────────────

const STAGE_OPTIONS = [
  { value: 'potted', label: 'Potted',    hint: 'Moved to individual containers' },
  { value: 'tray',   label: 'In Tray',   hint: 'Still in germination tray' },
  { value: 'loss',   label: 'Loss',      hint: 'Died, failed, or culled' },
];
const STAGE_COLORS = {
  potted: 'bg-green-100 text-green-800',
  tray:   'bg-amber-100 text-amber-800',
  loss:   'bg-red-100 text-red-700',
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function StagesModal({ batch, onClose }) {
  const qc = useQueryClient();
  const [form, setForm]   = useState({ stage: 'potted', quantity: '', date: todayIso(), notes: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['production-stages', batch.id],
    queryFn:  () => stagesApi.list(batch.id).then(r => r.data),
    staleTime: 10_000,
  });

  const stages    = data?.stages    ?? [];
  const totals    = data?.totals    ?? { potted: 0, tray: 0, loss: 0, in_tray: 0 };
  const cellCount = data?.cell_count ?? 1;
  // seed_count accounts for trays × cells per tray; falls back to quantity_started
  const started   = data?.seed_count ?? (batch.quantity_started || 0);

  const createMutation = useMutation({
    mutationFn: (d) => stagesApi.create(batch.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-stages', batch.id] });
      qc.invalidateQueries({ queryKey: ['production'] });
      setForm(f => ({ ...f, quantity: '', notes: '' }));
      setError('');
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to save'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => stagesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-stages', batch.id] });
      qc.invalidateQueries({ queryKey: ['production'] });
      setEditId(null);
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => stagesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-stages', batch.id] });
      qc.invalidateQueries({ queryKey: ['production'] });
    },
  });

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');
    if (!form.quantity || Number(form.quantity) < 1) return setError('Enter a quantity');
    if (!form.date) return setError('Enter a date');
    createMutation.mutate({ ...form, quantity: parseInt(form.quantity, 10) });
  };

  const startEdit = (s) => {
    setEditId(s.id);
    setEditForm({ stage: s.stage, quantity: String(s.quantity), date: s.date, notes: s.notes || '' });
  };

  const handleUpdate = (e, id) => {
    e.preventDefault();
    updateMutation.mutate({ id, data: { ...editForm, quantity: parseInt(editForm.quantity, 10) } });
  };

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="bg-forest-50 rounded-lg px-4 py-3 flex flex-wrap gap-4 items-center text-sm">
        <div className="text-forest-600">
          <span className="font-semibold text-forest-900">{started.toLocaleString()}</span> seeds started
          {cellCount > 1 && (
            <span className="text-xs text-forest-400 ml-1.5">
              ({batch.quantity_started} tray{batch.quantity_started !== 1 ? 's' : ''} × {cellCount} cells)
            </span>
          )}
        </div>
        <div className="text-forest-400">→</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="font-semibold text-green-800">{totals.potted.toLocaleString()}</span>
          <span className="text-forest-500">potted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="font-semibold text-amber-800">{totals.in_tray.toLocaleString()}</span>
          <span className="text-forest-500">in tray</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="font-semibold text-red-700">{totals.loss.toLocaleString()}</span>
          <span className="text-forest-500">loss</span>
        </div>
        {totals.potted + totals.loss > started && (
          <span className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5">⚠ entries exceed quantity started</span>
        )}
      </div>

      {/* Stage log */}
      <div>
        <h3 className="text-xs font-semibold text-forest-500 uppercase tracking-wide mb-2">Stage Log</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-10 bg-forest-100 rounded animate-pulse" />)}
          </div>
        ) : stages.length === 0 ? (
          <p className="text-sm text-forest-400 py-4 text-center border border-dashed border-forest-200 rounded-lg">
            No stage entries yet. Add the first one below.
          </p>
        ) : (
          <div className="divide-y divide-forest-100 border border-forest-100 rounded-lg overflow-hidden">
            {stages.map(s => (
              <div key={s.id} className="px-4 py-3 bg-white hover:bg-forest-50/40 transition-colors">
                {editId === s.id ? (
                  <form onSubmit={(e) => handleUpdate(e, s.id)} className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="label text-xs">Stage</label>
                      <select
                        className="select text-sm py-1"
                        value={editForm.stage}
                        onChange={e => setEditForm(f => ({ ...f, stage: e.target.value }))}
                      >
                        {STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Qty</label>
                      <input
                        className="input w-20 text-sm py-1"
                        type="number" min="1"
                        value={editForm.quantity}
                        onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Date</label>
                      <input
                        className="input text-sm py-1"
                        type="date"
                        value={editForm.date}
                        onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                      />
                    </div>
                    <div className="flex-1 min-w-32">
                      <label className="label text-xs">Notes</label>
                      <input
                        className="input text-sm py-1"
                        value={editForm.notes}
                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="optional"
                      />
                    </div>
                    <div className="flex gap-1.5 pb-0.5">
                      <button type="submit" disabled={updateMutation.isPending} className="btn-primary text-xs px-3 py-1.5">Save</button>
                      <button type="button" onClick={() => setEditId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${STAGE_COLORS[s.stage]}`}>
                        {STAGE_OPTIONS.find(o => o.value === s.stage)?.label ?? s.stage}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-forest-900 text-sm">{s.quantity.toLocaleString()}</span>
                          <span className="text-xs text-forest-400">{fmtDate(s.date)}</span>
                        </div>
                        {s.notes && <p className="text-xs text-forest-500 mt-0.5 truncate">{s.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button onClick={() => startEdit(s)} className="btn-ghost px-2 py-1" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(s.id)}
                        disabled={deleteMutation.isPending}
                        className="btn px-2 py-1 text-red-400 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add entry form */}
      <div>
        <h3 className="text-xs font-semibold text-forest-500 uppercase tracking-wide mb-2">Add Stage Entry</h3>
        <form onSubmit={handleAdd} className="bg-forest-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="label text-xs">Stage *</label>
              <select
                className="select text-sm"
                value={form.stage}
                onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
              >
                {STAGE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-forest-400 mt-1">
                {STAGE_OPTIONS.find(o => o.value === form.stage)?.hint}
              </p>
            </div>
            <div>
              <label className="label text-xs">Quantity *</label>
              <input
                className="input text-sm"
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="e.g. 50"
                required
              />
            </div>
            <div>
              <label className="label text-xs">Date *</label>
              <input
                className="input text-sm"
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label text-xs">Notes</label>
              <input
                className="input text-sm"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="optional"
              />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 rounded px-3 py-2">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary text-sm">
              {createMutation.isPending ? 'Saving…' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Batch Row ────────────────────────────────────────────────────────────────

function stageSummary(batch) {
  const stages = batch.stages ?? [];
  if (!stages.length) return null;
  const potted = stages.filter(s => s.stage === 'potted').reduce((n, s) => n + s.quantity, 0);
  const loss   = stages.filter(s => s.stage === 'loss').reduce((n, s) => n + s.quantity, 0);
  return { potted, loss };
}

function BatchRow({ batch, showPlant, onEdit, onDelete, onStages }) {
  const rate = germRate(batch);
  const stg  = stageSummary(batch);
  return (
    <tr className="hover:bg-forest-50/60 transition-colors">
      {showPlant && (
        <td className="px-4 py-3">
          <div className="font-medium italic text-forest-900 text-sm">
            {batch.plant?.scientific_name || batch.plant?.common_name}
          </div>
          {batch.plant?.scientific_name && (
            <div className="text-xs text-forest-500">{batch.plant?.common_name}</div>
          )}
        </td>
      )}
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[batch.status]}`}>
          {batch.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-forest-700">
        <span className="inline-flex items-center gap-1">
          <Sprout size={13} className="text-forest-400" />
          {PROP_LABELS[batch.propagation_type]}
        </span>
        {batch.variant && (
          <div className="text-xs text-forest-400 mt-0.5">→ {batch.variant.container_size}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-forest-500 hidden sm:table-cell">
        {batch.location?.name || <span className="text-forest-300">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-forest-500 hidden sm:table-cell">
        {batch.source_description || <span className="text-forest-300">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-forest-500 hidden lg:table-cell">
        {batch.substrate_type || <span className="text-forest-300">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-forest-500 hidden lg:table-cell">
        {batch.tray_type || <span className="text-forest-300">—</span>}
      </td>
      <td className="px-4 py-3 text-center text-sm hidden md:table-cell">
        <span className="font-semibold text-forest-800">{batch.quantity_started}</span>
        {batch.quantity_target != null && (
          <span className="text-amber-600 text-xs font-medium"> → {batch.quantity_target}</span>
        )}
        {batch.quantity_successful != null && (
          <span className="text-forest-400 text-xs"> / {batch.quantity_successful}</span>
        )}
        {stg && (
          <div className="flex items-center justify-center gap-2 mt-0.5">
            {stg.potted > 0 && (
              <span className="text-xs text-green-700 font-medium">{stg.potted} potted</span>
            )}
            {stg.loss > 0 && (
              <span className="text-xs text-red-600 font-medium">{stg.loss} loss</span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center hidden md:table-cell">
        {rate != null ? (
          <span className={`text-sm font-medium ${rate >= 70 ? 'text-green-700' : rate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
            {rate}%
          </span>
        ) : <span className="text-forest-300 text-sm">—</span>}
      </td>
      <td className="px-4 py-3 text-xs text-forest-500 hidden lg:table-cell">{fmtDate(batch.date_started)}</td>
      <td className="px-4 py-3 text-xs text-forest-500 hidden lg:table-cell">{fmtDate(batch.germination_date)}</td>
      <td className="px-4 py-3 text-xs text-forest-500 hidden lg:table-cell">{fmtDate(batch.estimated_ready_date)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onStages(batch)}
            className={`btn-ghost px-2 py-1.5 ${(batch.stages?.length ?? 0) > 0 ? 'text-green-600' : 'text-forest-400'}`}
            title="Potting stages"
          >
            <Leaf size={14} />
          </button>
          <button onClick={() => onEdit(batch)} className="btn-ghost px-2 py-1.5" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(batch)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminProduction() {
  const qc = useQueryClient();
  const [view, setView] = useState('by-plant'); // 'by-plant' | 'master' | 'groups'
  const [statusFilter, setStatusFilter] = useState('active');

  // Batch modal state
  const [editBatch, setEditBatch] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForPlant, setAddForPlant] = useState(null);
  const [addForGroup, setAddForGroup] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [stagesBatch, setStagesBatch] = useState(null);

  // Group modal state
  const [editGroup, setEditGroup] = useState(null);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState(null);

  // Expand state
  const [expandedPlants, setExpandedPlants] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Multi-level sort (shared across all views)
  const { sortCol, sortDir, sort2Col, setSort2Col, sort2Dir, setSort2Dir, handleSort } = useMultiSort('plant');

  const { data, isLoading } = useQuery({
    queryKey: ['production', statusFilter],
    queryFn: () => productionApi.list(statusFilter ? { status: statusFilter } : {}).then(r => r.data),
    staleTime: 30_000,
  });
  const batches = data?.production ?? [];

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['production-groups'],
    queryFn: () => groupsApi.list().then(r => r.data),
    staleTime: 30_000,
  });
  const groups = groupsData?.groups ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id) => productionApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production'] });
      qc.invalidateQueries({ queryKey: ['production-groups'] });
      setDeleteTarget(null);
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id) => groupsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-groups'] }); setDeleteGroupTarget(null); },
  });

  const togglePlant = (id) => setExpandedPlants(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleGroup = (id) => setExpandedGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Group by plant for by-plant view
  const groupedByPlant = useMemo(() => {
    const map = {};
    batches.forEach(b => {
      const pid = b.plant_id;
      if (!map[pid]) map[pid] = { plant: b.plant, batches: [] };
      map[pid].batches.push(b);
    });
    return Object.values(map).sort((a, b) => {
      const na = (a.plant?.scientific_name || a.plant?.common_name || '').toLowerCase();
      const nb = (b.plant?.scientific_name || b.plant?.common_name || '').toLowerCase();
      return na.localeCompare(nb);
    });
  }, [batches]);

  // Sorted flat list for master view
  const sortedBatches = useMemo(
    () => sortBatches(batches, sortCol, sortDir, sort2Col, sort2Dir),
    [batches, sortCol, sortDir, sort2Col, sort2Dir],
  );

  const tableHeaders = (showPlantCol) => (
    <tr className="bg-forest-50 border-b border-forest-100 text-left">
      {showPlantCol && (
        <SortHeader label="Plant" col="plant" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
      )}
      <SortHeader label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
      <SortHeader label="Type" col="propagation_type" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
      <SortHeader label="Location" col="location" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
      <th className="px-4 py-3 font-medium text-forest-600 hidden sm:table-cell">Source</th>
      <th className="px-4 py-3 font-medium text-forest-600 hidden lg:table-cell">Substrate</th>
      <th className="px-4 py-3 font-medium text-forest-600 hidden lg:table-cell">Tray</th>
      <SortHeader label="Started / Target / Success" col="quantity_started" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center hidden md:table-cell" />
      <SortHeader label="Rate" col="rate" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center hidden md:table-cell" />
      <SortHeader label="Date Started" col="date_started" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
      <th className="px-4 py-3 font-medium text-forest-600 hidden lg:table-cell">Germination</th>
      <th className="px-4 py-3 font-medium text-forest-600 hidden lg:table-cell">Est. Ready</th>
      <th className="px-4 py-3 font-medium text-forest-600 text-right">Actions</th>
    </tr>
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">In Production</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            {view === 'groups'
              ? (groupsLoading ? '…' : `${groups.length} group${groups.length !== 1 ? 's' : ''}`)
              : (isLoading ? '…' : `${batches.length} batch${batches.length !== 1 ? 'es' : ''}`)}
            {view !== 'groups' && (statusFilter ? ` · ${statusFilter}` : ' · all statuses')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter — hide in groups view */}
          {view !== 'groups' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={`select text-sm ${statusFilter ? 'border-forest-500 text-forest-800' : ''}`}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          )}

          <MultiSortBar
            columns={PROD_SORT_COLS}
            sortCol={sortCol}
            sort2Col={sort2Col}
            setSort2Col={setSort2Col}
            sort2Dir={sort2Dir}
            setSort2Dir={setSort2Dir}
          />

          {/* View toggle */}
          <div className="flex items-center bg-forest-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('by-plant')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                view === 'by-plant' ? 'bg-white text-forest-900 shadow-sm' : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              <Layers size={13} /> By Plant
            </button>
            <button
              onClick={() => setView('master')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                view === 'master' ? 'bg-white text-forest-900 shadow-sm' : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              <LayoutList size={13} /> Master List
            </button>
            <button
              onClick={() => setView('groups')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                view === 'groups' ? 'bg-white text-forest-900 shadow-sm' : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              <FolderOpen size={13} /> Groups
            </button>
          </div>

          {view === 'groups' ? (
            <button onClick={() => setAddGroupOpen(true)} className="btn-primary text-sm">
              <Plus size={15} /> New Group
            </button>
          ) : (
            <button onClick={() => setAddOpen(true)} className="btn-primary text-sm">
              <Plus size={15} /> Add Batch
            </button>
          )}
        </div>
      </div>

      {/* ── BY-PLANT VIEW ─────────────────────────────────────────────────── */}
      {view === 'by-plant' && (
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-4">
                <div className="h-5 bg-forest-100 rounded animate-pulse w-1/3 mb-2" />
                <div className="h-4 bg-forest-50 rounded animate-pulse w-1/2" />
              </div>
            ))
          ) : groupedByPlant.length === 0 ? (
            <div className="card p-12 text-center">
              <Sprout size={32} className="mx-auto text-forest-300 mb-3" />
              <p className="text-forest-500 font-medium">No production batches yet.</p>
              <p className="text-forest-400 text-sm mt-1">Click "Add Batch" to start tracking propagation.</p>
            </div>
          ) : groupedByPlant.map(({ plant, batches: plantBatches }) => {
            const isExpanded = expandedPlants.has(plant?.id);
            const activeCt = plantBatches.filter(b => b.status === 'active').length;
            const totalStarted = plantBatches.reduce((s, b) => s + (b.quantity_started || 0), 0);
            const sortedPlantBatches = sortBatches(plantBatches, sortCol, sortDir, sort2Col, sort2Dir);

            return (
              <div key={plant?.id} className="card overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-forest-50/50 transition-colors"
                  onClick={() => togglePlant(plant?.id)}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight size={16} className={`text-forest-400 transition-transform duration-150 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                    <div>
                      <div className="font-semibold italic text-forest-900">{plant?.scientific_name || plant?.common_name}</div>
                      {plant?.scientific_name && <div className="text-xs text-forest-500">{plant?.common_name}</div>}
                    </div>
                    {activeCt > 0 && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">{activeCt} active</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-forest-500">
                    <span>{plantBatches.length} batch{plantBatches.length !== 1 ? 'es' : ''}</span>
                    <span className="hidden sm:inline">{totalStarted.toLocaleString()} started</span>
                    <button onClick={e => { e.stopPropagation(); setAddForPlant(plant); }} className="btn-secondary text-xs px-3 py-1.5 ml-2">
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-forest-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>{tableHeaders(false)}</thead>
                      <tbody className="divide-y divide-forest-50">
                        {sortedPlantBatches.map(b => (
                          <BatchRow key={b.id} batch={b} showPlant={false} onEdit={setEditBatch} onDelete={setDeleteTarget} onStages={setStagesBatch} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MASTER LIST VIEW ──────────────────────────────────────────────── */}
      {view === 'master' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>{tableHeaders(true)}</thead>
              <tbody className="divide-y divide-forest-50">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={12} className="px-4 py-3">
                        <div className="h-4 bg-forest-100 rounded animate-pulse w-3/4" />
                      </td>
                    </tr>
                  ))
                ) : sortedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-forest-400">
                      No batches found. Add one to get started.
                    </td>
                  </tr>
                ) : sortedBatches.map(b => (
                  <BatchRow key={b.id} batch={b} showPlant onEdit={setEditBatch} onDelete={setDeleteTarget} onStages={setStagesBatch} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GROUPS VIEW ───────────────────────────────────────────────────── */}
      {view === 'groups' && (
        <div className="space-y-4">
          {groupsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-4">
                <div className="h-5 bg-forest-100 rounded animate-pulse w-1/3 mb-2" />
                <div className="h-4 bg-forest-50 rounded animate-pulse w-1/2" />
              </div>
            ))
          ) : groups.length === 0 ? (
            <div className="card p-12 text-center">
              <FolderOpen size={32} className="mx-auto text-forest-300 mb-3" />
              <p className="text-forest-500 font-medium">No batch groups yet.</p>
              <p className="text-forest-400 text-sm mt-1">Click "New Group" to create one, then add batches to it.</p>
            </div>
          ) : groups.map(group => {
            const isExpanded = expandedGroups.has(group.id);
            const groupBatches = group.batches ?? [];
            const activeCt = groupBatches.filter(b => b.status === 'active').length;
            const totalStarted = groupBatches.reduce((s, b) => s + (b.quantity_started || 0), 0);
            const sortedGroupBatches = sortBatches(groupBatches, sortCol, sortDir, sort2Col, sort2Dir);

            return (
              <div key={group.id} className="card overflow-hidden">
                {/* Group header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-forest-50/50 transition-colors"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight size={16} className={`text-forest-400 transition-transform duration-150 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                    <div>
                      <div className="font-semibold text-forest-900 flex items-center gap-2">
                        {group.name}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GROUP_STATUS_COLORS[group.status]}`}>
                          {group.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {group.date_started && (
                          <span className="text-xs text-forest-400">Started {fmtDate(group.date_started)}</span>
                        )}
                        {group.description && (
                          <span className="text-xs text-forest-400 hidden sm:inline truncate max-w-xs">{group.description}</span>
                        )}
                      </div>
                    </div>
                    {activeCt > 0 && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">{activeCt} active</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-forest-500">
                    <span>{groupBatches.length} batch{groupBatches.length !== 1 ? 'es' : ''}</span>
                    <span className="hidden sm:inline">{totalStarted.toLocaleString()} started</span>
                    <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setAddForGroup(group)}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        <Plus size={12} /> Add Batch
                      </button>
                      <button onClick={() => setEditGroup(group)} className="btn-ghost px-2 py-1.5" title="Edit group">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteGroupTarget(group)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete group">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Batches table */}
                {isExpanded && (
                  <div className="border-t border-forest-100 overflow-x-auto">
                    {sortedGroupBatches.length === 0 ? (
                      <div className="px-5 py-6 text-center text-forest-400 text-sm">
                        No batches in this group yet.{' '}
                        <button className="text-forest-600 underline" onClick={() => setAddForGroup(group)}>Add one</button>.
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>{tableHeaders(true)}</thead>
                        <tbody className="divide-y divide-forest-50">
                          {sortedGroupBatches.map(b => (
                            <BatchRow key={b.id} batch={b} showPlant onEdit={setEditBatch} onDelete={setDeleteTarget} onStages={setStagesBatch} />
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Batch Modals ─────────────────────────────────────────────────────── */}

      {addOpen && (
        <Modal title="Add Production Batch" onClose={() => setAddOpen(false)} size="md">
          <BatchForm onClose={() => setAddOpen(false)} />
        </Modal>
      )}

      {addForPlant && (
        <Modal title={`Add Batch — ${addForPlant.scientific_name || addForPlant.common_name}`} onClose={() => setAddForPlant(null)} size="md">
          <BatchForm defaultPlantId={addForPlant.id} onClose={() => setAddForPlant(null)} />
        </Modal>
      )}

      {addForGroup && (
        <Modal title={`Add Batch to "${addForGroup.name}"`} onClose={() => setAddForGroup(null)} size="md">
          <BatchForm defaultGroupId={addForGroup.id} onClose={() => setAddForGroup(null)} />
        </Modal>
      )}

      {editBatch && (
        <Modal title="Edit Production Batch" onClose={() => setEditBatch(null)} size="md">
          <BatchForm batch={editBatch} onClose={() => setEditBatch(null)} />
        </Modal>
      )}

      {deleteTarget && (
        <Confirm
          title="Delete Batch"
          message={`Remove this ${PROP_LABELS[deleteTarget.propagation_type]} batch for ${deleteTarget.plant?.scientific_name || deleteTarget.plant?.common_name}?`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {stagesBatch && (
        <Modal
          title={`Potting Stages — ${stagesBatch.plant?.scientific_name || stagesBatch.plant?.common_name}`}
          onClose={() => setStagesBatch(null)}
          size="md"
        >
          <StagesModal batch={stagesBatch} onClose={() => setStagesBatch(null)} />
        </Modal>
      )}

      {/* ── Group Modals ──────────────────────────────────────────────────────── */}

      {addGroupOpen && (
        <Modal title="New Batch Group" onClose={() => setAddGroupOpen(false)} size="md">
          <GroupForm onClose={() => setAddGroupOpen(false)} />
        </Modal>
      )}

      {editGroup && (
        <Modal title="Edit Batch Group" onClose={() => setEditGroup(null)} size="md">
          <GroupForm group={editGroup} onClose={() => setEditGroup(null)} />
        </Modal>
      )}

      {deleteGroupTarget && (
        <Confirm
          title="Delete Group"
          message={`Delete the group "${deleteGroupTarget.name}"? Batches in this group will not be deleted — they'll become ungrouped.`}
          onConfirm={() => deleteGroupMutation.mutate(deleteGroupTarget.id)}
          onCancel={() => setDeleteGroupTarget(null)}
        />
      )}
    </div>
  );
}
