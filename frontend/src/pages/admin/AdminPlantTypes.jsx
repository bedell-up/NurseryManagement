import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plantTypes as plantTypesApi } from '../../api/client';
import Confirm from '../../components/ui/Confirm';
import { Plus, Pencil, Trash2, Check, X, Layers } from 'lucide-react';

const EMPTY = { name: '', label: '', sort_order: 0, is_active: true };

function Row({ pt, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-forest-50/60 transition-colors group">
      <td className="px-4 py-3">
        <div className="font-medium text-forest-900">{pt.label}</div>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs bg-forest-100 text-forest-700 px-2 py-0.5 rounded">{pt.name}</span>
      </td>
      <td className="px-4 py-3 text-sm text-forest-500 text-center">{pt.sort_order}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pt.is_active ? 'bg-green-100 text-green-700' : 'bg-forest-100 text-forest-500'}`}>
          {pt.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(pt)} className="btn-ghost px-2 py-1.5" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(pt)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function InlineForm({ initial = EMPTY, isNew = false, onSave, onCancel, isPending, error }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });

  return (
    <tr className="bg-forest-50">
      <td className="px-4 py-2">
        <input
          className="input text-sm w-full"
          placeholder="Display name (e.g. Tree)"
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          autoFocus
        />
        {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
      </td>
      <td className="px-4 py-2 align-top pt-3">
        <input
          className="input text-sm font-mono w-36"
          placeholder="e.g. tree"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          title={isNew ? 'Slug / internal name (auto-generated if blank)' : 'Slug stored on plants — renaming updates the key but not existing plant records'}
        />
      </td>
      <td className="px-4 py-2 align-top pt-3">
        <input
          className="input text-sm w-20 text-center"
          type="number"
          min="0"
          value={form.sort_order}
          onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
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

export default function AdminPlantTypes() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['plant-types'],
    queryFn: () => plantTypesApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => plantTypesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plant-types'] });
      setAdding(false);
      setFormError('');
    },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => plantTypesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plant-types'] });
      setEditingId(null);
      setFormError('');
    },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => plantTypesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plant-types'] });
      setDeleteTarget(null);
    },
  });

  const handleAdd = (form) => {
    if (!form.label.trim()) return setFormError('Display name is required');
    createMutation.mutate({ ...form, sort_order: parseInt(form.sort_order, 10) || 0 });
  };

  const handleUpdate = (form) => {
    if (!form.label.trim()) return setFormError('Display name is required');
    updateMutation.mutate({ id: editingId, data: { name: form.name, label: form.label, is_active: form.is_active, sort_order: parseInt(form.sort_order, 10) || 0 } });
  };

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Layers size={20} className="text-forest-600" />
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Plant Types</h1>
        </div>
        <p className="text-forest-500 text-sm">
          Manage the plant type categories used throughout the app (trees, shrubs, perennials, etc.).
        </p>
      </div>

      <div className="flex justify-end mb-4">
        {!adding && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); setFormError(''); }}
            className="btn-primary"
          >
            <Plus size={16} /> Add Plant Type
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-50 border-b border-forest-100 text-left">
              <th className="px-4 py-3 font-medium text-forest-600">Display Name</th>
              <th className="px-4 py-3 font-medium text-forest-600">Slug / Key</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-center">Order</th>
              <th className="px-4 py-3 font-medium text-forest-600">Status</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-50">
            {adding && (
              <InlineForm
                isNew
                onSave={handleAdd}
                onCancel={() => { setAdding(false); setFormError(''); }}
                isPending={createMutation.isPending}
                error={formError}
              />
            )}
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-forest-100 rounded animate-pulse w-1/2" />
                  </td>
                </tr>
              ))
            ) : list.length === 0 && !adding ? (
              <tr>
                <td colSpan={5} className="px-4 py-14 text-center">
                  <Layers size={30} className="mx-auto mb-3 text-forest-200" />
                  <p className="text-forest-400 font-medium">No plant types yet</p>
                  <p className="text-forest-300 text-xs mt-1">Add types to use them when creating plants</p>
                </td>
              </tr>
            ) : (
              list.map(pt =>
                editingId === pt.id ? (
                  <InlineForm
                    key={pt.id}
                    initial={{ label: pt.label, name: pt.name, is_active: pt.is_active, sort_order: pt.sort_order }}
                    onSave={handleUpdate}
                    onCancel={() => { setEditingId(null); setFormError(''); }}
                    isPending={updateMutation.isPending}
                    error={formError}
                  />
                ) : (
                  <Row
                    key={pt.id}
                    pt={pt}
                    onEdit={(p) => { setEditingId(p.id); setAdding(false); setFormError(''); }}
                    onDelete={setDeleteTarget}
                  />
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <Confirm
          title="Delete Plant Type"
          message={`Remove "${deleteTarget.label}"? Plants already assigned this type will keep it, but it won't appear in dropdowns anymore.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
