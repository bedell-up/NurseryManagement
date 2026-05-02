import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventory as inventoryApi, locations as locationsApi } from '../../api/client';
import { MapPinOff, MapPin, CheckCircle } from 'lucide-react';

function Row({ item, locationNames, onSaved }) {
  const [loc, setLoc]       = useState('');
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      Promise.all([
        inventoryApi.update(item.id, { location: loc }),
        inventoryApi.setLocationSplits(item.id, [{ location: loc, quantity: item.quantity_on_hand }]),
      ]),
    onSuccess: () => { setSaved(true); onSaved(); },
    onError:   (e) => setError(e.response?.data?.error || 'Failed to save'),
  });

  if (saved) return null;

  return (
    <tr className="hover:bg-forest-50/50 transition-colors">
      <td className="px-4 py-3 font-medium text-forest-900">
        {item.variant?.plant?.common_name}
        {item.variant?.plant?.scientific_name && (
          <span className="block text-xs text-forest-400 italic">{item.variant.plant.scientific_name}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-forest-600">{item.variant?.container_size}</td>
      <td className="px-4 py-3 text-sm font-mono text-forest-500">{item.variant?.sku}</td>
      <td className="px-4 py-3 text-center font-semibold text-forest-800">{item.quantity_on_hand}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <select
            className="input flex-1 text-sm"
            value={loc}
            onChange={e => { setLoc(e.target.value); setError(''); }}
          >
            <option value="">— assign location —</option>
            {locationNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button
            onClick={() => { if (loc) mutation.mutate(); else setError('Select a location'); }}
            disabled={mutation.isPending || !loc}
            className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1 shrink-0"
          >
            <MapPin size={13} />
            {mutation.isPending ? 'Saving…' : 'Set'}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </td>
    </tr>
  );
}

export default function AdminNoLocation() {
  const qc = useQueryClient();
  const [bulkLoc,   setBulkLoc]   = useState('');
  const [bulkDone,  setBulkDone]  = useState(0);
  const [bulkRunning, setBulkRunning] = useState(false);

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

  async function applyBulk() {
    if (!bulkLoc || items.length === 0) return;
    setBulkRunning(true);
    setBulkDone(0);
    let done = 0;
    for (const item of items) {
      await Promise.all([
        inventoryApi.update(item.id, { location: bulkLoc }),
        inventoryApi.setLocationSplits(item.id, [{ location: bulkLoc, quantity: item.quantity_on_hand }]),
      ]).catch(() => {});
      done++;
      setBulkDone(done);
    }
    setBulkRunning(false);
    refetch();
    qc.invalidateQueries({ queryKey: ['inventory-no-location'] });
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

        {items.length > 1 && (
          <div className="flex items-center gap-2">
            <select
              className="input text-sm"
              value={bulkLoc}
              onChange={e => setBulkLoc(e.target.value)}
              disabled={bulkRunning}
            >
              <option value="">Set all to…</option>
              {locationNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button
              onClick={applyBulk}
              disabled={!bulkLoc || bulkRunning}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              {bulkRunning ? `Applying… (${bulkDone}/${items.length})` : 'Apply to All'}
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={32} className="mx-auto mb-3 text-green-500" />
          <p className="font-medium text-forest-700">All inventory items have a location assigned.</p>
          <p className="text-sm text-forest-400 mt-1">New inventory will require a location when added.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50 border-b border-forest-100">
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
                  onSaved={() => {
                    qc.invalidateQueries({ queryKey: ['inventory-no-location'] });
                    refetch();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-forest-400 flex items-center gap-1.5">
        <MapPinOff size={12} />
        Setting a location here assigns all on-hand quantity to that location and creates a location split.
      </p>
    </div>
  );
}
