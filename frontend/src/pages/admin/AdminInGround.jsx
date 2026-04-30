import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { landscaping, inventory as inventoryApi } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Confirm from '../../components/ui/Confirm';
import PhotoGallery from '../../components/admin/PhotoGallery';
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  TreePine, MapPin, Calendar, Check, X, ArrowDownToLine, Images,
} from 'lucide-react';

const PROJECT_STATUSES = ['planned', 'active', 'completed', 'cancelled'];
const PLANT_STATUSES   = ['planned', 'installed', 'removed'];

const STATUS_COLORS = {
  planned:   'bg-sky-100 text-sky-700',
  active:    'bg-green-100 text-green-700',
  completed: 'bg-forest-100 text-forest-600',
  cancelled: 'bg-red-100 text-red-600',
  installed: 'bg-green-100 text-green-700',
  removed:   'bg-amber-100 text-amber-700',
};

const EMPTY_PROJECT = {
  name: '', client_name: '', location: '', description: '',
  status: 'active', start_date: '', end_date: '', notes: '',
};

// ---- ProjectFormModal ----
function ProjectFormModal({ initial, type, onClose, onSave, isPending, error }) {
  const [form, setForm] = useState(initial || { ...EMPTY_PROJECT });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const isJob = type === 'landscaping_job';

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...form, type }); }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={isJob ? '' : 'sm:col-span-2'}>
          <label className="label">{isJob ? 'Job Name *' : 'Location Name *'}</label>
          <input className="input" value={form.name} onChange={set('name')} required
            placeholder={isJob ? 'e.g. Smith Residence Front Yard' : 'e.g. Demo Garden – Section A'} />
        </div>
        {isJob && (
          <div>
            <label className="label">Client Name</label>
            <input className="input" value={form.client_name} onChange={set('client_name')} placeholder="Client name (optional)" />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label">{isJob ? 'Project Address / Location' : 'Location / Area'}</label>
          <input className="input" value={form.location} onChange={set('location')} placeholder="Address or area description" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={form.status} onChange={set('status')}>
            {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        {isJob && (
          <>
            <div>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input className="input" type="date" value={form.end_date} onChange={set('end_date')} />
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={2} value={form.description} onChange={set('description')} placeholder="Optional description" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} value={form.notes} onChange={set('notes')} placeholder="Optional notes" />
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

// ---- AddPlantsModal ----
function AddPlantsModal({ project, onClose }) {
  const qc = useQueryClient();
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [installDate, setInstallDate] = useState('');
  const [status, setStatus] = useState('planned');
  const [locationNote, setLocationNote] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: invData, isLoading: invLoading } = useQuery({
    queryKey: ['inventory', 'all-for-transfer'],
    queryFn: () => inventoryApi.list({ limit: 9999 }).then(r => r.data),
    staleTime: 30_000,
  });

  const allInventory = invData?.inventory ?? [];
  const selected = allInventory.find(i => i.variant_id === variantId);
  const available = selected ? (selected.quantity_on_hand - (selected.quantity_reserved || 0)) : null;

  // Group by plant name for the dropdown
  const grouped = {};
  allInventory.forEach(item => {
    const plant = item.variant?.plant;
    if (!plant) return;
    const key = plant.scientific_name || plant.common_name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });
  const sortedGroups = Object.keys(grouped).sort();

  const mutation = useMutation({
    mutationFn: (data) => landscaping.addPlant(project.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landscaping-projects'] });
      qc.invalidateQueries({ queryKey: ['landscaping-project', project.id] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to transfer plants'),
  });

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!variantId) return setError('Select a plant variant');
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) return setError('Quantity must be a positive number');
    if (available !== null && qty > available) {
      return setError(`Only ${available} available in inventory`);
    }
    mutation.mutate({
      variant_id: variantId,
      quantity: qty,
      install_date: installDate || undefined,
      status,
      location_note: locationNote || undefined,
      notes: notes || undefined,
      deduct_inventory: true,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-3 text-sm">
        <div className="font-medium text-forest-900">{project.name}</div>
        {project.location && <div className="text-forest-500 text-xs mt-0.5 flex items-center gap-1"><MapPin size={11} />{project.location}</div>}
      </div>

      <div>
        <label className="label">Plant / Variant *</label>
        {invLoading ? (
          <div className="input text-forest-400 text-sm">Loading inventory…</div>
        ) : (
          <select className="select" value={variantId} onChange={e => setVariantId(e.target.value)} required>
            <option value="">— Select a plant —</option>
            {sortedGroups.map(groupName => (
              <optgroup key={groupName} label={groupName}>
                {grouped[groupName].map(item => {
                  const avail = item.quantity_on_hand - (item.quantity_reserved || 0);
                  return (
                    <option key={item.variant_id} value={item.variant_id} disabled={avail <= 0}>
                      {item.variant?.container_size} — {avail} available
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        )}
        {selected && (
          <p className={`text-xs mt-1 ${available <= 0 ? 'text-red-600' : 'text-forest-500'}`}>
            {available} available ({selected.quantity_on_hand} on hand, {selected.quantity_reserved} reserved)
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Quantity *</label>
          <input
            className="input"
            type="number"
            min="1"
            max={available ?? undefined}
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            {PLANT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Install Date</label>
        <input className="input" type="date" value={installDate} onChange={e => setInstallDate(e.target.value)} />
      </div>

      <div>
        <label className="label">Location / Spot within {project.type === 'in_ground' ? 'Site' : 'Project'}</label>
        <input className="input" value={locationNote} onChange={e => setLocationNote(e.target.value)}
          placeholder="e.g. North bed, near entrance" />
      </div>

      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        This will deduct the selected quantity from nursery inventory.
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Transferring…' : 'Transfer to Project'}
        </button>
      </div>
    </form>
  );
}

// ---- EditPlantModal ----
function EditPlantModal({ plant, onClose }) {
  const qc = useQueryClient();
  const [quantity, setQuantity] = useState(String(plant.quantity));
  const [installDate, setInstallDate] = useState(plant.install_date || '');
  const [status, setStatus] = useState(plant.status);
  const [locationNote, setLocationNote] = useState(plant.location_note || '');
  const [notes, setNotes] = useState(plant.notes || '');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => landscaping.updatePlant(plant.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landscaping-project', plant.project_id] });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.error || 'Failed to save'),
  });

  const submit = (e) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) return setError('Quantity must be positive');
    mutation.mutate({
      quantity: qty,
      install_date: installDate || null,
      status,
      location_note: locationNote || null,
      notes: notes || null,
    });
  };

  const plantName = plant.variant?.plant?.scientific_name || plant.variant?.plant?.common_name || '—';

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-3 text-sm">
        <div className="font-medium italic text-forest-900">{plantName}</div>
        <div className="text-forest-500 text-xs">{plant.variant?.container_size}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Quantity</label>
          <input className="input" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} required />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            {PLANT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Install Date</label>
        <input className="input" type="date" value={installDate} onChange={e => setInstallDate(e.target.value)} />
      </div>

      <div>
        <label className="label">Location / Spot</label>
        <input className="input" value={locationNote} onChange={e => setLocationNote(e.target.value)} placeholder="e.g. North bed" />
      </div>

      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">Save</button>
      </div>
    </form>
  );
}

// ---- PlantRow ----
function PlantRow({ plant, onEdit, onRemove }) {
  const plantName = plant.variant?.plant?.scientific_name || plant.variant?.plant?.common_name || '—';
  const commonName = plant.variant?.plant?.scientific_name ? plant.variant?.plant?.common_name : null;

  return (
    <tr className="hover:bg-forest-50/40 transition-colors group">
      <td className="px-4 py-2.5 pl-10">
        <div className="font-medium italic text-forest-900 text-sm">{plantName}</div>
        {commonName && <div className="text-xs text-forest-500">{commonName}</div>}
        <div className="text-xs text-forest-400">{plant.variant?.container_size}</div>
      </td>
      <td className="px-4 py-2.5 text-center text-sm font-semibold text-forest-800">
        {plant.quantity}
      </td>
      <td className="px-4 py-2.5 text-center">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[plant.status] || 'bg-forest-100 text-forest-500'}`}>
          {plant.status}
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm text-forest-500 hidden md:table-cell">
        {plant.install_date || <span className="text-forest-300">—</span>}
      </td>
      <td className="px-4 py-2.5 text-sm text-forest-500 hidden lg:table-cell truncate max-w-[180px]">
        {plant.location_note || <span className="text-forest-300">—</span>}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(plant)} className="btn-ghost px-2 py-1.5 text-forest-400 hover:text-forest-700" title="Edit">
            <Pencil size={13} />
          </button>
          <button onClick={() => onRemove(plant)} className="btn-ghost px-2 py-1.5 text-forest-400 hover:text-red-500" title="Remove">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---- ProjectCard ----
function ProjectCard({ project, onEdit, onDelete, onAddPlants }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editingPlant, setEditingPlant] = useState(null);
  const [removePlantTarget, setRemovePlantTarget] = useState(null);
  const [returnToInventory, setReturnToInventory] = useState(false);

  const { data: projectDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['landscaping-project', project.id],
    queryFn: () => landscaping.getProject(project.id).then(r => r.data.project),
    enabled: expanded,
    staleTime: 30_000,
  });

  const removePlantMutation = useMutation({
    mutationFn: ({ id, returnInv }) => landscaping.removePlant(id, { return_to_inventory: returnInv }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landscaping-project', project.id] });
      qc.invalidateQueries({ queryKey: ['landscaping-projects'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setRemovePlantTarget(null);
    },
  });

  const totalPlants = project.plants?.reduce((s, p) => s + (p.quantity || 0), 0) ?? 0;
  const plantCount  = project.plants?.length ?? 0;
  const plants      = projectDetail?.plants ?? [];

  return (
    <div className="card overflow-hidden mb-4">
      {/* Project header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-forest-50/60 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="text-forest-400">
          {expanded
            ? <ChevronDown size={16} />
            : <ChevronRight size={16} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-forest-900">{project.name}</span>
            {project.client_name && (
              <span className="text-sm text-forest-500">· {project.client_name}</span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] || 'bg-forest-100 text-forest-500'}`}>
              {project.status}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-0.5 flex-wrap">
            {project.location && (
              <span className="text-xs text-forest-500 flex items-center gap-1">
                <MapPin size={11} className="text-forest-400" />
                {project.location}
              </span>
            )}
            {(project.start_date || project.end_date) && (
              <span className="text-xs text-forest-500 flex items-center gap-1">
                <Calendar size={11} className="text-forest-400" />
                {project.start_date || '?'}{project.end_date ? ` → ${project.end_date}` : ''}
              </span>
            )}
            <span className="text-xs text-forest-400">
              {plantCount} {plantCount === 1 ? 'entry' : 'entries'} · {totalPlants} total plants
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onAddPlants(project)}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
            title="Add plants from inventory"
          >
            <ArrowDownToLine size={13} />
            Add Plants
          </button>
          <button onClick={() => onEdit(project)} className="btn-ghost px-2 py-1.5 text-forest-400 hover:text-forest-700" title="Edit project">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(project)} className="btn-ghost px-2 py-1.5 text-forest-400 hover:text-red-500" title="Delete project">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Plant list */}
      {expanded && (
        <div className="border-t border-forest-100">
          {detailLoading ? (
            <div className="px-4 py-6 text-center text-forest-400 text-sm animate-pulse">Loading plants…</div>
          ) : plants.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <TreePine size={28} className="mx-auto mb-2 text-forest-200" />
              <p className="text-forest-400 text-sm">No plants added yet</p>
              <button onClick={() => onAddPlants(project)} className="mt-3 btn-secondary text-xs flex items-center gap-1.5 mx-auto">
                <Plus size={13} /> Add Plants from Inventory
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-forest-50/60 border-b border-forest-100 text-left">
                  <th className="px-4 py-2 pl-10 font-medium text-forest-500">Plant</th>
                  <th className="px-4 py-2 font-medium text-forest-500 text-center">Qty</th>
                  <th className="px-4 py-2 font-medium text-forest-500 text-center">Status</th>
                  <th className="px-4 py-2 font-medium text-forest-500 hidden md:table-cell">Install Date</th>
                  <th className="px-4 py-2 font-medium text-forest-500 hidden lg:table-cell">Location / Spot</th>
                  <th className="px-4 py-2 font-medium text-forest-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-50">
                {plants.map(plant => (
                  <PlantRow
                    key={plant.id}
                    plant={plant}
                    onEdit={setEditingPlant}
                    onRemove={p => { setRemovePlantTarget(p); setReturnToInventory(false); }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Photo gallery */}
      {expanded && (
        <div className="border-t border-forest-100 px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Images size={15} className="text-forest-500" />
            <span className="text-sm font-medium text-forest-700">Photos</span>
          </div>
          <PhotoGallery projectId={project.id} enabled={expanded} />
        </div>
      )}

      {/* Edit plant modal */}
      {editingPlant && (
        <Modal title="Edit Plant Entry" onClose={() => setEditingPlant(null)} size="sm">
          <EditPlantModal
            plant={{ ...editingPlant, project_id: project.id }}
            onClose={() => setEditingPlant(null)}
          />
        </Modal>
      )}

      {/* Remove plant confirm */}
      {removePlantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRemovePlantTarget(null)} />
          <div className="relative z-10 bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-semibold text-forest-900">Remove Plant Entry</h2>
            <p className="text-sm text-forest-600">
              Remove <strong>{removePlantTarget.variant?.plant?.common_name || removePlantTarget.variant?.plant?.scientific_name}</strong> ({removePlantTarget.quantity} units) from this {project.type === 'in_ground' ? 'location' : 'project'}?
            </p>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={returnToInventory}
                onChange={e => setReturnToInventory(e.target.checked)}
                className="w-4 h-4 rounded border-forest-300"
              />
              <span className="text-forest-700">Return quantity to nursery inventory</span>
            </label>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRemovePlantTarget(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => removePlantMutation.mutate({ id: removePlantTarget.id, returnInv: returnToInventory })}
                disabled={removePlantMutation.isPending}
                className="btn-primary bg-red-600 hover:bg-red-700 border-red-600"
              >
                {removePlantMutation.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----
export default function AdminInGround() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('in_ground');
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addPlantsProject, setAddPlantsProject] = useState(null);
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['landscaping-projects', tab],
    queryFn: () => landscaping.listProjects({ type: tab }).then(r => r.data.projects),
    staleTime: 30_000,
  });
  const projects = data ?? [];

  const createMutation = useMutation({
    mutationFn: (data) => landscaping.createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landscaping-projects'] });
      setProjectFormOpen(false);
      setFormError('');
    },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => landscaping.updateProject(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landscaping-projects'] });
      setEditingProject(null);
      setFormError('');
    },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => landscaping.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landscaping-projects'] });
      setDeleteTarget(null);
    },
  });

  const handleSave = (form) => {
    if (!form.name?.trim()) return setFormError('Name is required');
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const startEdit = (project) => {
    setEditingProject(project);
    setFormError('');
  };

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900 flex items-center gap-2">
            <TreePine size={24} className="text-forest-600" />
            In Ground Assets
          </h1>
          <p className="text-forest-500 text-sm mt-0.5">
            Track plants installed in the ground — at nursery locations or on landscaping jobs.
          </p>
        </div>
        <button
          onClick={() => { setProjectFormOpen(true); setEditingProject(null); setFormError(''); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          {tab === 'in_ground' ? 'New In Ground Location' : 'New Landscaping Job'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-forest-200">
        {[
          { key: 'in_ground',      label: 'In Ground Locations' },
          { key: 'landscaping_job', label: 'Landscaping Jobs' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-forest-700 text-forest-900'
                : 'border-transparent text-forest-500 hover:text-forest-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="h-4 bg-forest-100 rounded animate-pulse w-1/3 mb-2" />
              <div className="h-3 bg-forest-50 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card py-20 text-center">
          <TreePine size={40} className="mx-auto mb-3 text-forest-200" />
          <p className="text-forest-500 font-medium">
            No {tab === 'in_ground' ? 'in ground locations' : 'landscaping jobs'} yet
          </p>
          <p className="text-forest-400 text-sm mt-1">
            {tab === 'in_ground'
              ? 'Create a location to start tracking plants installed in the ground.'
              : 'Create a landscaping job to track plants transferred to client projects.'}
          </p>
          <button
            onClick={() => setProjectFormOpen(true)}
            className="mt-4 btn-primary mx-auto flex items-center gap-2"
          >
            <Plus size={15} />
            {tab === 'in_ground' ? 'New In Ground Location' : 'New Landscaping Job'}
          </button>
        </div>
      ) : (
        projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={startEdit}
            onDelete={setDeleteTarget}
            onAddPlants={setAddPlantsProject}
          />
        ))
      )}

      {/* Create / Edit project modal */}
      {(projectFormOpen || editingProject) && (
        <Modal
          title={editingProject
            ? `Edit ${tab === 'in_ground' ? 'Location' : 'Job'}`
            : `New ${tab === 'in_ground' ? 'In Ground Location' : 'Landscaping Job'}`}
          onClose={() => { setProjectFormOpen(false); setEditingProject(null); setFormError(''); }}
          size="sm"
        >
          <ProjectFormModal
            initial={editingProject
              ? {
                  name: editingProject.name,
                  client_name: editingProject.client_name || '',
                  location: editingProject.location || '',
                  description: editingProject.description || '',
                  status: editingProject.status,
                  start_date: editingProject.start_date || '',
                  end_date: editingProject.end_date || '',
                  notes: editingProject.notes || '',
                }
              : undefined}
            type={tab}
            onSave={handleSave}
            onClose={() => { setProjectFormOpen(false); setEditingProject(null); setFormError(''); }}
            isPending={createMutation.isPending || updateMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {/* Add plants (inventory transfer) modal */}
      {addPlantsProject && (
        <Modal
          title="Add Plants from Inventory"
          onClose={() => setAddPlantsProject(null)}
          size="sm"
        >
          <AddPlantsModal
            project={addPlantsProject}
            onClose={() => setAddPlantsProject(null)}
          />
        </Modal>
      )}

      {/* Delete project confirm */}
      {deleteTarget && (
        <Confirm
          title={`Delete ${tab === 'in_ground' ? 'Location' : 'Landscaping Job'}`}
          message={`Remove "${deleteTarget.name}" and all its plant records? This cannot be undone. Inventory will NOT be returned automatically.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
