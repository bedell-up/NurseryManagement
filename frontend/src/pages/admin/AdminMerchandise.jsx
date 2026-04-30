import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { merchandise as merchandiseApi } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Confirm from '../../components/ui/Confirm';
import { Plus, Pencil, Trash2, TrendingUp } from 'lucide-react';

const EMPTY_FORM = {
  name: '', sku: '', category: '', description: '',
  supplier: '', cost: '', price: '',
  quantity_on_hand: '0', reorder_threshold: '0',
  location: '', notes: '', active: true,
};

function margin(cost, price) {
  const c = parseFloat(cost);
  const p = parseFloat(price);
  if (!c || !p || p === 0) return null;
  return ((p - c) / p * 100).toFixed(1);
}

function fmt(val) {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

function ItemForm({ initial, onClose, onSave, isPending, error }) {
  const [form, setForm] = useState(initial ? {
    ...initial,
    cost: initial.cost ?? '',
    price: initial.price ?? '',
    quantity_on_hand: String(initial.quantity_on_hand ?? 0),
    reorder_threshold: String(initial.reorder_threshold ?? 0),
  } : { ...EMPTY_FORM });

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: val }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      cost: form.cost !== '' ? parseFloat(form.cost) : null,
      price: form.price !== '' ? parseFloat(form.price) : null,
      quantity_on_hand: parseInt(form.quantity_on_hand, 10) || 0,
      reorder_threshold: parseInt(form.reorder_threshold, 10) || 0,
    });
  };

  const m = margin(form.cost, form.price);

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={set('name')} required placeholder="e.g. Bloomsday Tote Bag" />
        </div>
        <div>
          <label className="label">SKU</label>
          <input className="input" value={form.sku} onChange={set('sku')} placeholder="e.g. MERCH-TOTE-BLK" />
        </div>
        <div>
          <label className="label">Category</label>
          <input className="input" value={form.category} onChange={set('category')} placeholder="e.g. Apparel, Tools, Books" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input min-h-[70px] resize-y" value={form.description} onChange={set('description')} placeholder="Optional product description" />
        </div>
        <div>
          <label className="label">Supplier</label>
          <input className="input" value={form.supplier} onChange={set('supplier')} placeholder="Vendor or supplier name" />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location} onChange={set('location')} placeholder="e.g. Shelf A3, Display Case" />
        </div>

        <div>
          <label className="label">Cost of Goods</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400 text-sm">$</span>
            <input className="input pl-6" type="number" step="0.01" min="0" value={form.cost} onChange={set('cost')} placeholder="0.00" />
          </div>
        </div>
        <div>
          <label className="label">Retail Price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400 text-sm">$</span>
            <input className="input pl-6" type="number" step="0.01" min="0" value={form.price} onChange={set('price')} placeholder="0.00" />
          </div>
          {m !== null && (
            <p className="text-xs text-forest-500 mt-1 flex items-center gap-1">
              <TrendingUp size={11} />
              {m}% margin
            </p>
          )}
        </div>

        <div>
          <label className="label">Quantity on Hand</label>
          <input className="input" type="number" min="0" value={form.quantity_on_hand} onChange={set('quantity_on_hand')} />
        </div>
        <div>
          <label className="label">Reorder Threshold</label>
          <input className="input" type="number" min="0" value={form.reorder_threshold} onChange={set('reorder_threshold')} placeholder="Alert when stock falls to this level" />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <input className="input" value={form.notes} onChange={set('notes')} />
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input type="checkbox" checked={form.active} onChange={set('active')} className="w-4 h-4 rounded border-forest-300" />
            <span className="text-forest-700 font-medium">Active</span>
          </label>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function AdjustModal({ item, onClose }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => merchandiseApi.adjust(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merchandise'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error || 'Failed'),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!qty || isNaN(qty)) return setError('Enter a valid number');
    mutation.mutate({ id: item.id, quantity_change: parseInt(qty, 10), notes });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-4 text-sm">
        <div className="font-medium text-forest-900">{item.name}</div>
        {item.sku && <div className="text-forest-400 text-xs mt-0.5">{item.sku}</div>}
        <div className="text-forest-500 text-xs mt-0.5">Current stock: <strong>{item.quantity_on_hand}</strong></div>
      </div>
      <div>
        <label className="label">Quantity Change</label>
        <p className="text-xs text-forest-500 mb-1">Use negative numbers to reduce (e.g. -3)</p>
        <input
          className="input"
          type="number"
          value={qty}
          onChange={e => setQty(e.target.value)}
          placeholder="e.g. 10 or -3"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="label">Notes (optional)</label>
        <input className="input" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Saving…' : 'Apply'}
        </button>
      </div>
    </form>
  );
}

