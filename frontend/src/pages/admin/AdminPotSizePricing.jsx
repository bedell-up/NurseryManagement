import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { potSizeCosts as api, plantTypes as plantTypesApi, trayTypes as trayTypesApi, pricing as pricingApi } from '../../api/client';
import Confirm from '../../components/ui/Confirm';
import { Plus, Pencil, Trash2, Check, X, Layers, Wand2 } from 'lucide-react';

function fmtPrice(v) {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}


const EMPTY = { label: '', retail_price: '', wholesale_price: '', plant_type: '', notes: '', sort_order: 0 };

// ─── Inline form row ─────────────────────────────────────────────────────────

function InlineForm({ initial = EMPTY, onSave, onCancel, isPending, error, plantTypeOptions = [], sizeOptions = [] }) {
  // For the label field: track selected dropdown option separately from free-text custom value
  const initialIsCustom = initial.label && initial.label !== '' && !sizeOptions.includes(initial.label);
  const [selectedSize, setSelectedSize] = useState(initialIsCustom ? '__custom__' : (initial.label ?? ''));
  const [customSize,   setCustomSize]   = useState(initialIsCustom ? initial.label : '');

  const [form, setForm] = useState({
    ...EMPTY, ...initial,
    retail_price:    initial.retail_price    != null ? String(initial.retail_price)    : '',
    wholesale_price: initial.wholesale_price != null ? String(initial.wholesale_price) : '',
    plant_type:      initial.plant_type ?? '',
    notes:           initial.notes ?? '',
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Derive the actual label value to submit
  const effectiveLabel = selectedSize === '__custom__' ? customSize : selectedSize;

  // Wrap onSave to inject the computed label
  function handleSave() {
    onSave({ ...form, label: effectiveLabel });
  }

  return (
    <tr className="bg-amber-50/60">
      {/* Label */}
      <td className="px-4 py-2">
        <select
          className="input text-sm w-full"
          value={selectedSize}
          onChange={e => { setSelectedSize(e.target.value); setCustomSize(''); }}
          autoFocus
        >
          <option value="">— select size —</option>
          {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="__custom__">Other…</option>
        </select>
        {selectedSize === '__custom__' && (
          <input
            className="input text-sm w-full mt-1.5"
            placeholder="Enter custom size…"
            value={customSize}
            onChange={e => setCustomSize(e.target.value)}
            autoFocus
          />
        )}
        {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
      </td>

      {/* Plant Type */}
      <td className="px-4 py-2 align-top">
        <select
          className="input text-sm w-full"
          value={form.plant_type}
          onChange={set('plant_type')}
        >
          <option value="">— any —</option>
          {plantTypeOptions.map(t => <option key={t.name} value={t.label}>{t.label}</option>)}
        </select>
      </td>

      {/* Retail */}
      <td className="px-4 py-2 align-top">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-forest-400 text-xs">$</span>
          <input
            className="input text-sm pl-5 w-28"
            type="number" min="0" step="0.01"
            placeholder="0.00"
            value={form.retail_price}
            onChange={set('retail_price')}
          />
        </div>
      </td>

      {/* Wholesale */}
      <td className="px-4 py-2 align-top">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-forest-400 text-xs">$</span>
          <input
            className="input text-sm pl-5 w-28"
            type="number" min="0" step="0.01"
            placeholder="0.00"
            value={form.wholesale_price}
            onChange={set('wholesale_price')}
          />
        </div>
      </td>

      {/* Notes */}
      <td className="px-4 py-2 align-top">
        <input
          className="input text-sm w-full"
          placeholder="optional note"
          value={form.notes}
          onChange={set('notes')}
        />
      </td>

      {/* Sort */}
      <td className="px-4 py-2 align-top">
        <input
          className="input text-sm w-16 text-center"
          type="number" min="0"
          value={form.sort_order}
          onChange={set('sort_order')}
        />
      </td>

      {/* Actions */}
      <td className="px-4 py-2 align-top pt-2.5">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="btn-primary text-sm px-2.5 py-1.5"
          >
            <Check size={14} />
          </button>
          <button onClick={onCancel} className="btn-secondary text-sm px-2.5 py-1.5">
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Data row ─────────────────────────────────────────────────────────────────

function Row({ item, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-forest-50/60 transition-colors group">
      <td className="px-4 py-3 font-medium text-forest-900">{item.label}</td>
      <td className="px-4 py-3 text-sm text-forest-500">
        {item.plant_type
          ? <span className="inline-block px-2 py-0.5 rounded bg-forest-100 text-forest-700 text-xs font-medium">{item.plant_type}</span>
          : <span className="text-forest-300">—</span>}
      </td>
      <td className="px-4 py-3 text-center">
        {item.retail_price != null
          ? <span className="font-semibold text-forest-800">{fmtPrice(item.retail_price)}</span>
          : <span className="text-forest-300 text-sm">—</span>}
      </td>
      <td className="px-4 py-3 text-center">
        {item.wholesale_price != null
          ? <span className="font-medium text-forest-700">{fmtPrice(item.wholesale_price)}</span>
          : <span className="text-forest-300 text-sm">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-forest-500">{item.notes || '—'}</td>
      <td className="px-4 py-3 text-center text-sm text-forest-400">{item.sort_order}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(item)} className="btn-ghost px-2 py-1.5" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(item)} className="btn-ghost px-2 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPotSizePricing() {
  const qc = useQueryClient();
  const [adding,        setAdding]        = useState(false);
  const [editingId,     setEditingId]     = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [formError,     setFormError]     = useState('');
  const [backfillResult, setBackfillResult] = useState(null);

  const backfillMutation = useMutation({
    mutationFn: () => pricingApi.backfill().then(r => r.data),
    onSuccess:  (d) => setBackfillResult(d),
    onError:    (e) => setBackfillResult({ error: e.response?.data?.error || 'Backfill failed' }),
  });

  const QK = ['pot-size-costs'];

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: () => api.list().then(r => r.data),
    staleTime: 60_000,
  });
  const items = data?.pot_size_costs ?? [];

  const { data: plantTypesData } = useQuery({
    queryKey: ['plant-types'],
    queryFn: () => plantTypesApi.list().then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const plantTypeOptions = (plantTypesData ?? []).filter(t => t.is_active);

  const { data: trayTypesData } = useQuery({
    queryKey: ['tray-types', 'pot'],
    queryFn: () => trayTypesApi.list({ category: 'pot' }).then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const sizeOptions = useMemo(() => {
    const fromTrays  = (trayTypesData ?? []).map(t => t.name);
    const fromCosts  = items.map(i => i.label);
    return [...new Set([...fromTrays, ...fromCosts])].sort();
  }, [trayTypesData, items]);

  const createMutation = useMutation({
    mutationFn: (d) => api.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); setAdding(false); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); setEditingId(null); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); setDeleteTarget(null); },
  });

  const parseForm = (form) => ({
    label:           form.label.trim(),
    plant_type:      form.plant_type || null,
    retail_price:    form.retail_price    !== '' ? parseFloat(form.retail_price)    : null,
    wholesale_price: form.wholesale_price !== '' ? parseFloat(form.wholesale_price) : null,
    notes:           form.notes.trim()   || null,
    sort_order:      parseInt(form.sort_order, 10) || 0,
  });

  const handleAdd = (form) => {
    if (!form.label.trim()) return setFormError('Label is required');
    createMutation.mutate(parseForm(form));
  };

  const handleUpdate = (form) => {
    if (!form.label.trim()) return setFormError('Label is required');
    updateMutation.mutate({ id: editingId, data: parseForm(form) });
  };

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Container Pricing</h1>
          <p className="text-forest-500 text-sm mt-0.5">Default retail and wholesale prices by pot or container size.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setBackfillResult(null); backfillMutation.mutate(); }}
            disabled={backfillMutation.isPending}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Set retail + wholesale on any variant that has no price yet, using this grid. Wholesale = 50% of retail."
          >
            <Wand2 size={14} />
            {backfillMutation.isPending ? 'Backfilling…' : 'Backfill Unpriced'}
          </button>
          <button
            onClick={() => { setAdding(true); setEditingId(null); setFormError(''); }}
            className="btn-primary text-sm flex items-center gap-1.5"
            disabled={adding}
          >
            <Plus size={15} /> Add Size
          </button>
        </div>
      </div>

      {backfillResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3 ${backfillResult.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {backfillResult.error
            ? <span>{backfillResult.error}</span>
            : <span>
                Updated <strong>{backfillResult.updated}</strong> variant{backfillResult.updated !== 1 ? 's' : ''} with prices
                {backfillResult.skipped > 0 && <span className="text-green-600"> · {backfillResult.skipped} skipped (no matching container size)</span>}
              </span>}
          <button onClick={() => setBackfillResult(null)} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-50 border-b border-forest-100">
              <th className="px-4 py-3 text-left font-medium text-forest-600">Container / Pot Size</th>
              <th className="px-4 py-3 text-left font-medium text-forest-600">Plant Type</th>
              <th className="px-4 py-3 text-center font-medium text-forest-600">Retail</th>
              <th className="px-4 py-3 text-center font-medium text-forest-600">Wholesale</th>
              <th className="px-4 py-3 text-left font-medium text-forest-600">Notes</th>
              <th className="px-4 py-3 text-center font-medium text-forest-600">Order</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-50">
            {adding && (
              <InlineForm
                onSave={handleAdd}
                onCancel={() => { setAdding(false); setFormError(''); }}
                isPending={createMutation.isPending}
                error={formError}
                plantTypeOptions={plantTypeOptions}
                sizeOptions={sizeOptions}
              />
            )}

            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-forest-100 rounded animate-pulse" style={{ width: `${50 + (i % 3) * 20}%` }} />
                  </td>
                </tr>
              ))
            ) : items.length === 0 && !adding ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-forest-400">
                  <Layers size={28} className="mx-auto mb-2 text-forest-300" />
                  <p className="font-medium text-forest-500">No container sizes yet.</p>
                  <p className="text-sm mt-1">Click "Add Size" to build your pricing table.</p>
                </td>
              </tr>
            ) : items.map(item =>
              editingId === item.id ? (
                <InlineForm
                  key={item.id}
                  initial={item}
                  onSave={handleUpdate}
                  onCancel={() => { setEditingId(null); setFormError(''); }}
                  isPending={updateMutation.isPending}
                  error={formError}
                  plantTypeOptions={plantTypeOptions}
                  sizeOptions={sizeOptions}
                />
              ) : (
                <Row
                  key={item.id}
                  item={item}
                  onEdit={(i) => { setEditingId(i.id); setAdding(false); setFormError(''); }}
                  onDelete={setDeleteTarget}
                />
              )
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-forest-400">
        Use these as reference defaults when pricing new plants. Leave Wholesale blank to set it later.
      </p>

      {deleteTarget && (
        <Confirm
          title="Delete Size"
          message={`Remove "${deleteTarget.label}" from the pricing table?`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
