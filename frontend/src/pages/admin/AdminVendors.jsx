import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendors as vendorsApi } from '../../api/client';
import Confirm from '../../components/ui/Confirm';
import { Plus, Pencil, Trash2, Check, X, Building2 } from 'lucide-react';

const EMPTY = { name: '', code: '', contact_person: '', phone: '', email: '', notes: '' };

function VendorRow({ vendor, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-forest-50/60 transition-colors group">
      <td className="px-4 py-3">
        <div className="font-medium text-forest-900">{vendor.name}</div>
        {vendor.notes && <div className="text-xs text-forest-400 mt-0.5">{vendor.notes}</div>}
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-sm bg-forest-100 text-forest-700 px-2 py-0.5 rounded">
          {vendor.code}
        </span>
      </td>
      <td className="px-4 py-3 text-forest-600 text-sm">{vendor.contact_person || <span className="text-forest-300">—</span>}</td>
      <td className="px-4 py-3 text-forest-600 text-sm">{vendor.phone || <span className="text-forest-300">—</span>}</td>
      <td className="px-4 py-3 text-forest-600 text-sm">
        {vendor.email
          ? <a href={`mailto:${vendor.email}`} className="hover:text-forest-900 hover:underline">{vendor.email}</a>
          : <span className="text-forest-300">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(vendor)} className="btn-ghost px-2 py-1.5" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(vendor)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function InlineForm({ initial = EMPTY, onSave, onCancel, isPending, error }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <tr className="bg-forest-50">
      <td className="px-4 py-2">
        <input
          className="input text-sm w-full"
          placeholder="Vendor name *"
          value={form.name}
          onChange={set('name')}
          autoFocus
        />
        {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
      </td>
      <td className="px-4 py-2">
        <input
          className="input text-sm w-24 font-mono uppercase"
          placeholder="Code *"
          value={form.code}
          onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
          maxLength={10}
        />
      </td>
      <td className="px-4 py-2">
        <input
          className="input text-sm w-full"
          placeholder="Contact person"
          value={form.contact_person}
          onChange={set('contact_person')}
        />
      </td>
      <td className="px-4 py-2">
        <input
          className="input text-sm w-full"
          placeholder="Phone"
          value={form.phone}
          onChange={set('phone')}
          type="tel"
        />
      </td>
      <td className="px-4 py-2">
        <input
          className="input text-sm w-full"
          placeholder="Email"
          value={form.email}
          onChange={set('email')}
          type="email"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => onSave(form)}
            disabled={isPending}
            className="btn-primary text-sm px-2.5 py-1.5"
            title="Save"
          >
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

export default function AdminVendors() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');

  const { data: vendorList = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => vendorsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); setAdding(false); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => vendorsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); setEditingId(null); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => vendorsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); setDeleteTarget(null); },
  });

  const handleAdd = (form) => {
    if (!form.name.trim() || !form.code.trim()) return setFormError('Name and code are required');
    createMutation.mutate(form);
  };

  const handleUpdate = (form) => {
    if (!form.name.trim() || !form.code.trim()) return setFormError('Name and code are required');
    updateMutation.mutate({ id: editingId, data: form });
  };

  const startEdit = (vendor) => {
    setEditingId(vendor.id);
    setAdding(false);
    setFormError('');
  };

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Vendors</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            Manage nursery suppliers. The <span className="font-mono text-forest-700">Code</span> is appended to variant SKUs (e.g. <span className="font-mono">SIDNEL-1g-SO</span>).
          </p>
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setEditingId(null); setFormError(''); }} className="btn-primary">
            <Plus size={16} /> Add Vendor
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-50 border-b border-forest-100 text-left">
              <th className="px-4 py-3 font-medium text-forest-600">Vendor Name</th>
              <th className="px-4 py-3 font-medium text-forest-600">SKU Code</th>
              <th className="px-4 py-3 font-medium text-forest-600">Contact Person</th>
              <th className="px-4 py-3 font-medium text-forest-600">Phone</th>
              <th className="px-4 py-3 font-medium text-forest-600">Email</th>
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
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-forest-100 rounded animate-pulse w-2/3" />
                  </td>
                </tr>
              ))
            ) : vendorList.length === 0 && !adding ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <Building2 size={32} className="mx-auto mb-3 text-forest-200" />
                  <p className="text-forest-400 font-medium">No vendors yet</p>
                  <p className="text-forest-300 text-xs mt-1">Add your first vendor to start tracking COGS by supplier</p>
                </td>
              </tr>
            ) : (
              vendorList.map(vendor =>
                editingId === vendor.id ? (
                  <InlineForm
                    key={vendor.id}
                    initial={{ name: vendor.name, code: vendor.code, contact_person: vendor.contact_person || '', phone: vendor.phone || '', email: vendor.email || '', notes: vendor.notes || '' }}
                    onSave={handleUpdate}
                    onCancel={() => { setEditingId(null); setFormError(''); }}
                    isPending={updateMutation.isPending}
                    error={formError}
                  />
                ) : (
                  <VendorRow key={vendor.id} vendor={vendor} onEdit={startEdit} onDelete={setDeleteTarget} />
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <Confirm
          title="Delete Vendor"
          message={`Remove "${deleteTarget.name}" (${deleteTarget.code})? This won't delete any vendor SKUs already created with this code.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
