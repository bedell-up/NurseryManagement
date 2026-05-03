import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventory as inventoryApi, locations as locationsApi } from '../../api/client';
import { MapPinOff, MapPin, CheckCircle, Loader2, Plus, X } from 'lucide-react';

function Row({ item, locationNames, selected, onToggle, onSaved }) {
  const total = item.quantity_on_hand;
  const [splits,  setSplits]  = useState([{ id: 0, loc: '', qty: String(total) }]);
  const [nextId,  setNextId]  = useState(1);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState(false);

  const allocated = splits.reduce((sum, s) => sum + (parseInt(s.qty, 10) || 0), 0);
  const remaining = total - allocated;

  function addSplit() {
    setSplits(prev => [...prev, { id: nextId, loc: '', qty: String(Math.max(0, remaining)) }]);
    setNextId(k => k + 1);
  }

  function removeSplit(id) {
    setSplits(prev => prev.filter(s => s.id !== id));
    setError('');
  }

  function updateSplit(id, field, value) {
    setSplits(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    setError('');
  }

  const mutation = useMutation({
    mutationFn: () => {
      const valid = splits.filter(s => s.loc && parseInt(s.qty, 10) > 0);
      return Promise.all([
        inventoryApi.update(item.id, { location: valid[0].loc }),
        inventoryApi.setLocationSplits(item.id, valid.map(s => ({
          location: s.loc,
          quantity: parseInt(s.qty, 10),
        }))),
      ]);
    },
    onSuccess: () => { setSaved(true); onSaved(); },
    onError:   (e) => setError(e.response?.data?.error || 'Failed to save'),
  });

  function handleSave() {
    const valid = splits.filter(s => s.loc && parseInt(s.qty, 10) > 0);
    if (!valid.length)       return setError('Select at least one location');
    if (allocated !== total) return setError(`Quantities must total ${total}`);
    mutation.mutate();
  }

  if (saved) return null;

  return (
    <tr className={`hover:bg-forest-50/50 transition-colors align-top ${selected ? 'bg-forest-50' : ''}`}>
      <td className="px-3 pt-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-forest-300 text-forest-600 focus:ring-forest-500"
        />
      </td>
      <td className="px-4 py-3 font-medium text-forest-900">
        {item.variant?.plant?.common_name}
        {item.variant?.plant?.scientific_name && (
          <span className="block text-xs text-forest-400 italic">{item.variant.plant.scientific_name}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-forest-600">{item.variant?.container_size}</td>
      <td className="px-4 py-3 text-sm font-mono text-forest-500">{item.variant?.sku}</td>
      <td className="px-4 py-3 text-center font-semibold text-forest-800">{total}</td>
      <td className="px-4 py-3">
        <div className="space-y-1.5">
          {splits.map(split => (
            <div key={split.id} className="flex items-center gap-1.5">
              <select
                className="input flex-1 text-sm"
                value={split.loc}
                onChange={e => updateSplit(split.id, 'loc', e.target.value)}
              >
                <option value="">— location —</option>
                {locationNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input
                type="number"
                min="0"
                max={total}
                className="input w-16 text-sm text-center"
                value={split.qty}
                onChange={e => updateSplit(split.id, 'qty', e.target.value)}
              />
              {splits.length > 1 && (
                <button onClick={() => removeSplit(split.id)} className="shrink-0 text-forest-400 hover:text-red-500 transition-colors p-0.5">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}

          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={addSplit}
              disabled={remaining <= 0}
              className="text-xs text-forest-500 hover:text-forest-700 flex items-center gap-0.5 disabled:opacity-40 transition-colors"
            >
              <Plus size={11} /> Split location
            </button>
            {remaining !== 0 && (
              <span className={`text-xs font-mono ml-auto ${remaining > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                {remaining > 0 ? `${remaining} unassigned` : `${Math.abs(remaining)} over`}
              </span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={mutation.isPending || allocated !== total}
            className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1 w-full justify-center mt-1"
          >
            <MapPin size={13} />
            {mutation.isPending ? 'Saving…' : 'Set Location'}
          </button>

          {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
        </div>
      </td>
    </tr>
  );
}

export default function AdminNoLocation() {
  const qc = useQueryClient();
  const [selected,     setSelected]     = useState(new Set());
  const [bulkLoc,      setBulkLoc]      = useState('');
  const [bulkRunning,  setBulkRunning]  = useState(false);
  const [bulkDone,     setBulkDone]     = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory-no-location'],
    queryFn:  () => inventoryApi.withoutLocation().then(r => r.data),
    staleTime: 0,
  });

  const { data: locsData } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => locationsApi.list({ active: true }).then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const locationNames = (locsData ?? []).map(l => l.name);

  const items = data?.inventory ?? [];

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  }

  const allChecked  = items.length > 0 && selected.size === items.length;
  const someChecked = selected.size > 0 && selected.size < items.length;

  async function applyBulk() {
    if (!bulkLoc || selected.size === 0) return;
    const targets = items.filter(i => selected.has(i.id));
    setBulkRunning(true);
    setBulkDone(0);
    let done = 0;
    for (const item of targets) {
      await Promise.all([
        inventoryApi.update(item.id, { location: bulkLoc }),
        inventoryApi.setLocationSplits(item.id, [{ location: bulkLoc, quantity: item.quantity_on_hand }]),
      ]).catch(() => {});
      done++;
      setBulkDone(done);
    }
    setBulkRunning(false);
    setSelected(new Set());
    setBulkLoc('');
    refetch();
    qc.invalidateQueries({ queryKey: ['inventory-no-location'] });
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['inventory-no-location'] });
    refetch();
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-screen-lg mx-auto">
        <div className="h-6 w-48 bg-forest-100 rounded animate-pulse mb-4" />
        <div className="card p-8 text-center text-forest-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Inventory Without Location</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            {items.length === 0
              ? 'All inventory has a location assigned.'
              : `${items.length} item${items.length !== 1 ? 's' : ''} with quantity on hand but no location set.`}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={32} className="mx-auto mb-3 text-green-500" />
          <p className="font-medium text-forest-700">All inventory items have a location assigned.</p>
          <p className="text-sm text-forest-400 mt-1">New inventory will require a location when added.</p>
        </div>
      ) : (
        <>
          {/* Bulk action bar — visible when rows are selected */}
          {selected.size > 0 && (
            <div className="card p-3 mb-4 flex items-center gap-3 flex-wrap bg-forest-50 border-forest-200">
              <span className="text-sm font-medium text-forest-700">
                {selected.size} item{selected.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <select
                  className="input text-sm flex-1 min-w-36"
                  value={bulkLoc}
                  onChange={e => setBulkLoc(e.target.value)}
                  disabled={bulkRunning}
                >
                  <option value="">— assign to location —</option>
                  {locationNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button
                  onClick={applyBulk}
                  disabled={!bulkLoc || bulkRunning}
                  className="btn-primary text-sm flex items-center gap-1.5 shrink-0"
                >
                  {bulkRunning
                    ? <><Loader2 size={13} className="animate-spin" /> {bulkDone}/{selected.size}</>
                    : <><MapPin size={13} /> Assign Selected</>}
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  disabled={bulkRunning}
                  className="btn-secondary text-sm shrink-0"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-forest-50 border-b border-forest-100">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll}
                      className="rounded border-forest-300 text-forest-600 focus:ring-forest-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-forest-600">Plant</th>
                  <th className="px-4 py-3 text-left font-medium text-forest-600">Size</th>
                  <th className="px-4 py-3 text-left font-medium text-forest-600">SKU</th>
                  <th className="px-4 py-3 text-center font-medium text-forest-600">Qty</th>
                  <th className="px-4 py-3 text-left font-medium text-forest-600">Assign Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-50">
                {items.map(item => (
                  <Row
                    key={item.id}
                    item={item}
                    locationNames={locationNames}
                    selected={selected.has(item.id)}
                    onToggle={() => toggleRow(item.id)}
                    onSaved={handleSaved}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-forest-400 flex items-center gap-1.5">
        <MapPinOff size={12} />
        Qty defaults to full on-hand amount. Use "Split location" to divide across multiple locations — quantities must total the on-hand amount. Use checkboxes to bulk-assign selected items to one location.
      </p>
    </div>
  );
}
