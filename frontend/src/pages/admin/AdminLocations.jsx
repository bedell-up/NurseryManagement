import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locations as locationsApi } from '../../api/client';
import Confirm from '../../components/ui/Confirm';
import { Plus, Pencil, Trash2, Check, X, MapPin } from 'lucide-react';

const EMPTY = { name: '', description: '', shopify_location_id: '', is_active: true };

function LocationRow({ loc, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-forest-50/60 transition-colors group">
      <td className="px-4 py-3">
        <div className="font-medium text-forest-900">{loc.name}</div>
        {loc.description && <div className="text-xs text-forest-400 mt-0.5">{loc.description}</div>}
      </td>
      <td className="px-4 py-3 text-center">
        {loc.shopify_location_id
          ? <span className="font-mono text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded">{loc.shopify_location_id}</span>
          : <span className="text-forest-300 text-xs">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${loc.is_active ? 'bg-green-100 text-green-700' : 'bg-forest-100 text-forest-500'}`}>
          {loc.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(loc)} className="btn-ghost px-2 py-1.5" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(loc)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function InlineForm({ initial = EMPTY, onSave, onCancel, isPending, error }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <tr className="bg-forest-50">
      <td className="px-4 py-2">
        <input
          className="input text-sm w-full mb-1.5"
          placeholder="Location name *"
          value={form.name}
          onChange={set('name')}
          autoFocus
        />
        <input
          className="input text-sm w-full"
          placeholder="Description (optional)"
          value={form.description}
          onChange={set('description')}
        />
        {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
      </td>
      <td className="px-4 py-2 align-top pt-3">
        <input
          className="input text-sm font-mono w-40"
          placeholder="Shopify location ID"
          value={form.shopify_location_id}
          onChange={set('shopify_location_id')}
          title="Numeric ID from Shopify Admin → Settings → Locations (in the page URL)"
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
          <button onClick={() => onSave(form)} disabled={isPending} className="btn-primary text-sm px-2.5 py-1.5" title="Save">
            <Check size={14} />
          </button>
          <button onClick={onCancel} className="btn-secondary text-sm px-2.5 py-1.5" title="Cancel">
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminLocations() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');

  const { data: locationList = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => locationsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); setAdding(false); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => locationsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); setEditingId(null); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => locationsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); setDeleteTarget(null); },
  });

  const handleAdd = (form) => {
    if (!form.name.trim()) return setFormError('Location name is required');
    createMutation.mutate(form);
  };

  const handleUpdate = (form) => {
    if (!form.name.trim()) return setFormError('Location name is required');
    updateMutation.mutate({ id: editingId, data: form });
  };

  const startEdit = (loc) => {
    setEditingId(loc.id);
    setAdding(false);
    setFormError('');
  };

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Storage Locations</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            Define nursery storage areas to tag inventory by physical location.
          </p>
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setEditingId(null); setFormError(''); }} className="btn-primary">
            <Plus size={16} /> Add Location
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-50 border-b border-forest-100 text-left">
              <th className="px-4 py-3 font-medium text-forest-600">Location Name</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-center">Shopify Location ID</th>
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
              />
            )}

            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-4 bg-forest-100 rounded animate-pulse w-2/3" />
                  </td>
                </tr>
              ))
            ) : locationList.length === 0 && !adding ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center">
                  <MapPin size={32} className="mx-auto mb-3 text-forest-200" />
                  <p className="text-forest-400 font-medium">No locations yet</p>
                  <p className="text-forest-300 text-xs mt-1">Add locations to tag where inventory is stored</p>
                </td>
              </tr>
            ) : (
              locationList.map(loc =>
                editingId === loc.id ? (
                  <InlineForm
                    key={loc.id}
                    initial={{ name: loc.name, description: loc.description || '', shopify_location_id: loc.shopify_location_id || '', is_active: loc.is_active }}
                    onSave={handleUpdate}
                    onCancel={() => { setEditingId(null); setFormError(''); }}
                    isPending={updateMutation.isPending}
                    error={formError}
                  />
                ) : (
                  <LocationRow key={loc.id} loc={loc} onEdit={startEdit} onDelete={setDeleteTarget} />
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <Confirm
          title="Delete Location"
          message={`Remove "${deleteTarget.name}"? Inventory records using this location name will not be changed.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
