import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trayTypes as trayTypesApi } from '../../api/client';
import Confirm from '../../components/ui/Confirm';
import { Plus, Pencil, Trash2, Check, X, LayoutGrid, FlowerIcon } from 'lucide-react';

const TABS = [
  { key: 'tray', label: 'Tray Types',  icon: LayoutGrid,  noun: 'tray type',  placeholder: 'e.g. 72-cell plug tray' },
  { key: 'pot',  label: 'Pot Sizes',   icon: FlowerIcon,  noun: 'pot size',   placeholder: 'e.g. 4" pot, 1 gallon' },
];

const EMPTY = { name: '', sku_code: '', cell_count: 1, is_active: true, sort_order: 0 };

function Row({ tt, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-forest-50/60 transition-colors group">
      <td className="px-4 py-3">
        <div className="font-medium text-forest-900">{tt.name}</div>
      </td>
      <td className="px-4 py-3 text-center">
        {tt.sku_code
          ? <span className="font-mono text-xs bg-forest-100 text-forest-700 px-2 py-0.5 rounded">{tt.sku_code}</span>
          : <span className="text-forest-300 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-medium text-forest-700">{tt.cell_count ?? 1}</span>
      </td>
      <td className="px-4 py-3 text-sm text-forest-500 text-center">{tt.sort_order}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tt.is_active ? 'bg-green-100 text-green-700' : 'bg-forest-100 text-forest-500'}`}>
          {tt.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(tt)} className="btn-ghost px-2 py-1.5" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(tt)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function InlineForm({ initial = EMPTY, onSave, onCancel, isPending, error, placeholder }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <tr className="bg-forest-50">
      <td className="px-4 py-2">
        <input
          className="input text-sm w-full"
          placeholder={placeholder}
          value={form.name}
          onChange={set('name')}
          autoFocus
        />
        {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
      </td>
      <td className="px-4 py-2 align-top pt-3">
        <input
          className="input text-sm font-mono w-24 text-center uppercase"
          placeholder="e.g. 1G"
          value={form.sku_code}
          onChange={e => setForm(f => ({ ...f, sku_code: e.target.value.toUpperCase() }))}
          title="SKU size code"
        />
      </td>
      <td className="px-4 py-2 align-top pt-3">
        <input
          className="input text-sm w-20 text-center"
          type="number"
          min="1"
          value={form.cell_count ?? 1}
          onChange={e => setForm(f => ({ ...f, cell_count: parseInt(e.target.value, 10) || 1 }))}
          title="Seeds per tray / cells"
        />
      </td>
      <td className="px-4 py-2 align-top pt-3">
        <input
          className="input text-sm w-20 text-center"
          type="number"
          min="0"
          value={form.sort_order}
          onChange={set('sort_order')}
          title="Sort order"
        />
      </td>
      <td className="px-4 py-2 align-top pt-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            className="w-4 h-4 rounded border-forest-300"
          />
          <span className="text-forest-700">Active</span>
        </label>
      </td>
      <td className="px-4 py-2 align-top pt-2.5">
        <div className="flex items-center gap-1.5 justify-end">
          <button onClick={() => onSave(form)} disabled={isPending} className="btn-primary text-sm px-2.5 py-1.5">
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

function CategoryTab({ tab, category }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');

  const queryKey = ['tray-types', category];

  const { data: list = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => trayTypesApi.list({ category }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => trayTypesApi.create({ ...data, category }),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); qc.invalidateQueries({ queryKey: ['tray-types'] }); setAdding(false); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => trayTypesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); qc.invalidateQueries({ queryKey: ['tray-types'] }); setEditingId(null); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => trayTypesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); qc.invalidateQueries({ queryKey: ['tray-types'] }); setDeleteTarget(null); },
  });

  const handleAdd = (form) => {
    if (!form.name.trim()) return setFormError('Name is required');
    createMutation.mutate({ ...form, sort_order: parseInt(form.sort_order, 10) || 0 });
  };

  const handleUpdate = (form) => {
    if (!form.name.trim()) return setFormError('Name is required');
    updateMutation.mutate({ id: editingId, data: { ...form, sort_order: parseInt(form.sort_order, 10) || 0 } });
  };

  const Icon = tab.icon;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-forest-500 text-sm">{tab.label} available when logging production batches.</p>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); setFormError(''); }}
            className="btn-primary"
          >
            <Plus size={16} /> Add {tab.label.replace(/s$/, '')}
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-50 border-b border-forest-100 text-left">
              <th className="px-4 py-3 font-medium text-forest-600">Name</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-center">SKU Code</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-center">Cells / Seeds</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-center">Order</th>
              <th className="px-4 py-3 font-medium text-forest-600">Status</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-50">
            {adding && (
              <InlineForm
                onSave={handleAdd}
                onCancel={() => { setAdding(false); setFormError(''); }}
                isPending={createMutation.isPending}
                error={formError}
                placeholder={tab.placeholder}
              />
            )}
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-forest-100 rounded animate-pulse w-2/3" />
                  </td>
                </tr>
              ))
            ) : list.length === 0 && !adding ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <Icon size={30} className="mx-auto mb-3 text-forest-200" />
                  <p className="text-forest-400 font-medium">No {tab.label.toLowerCase()} yet</p>
                  <p className="text-forest-300 text-xs mt-1">Add entries to use them in production batches</p>
                </td>
              </tr>
            ) : (
              list.map(tt =>
                editingId === tt.id ? (
                  <InlineForm
                    key={tt.id}
                    initial={{ name: tt.name, sku_code: tt.sku_code || '', is_active: tt.is_active, sort_order: tt.sort_order }}
                    onSave={handleUpdate}
                    onCancel={() => { setEditingId(null); setFormError(''); }}
                    isPending={updateMutation.isPending}
                    error={formError}
                    placeholder={tab.placeholder}
                  />
                ) : (
                  <Row key={tt.id} tt={tt} onEdit={(t) => { setEditingId(t.id); setAdding(false); setFormError(''); }} onDelete={setDeleteTarget} />
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <Confirm
          title={`Delete ${tab.noun.replace(/^\w/, c => c.toUpperCase())}`}
          message={`Remove "${deleteTarget.name}"? Existing production batches using this value will keep it.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}

export default function AdminTrayTypes() {
  const [activeTab, setActiveTab] = useState('tray');
  const tab = TABS.find(t => t.key === activeTab);

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-forest-900">Trays &amp; Pot Sizes</h1>
        <p className="text-forest-500 text-sm mt-0.5">Reference data used when logging production batches.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-forest-100">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === t.key
                  ? 'border-forest-700 text-forest-900'
                  : 'border-transparent text-forest-400 hover:text-forest-700'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      <CategoryTab key={activeTab} tab={tab} category={activeTab} />
    </div>
  );
}
