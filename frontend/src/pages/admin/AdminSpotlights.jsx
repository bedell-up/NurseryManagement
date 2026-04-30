import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { spotlights } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Confirm from '../../components/ui/Confirm';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';

const EMPTY = {
  type: 'plant', title: '', subtitle: '', description: '', image_url: '',
  plant_id: '', countdown_label: '', countdown_ends_at: '',
  display_start_at: '', display_end_at: '', display_order: 0,
  is_active: true, cta_text: '', cta_url: '',
};

function SpotlightForm({ item, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!item?.id;
  const [form, setForm] = useState(item ? { ...EMPTY, ...item,
    countdown_ends_at: item.countdown_ends_at?.slice(0,16) || '',
    display_start_at:  item.display_start_at?.slice(0,16) || '',
    display_end_at:    item.display_end_at?.slice(0,16) || '',
  } : EMPTY);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d) => isEdit ? spotlights.update(item.id, d) : spotlights.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spotlights'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error || 'Failed'),
  });

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    ['countdown_ends_at','display_start_at','display_end_at'].forEach(k => { if (!payload[k]) payload[k] = null; });
    if (!payload.plant_id) payload.plant_id = null;
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Type</label>
          <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
            {['plant','project','sale','announcement'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className="label">Title *</label><input className="input" required value={form.title} onChange={e => set('title', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Subtitle</label><input className="input" value={form.subtitle} onChange={e => set('subtitle', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Image URL</label><input className="input" type="url" value={form.image_url} onChange={e => set('image_url', e.target.value)} /></div>
        <div><label className="label">CTA Button Text</label><input className="input" value={form.cta_text} onChange={e => set('cta_text', e.target.value)} placeholder="Shop Now" /></div>
        <div><label className="label">CTA URL</label><input className="input" value={form.cta_url} onChange={e => set('cta_url', e.target.value)} /></div>
        <div><label className="label">Countdown Label</label><input className="input" value={form.countdown_label} onChange={e => set('countdown_label', e.target.value)} placeholder="Sale ends in" /></div>
        <div><label className="label">Countdown Ends At</label><input className="input" type="datetime-local" value={form.countdown_ends_at} onChange={e => set('countdown_ends_at', e.target.value)} /></div>
        <div><label className="label">Display Start</label><input className="input" type="datetime-local" value={form.display_start_at} onChange={e => set('display_start_at', e.target.value)} /></div>
        <div><label className="label">Display End</label><input className="input" type="datetime-local" value={form.display_end_at} onChange={e => set('display_end_at', e.target.value)} /></div>
        <div><label className="label">Display Order</label><input className="input" type="number" value={form.display_order} onChange={e => set('display_order', parseInt(e.target.value)||0)} /></div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded border-forest-300 text-forest-600 focus:ring-forest-500" />
            Active
          </label>
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">{isEdit ? 'Save' : 'Create'}</button>
      </div>
    </form>
  );
}

export default function AdminSpotlights() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['spotlights'],
    queryFn: () => spotlights.listAll().then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => spotlights.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spotlights'] }); setDeleteTarget(null); },
  });

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Spotlights</h1>
          <p className="text-forest-500 text-sm mt-0.5">Featured plants, sales, and announcements</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus size={16} /> New Spotlight</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? Array.from({length:3}).map((_,i) => <div key={i} className="card p-5 h-40 animate-pulse bg-forest-100" />) :
         items.map(item => (
          <div key={item.id} className={`card p-5 ${!item.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className={`badge-${item.type === 'sale' ? 'earth' : item.type === 'plant' ? 'green' : 'blue'} text-xs mb-2 block`}>{item.type}</span>
                <h3 className="font-semibold text-forest-900 leading-snug">{item.title}</h3>
                {item.subtitle && <p className="text-forest-500 text-sm mt-0.5">{item.subtitle}</p>}
              </div>
              {item.is_active && <Star size={14} className="text-earth-400 fill-earth-400 flex-shrink-0 mt-1" />}
            </div>
            {item.countdown_ends_at && (
              <p className="text-xs text-earth-600 mb-3">⏱ {item.countdown_label || 'Ends'}: {new Date(item.countdown_ends_at).toLocaleDateString()}</p>
            )}
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-forest-100">
              <span className="text-xs text-forest-400">Order: {item.display_order}</span>
              <div className="flex gap-1">
                <button onClick={() => setEditItem(item)} className="btn-ghost px-2 py-1.5"><Pencil size={13} /></button>
                <button onClick={() => setDeleteTarget(item)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {addOpen && <Modal title="New Spotlight" onClose={() => setAddOpen(false)} size="md"><SpotlightForm onClose={() => setAddOpen(false)} /></Modal>}
      {editItem && <Modal title="Edit Spotlight" onClose={() => setEditItem(null)} size="md"><SpotlightForm item={editItem} onClose={() => setEditItem(null)} /></Modal>}
      {deleteTarget && <Confirm title="Delete Spotlight" message={`Remove "${deleteTarget.title}"?`} onConfirm={() => deleteMutation.mutate(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}