export default function AdminMerchandise() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['merchandise', showInactive],
    queryFn: () => merchandiseApi.list({ inactive: showInactive ? 'true' : undefined }).then(r => r.data),
    staleTime: 30_000,
  });

  const allItems = data?.merchandise ?? [];

  const categories = useMemo(() => {
    const cats = new Set(allItems.map(i => i.category).filter(Boolean));
    return [...cats].sort();
  }, [allItems]);

  const filtered = useMemo(() => {
    let items = allItems;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        (i.supplier || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter) items = items.filter(i => i.category === categoryFilter);
    if (lowOnly) items = items.filter(i =>
      i.reorder_threshold > 0 && i.quantity_on_hand <= i.reorder_threshold
    );
    return items;
  }, [allItems, search, categoryFilter, lowOnly]);

  const createMutation = useMutation({
    mutationFn: (data) => merchandiseApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merchandise'] }); setIsAdding(false); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => merchandiseApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merchandise'] }); setEditItem(null); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => merchandiseApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merchandise'] }); setDeleteItem(null); },
  });

  const lowCount = allItems.filter(i => i.reorder_threshold > 0 && i.quantity_on_hand <= i.reorder_threshold).length;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Merchandise</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            {isLoading ? '…' : `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`}
            {lowCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">· {lowCount} low stock</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input text-sm w-48"
            placeholder="Search name or SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className={`select text-sm ${categoryFilter ? 'border-forest-500 text-forest-800' : ''}`}
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={e => setLowOnly(e.target.checked)}
              className="w-4 h-4 rounded border-forest-300 text-red-500 focus:ring-red-400"
            />
            <span className="text-forest-700">Low stock</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-forest-300"
            />
            <span className="text-forest-700">Show inactive</span>
          </label>
          <button onClick={() => { setIsAdding(true); setFormError(''); }} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50 border-b border-forest-100 text-left">
                <th className="px-4 py-3 font-medium text-forest-600">Name</th>
                <th className="px-4 py-3 font-medium text-forest-600 hidden sm:table-cell">SKU</th>
                <th className="px-4 py-3 font-medium text-forest-600 hidden md:table-cell">Category</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-center">Stock</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-right hidden lg:table-cell">Cost</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-right hidden lg:table-cell">Price</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-right hidden lg:table-cell">Margin</th>
                <th className="px-4 py-3 font-medium text-forest-600 hidden md:table-cell">Location</th>
                <th className="px-4 py-3 font-medium text-forest-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-3">
                      <div className="h-4 bg-forest-100 rounded animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-forest-400">
                    No items match this filter.
                  </td>
                </tr>
              ) : filtered.map(item => {
                const isLow = item.reorder_threshold > 0 && item.quantity_on_hand <= item.reorder_threshold;
                const m = margin(item.cost, item.price);

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${isLow ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-forest-50/40'} ${!item.active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-forest-900">{item.name}</div>
                      {item.supplier && (
                        <div className="text-xs text-forest-400 mt-0.5">{item.supplier}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-forest-500 font-mono text-xs hidden sm:table-cell">
                      {item.sku || <span className="text-forest-300">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {item.category ? (
                        <span className="inline-block text-xs bg-forest-100 text-forest-600 rounded-full px-2 py-0.5">
                          {item.category}
                        </span>
                      ) : <span className="text-forest-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold text-sm ${item.quantity_on_hand <= 0 ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-forest-900'}`}>
                        {item.quantity_on_hand}
                      </span>
                      {isLow && (
                        <div className="text-xs text-red-500 font-normal">low</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-forest-600 hidden lg:table-cell">
                      {fmt(item.cost)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-forest-900 hidden lg:table-cell">
                      {fmt(item.price)}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      {m !== null ? (
                        <span className={`text-sm font-medium ${parseFloat(m) >= 50 ? 'text-green-700' : parseFloat(m) >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                          {m}%
                        </span>
                      ) : <span className="text-forest-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-forest-500 text-xs hidden md:table-cell">
                      {item.location || <span className="text-forest-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setAdjustItem(item)}
                          className="btn-secondary text-xs px-3 py-1.5"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => { setEditItem(item); setFormError(''); }}
                          className="btn-ghost p-1.5 text-forest-400 hover:text-forest-700"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteItem(item)}
                          className="btn-ghost p-1.5 text-forest-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isAdding && (
        <Modal title="Add Merchandise Item" onClose={() => setIsAdding(false)}>
          <ItemForm
            onClose={() => setIsAdding(false)}
            onSave={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Merchandise Item" onClose={() => setEditItem(null)}>
          <ItemForm
            initial={editItem}
            onClose={() => setEditItem(null)}
            onSave={(data) => updateMutation.mutate({ id: editItem.id, data })}
            isPending={updateMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {adjustItem && (
        <Modal title="Adjust Stock" onClose={() => setAdjustItem(null)} size="sm">
          <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} />
        </Modal>
      )}

      {deleteItem && (
        <Confirm
          title="Delete Item"
          message={`Delete "${deleteItem.name}"? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(deleteItem.id)}
          onCancel={() => setDeleteItem(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
