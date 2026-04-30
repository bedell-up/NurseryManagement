import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seedLots as seedLotsApi, plants as plantsApi } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Confirm from '../../components/ui/Confirm';
import { Plus, Pencil, Trash2, Sprout, Leaf } from 'lucide-react';

const WEIGHT_UNITS = [
  { value: 'g',  label: 'g',  factor: 1 },
  { value: 'oz', label: 'oz', factor: 28.3495 },
  { value: 'lb', label: 'lb', factor: 453.592 },
  { value: 'kg', label: 'kg', factor: 1000 },
];

function toGrams(value, unit) {
  const u = WEIGHT_UNITS.find(u => u.value === unit);
  return parseFloat(value) * (u?.factor ?? 1);
}

const EMPTY = {
  plant_id: '',
  sourced_from: '',
  qty_per_gram: '',
  seed_price: '',
  quantity_grams: '',
  sourced_date: '',
  notes: '',
};

function SeedLotForm({ initial = EMPTY, onSave, onCancel, isPending, error }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [qtyUnit, setQtyUnit] = useState('g');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: plantsData } = useQuery({
    queryKey: ['plants-all'],
    queryFn: () => plantsApi.list({ limit: 9999 }).then(r => r.data),
  });
  const plants = useMemo(() => {
    const list = plantsData?.plants ?? [];
    return list.slice().sort((a, b) =>
      (a.common_name || a.scientific_name || '').localeCompare(b.common_name || b.scientific_name || '')
    );
  }, [plantsData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const qtyGrams = form.quantity_grams !== '' ? toGrams(form.quantity_grams, qtyUnit) : 0;
    onSave({ ...form, quantity_grams: qtyGrams });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Species *</label>
        <select
          className="select"
          value={form.plant_id}
          onChange={set('plant_id')}
          required
        >
          <option value="">— select plant —</option>
          {plants.map(p => (
            <option key={p.id} value={p.id}>
              {p.common_name}{p.scientific_name ? ` (${p.scientific_name})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Sourced From</label>
          <input className="input" value={form.sourced_from} onChange={set('sourced_from')} placeholder="e.g. Xera Plants, wild collected" />
        </div>
        <div>
          <label className="label">Sourced Date</label>
          <input className="input" type="date" value={form.sourced_date} onChange={set('sourced_date')} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Seeds / Gram</label>
          <input className="input" type="number" min="0" step="0.01" value={form.qty_per_gram} onChange={set('qty_per_gram')} placeholder="0" />
        </div>
        <div>
          <label className="label">Price / Gram ($)</label>
          <input className="input" type="number" min="0" step="0.01" value={form.seed_price} onChange={set('seed_price')} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Qty on Hand</label>
          <div className="flex gap-1.5">
            <input className="input flex-1" type="number" min="0" step="0.001" value={form.quantity_grams} onChange={set('quantity_grams')} placeholder="0" />
            <select className="select w-16 px-1" value={qtyUnit} onChange={e => setQtyUnit(e.target.value)}>
              {WEIGHT_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          {form.quantity_grams !== '' && qtyUnit !== 'g' && (
            <p className="text-xs text-forest-400 mt-1">= {toGrams(form.quantity_grams, qtyUnit).toFixed(3)} g stored</p>
          )}
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Storage conditions, germination notes, etc." />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function AvailabilityBadge({ lot }) {
  const qty = parseFloat(lot.quantity_grams) || 0;
  const hasStock = qty > 0;

  return (
    <div className="flex flex-col gap-1">
      {lot.in_process && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <Sprout size={11} /> In Process
        </span>
      )}
      {hasStock ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          {qty}g available
        </span>
      ) : (
        !lot.in_process && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-forest-100 text-forest-400">
            None
          </span>
        )
      )}
    </div>
  );
}

export default function AdminSeedBank() {
  const qc = useQueryClient();
  const [modalLot, setModalLot] = useState(null); // null=closed, 'new'=create, object=edit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');

  const { data: lots = [], isLoading } = useQuery({
    queryKey: ['seed-lots'],
    queryFn: () => seedLotsApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => seedLotsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seed-lots'] }); setModalLot(null); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => seedLotsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seed-lots'] }); setModalLot(null); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => seedLotsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seed-lots'] }); setDeleteTarget(null); },
  });

  const handleSave = (form) => {
    if (!form.plant_id) return setFormError('Species is required');
    const payload = {
      plant_id: form.plant_id,
      sourced_from: form.sourced_from || null,
      qty_per_gram: form.qty_per_gram !== '' ? parseFloat(form.qty_per_gram) : null,
      seed_price: form.seed_price !== '' ? parseFloat(form.seed_price) : null,
      quantity_grams: form.quantity_grams !== '' ? parseFloat(form.quantity_grams) : 0,
      sourced_date: form.sourced_date || null,
      notes: form.notes || null,
    };
    if (modalLot === 'new') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: modalLot.id, data: payload });
    }
  };

  const openEdit = (lot) => {
    setFormError('');
    setModalLot({
      ...lot,
      qty_per_gram: lot.qty_per_gram ?? '',
      seed_price: lot.seed_price ?? '',
      quantity_grams: lot.quantity_grams ?? '',
      sourced_date: lot.sourced_date ?? '',
      sourced_from: lot.sourced_from ?? '',
      notes: lot.notes ?? '',
    });
  };

  const fmt = (val, decimals = 2) =>
    val != null && val !== '' ? Number(val).toFixed(decimals) : '—';

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Seed Bank</h1>
          <p className="text-forest-500 text-sm mt-0.5">Track seed lots by species — source, quantity, and pricing.</p>
        </div>
        <button
          onClick={() => { setModalLot('new'); setFormError(''); }}
          className="btn-primary"
        >
          <Plus size={16} /> Add Seed Lot
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-50 border-b border-forest-100 text-left">
              <th className="px-4 py-3 font-medium text-forest-600">Species</th>
              <th className="px-4 py-3 font-medium text-forest-600">Sourced From</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-right">Seeds/g</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-right">Price/g</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-right">Qty (g)</th>
              <th className="px-4 py-3 font-medium text-forest-600">Sourced Date</th>
              <th className="px-4 py-3 font-medium text-forest-600">Availability</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-4 py-3">
                    <div className="h-4 bg-forest-100 rounded animate-pulse w-3/4" />
                  </td>
                </tr>
              ))
            ) : lots.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <Leaf size={32} className="mx-auto mb-3 text-forest-200" />
                  <p className="text-forest-400 font-medium">No seed lots yet</p>
                  <p className="text-forest-300 text-xs mt-1">Add a seed lot to start tracking your seed bank inventory</p>
                </td>
              </tr>
            ) : (
              lots.map(lot => (
                <tr key={lot.id} className="hover:bg-forest-50/60 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="font-medium text-forest-900">{lot.plant?.common_name || '—'}</div>
                    {lot.plant?.scientific_name && (
                      <div className="text-xs text-forest-500 italic">{lot.plant.scientific_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-forest-700">{lot.sourced_from || <span className="text-forest-300">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-forest-700">{fmt(lot.qty_per_gram, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-forest-700">
                    {lot.seed_price != null ? `$${fmt(lot.seed_price)}` : <span className="text-forest-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-forest-900">
                    {fmt(lot.quantity_grams, 3)}
                  </td>
                  <td className="px-4 py-3 text-forest-600">
                    {lot.sourced_date
                      ? new Date(lot.sourced_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : <span className="text-forest-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <AvailabilityBadge lot={lot} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(lot)} className="btn-ghost px-2 py-1.5" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(lot)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalLot !== null && (
        <Modal
          title={modalLot === 'new' ? 'Add Seed Lot' : 'Edit Seed Lot'}
          onClose={() => { setModalLot(null); setFormError(''); }}
        >
          <SeedLotForm
            initial={modalLot === 'new' ? EMPTY : modalLot}
            onSave={handleSave}
            onCancel={() => { setModalLot(null); setFormError(''); }}
            isPending={createMutation.isPending || updateMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Confirm
          title="Delete Seed Lot"
          message={`Remove the seed lot for "${deleteTarget.plant?.common_name || 'this plant'}"? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
