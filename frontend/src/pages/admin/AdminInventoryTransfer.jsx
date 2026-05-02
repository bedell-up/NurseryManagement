import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inventory as inventoryApi, locations as locationsApi } from '../../api/client';
import { ArrowRight, Plus, Trash2, CheckCircle, XCircle, ArrowLeftRight } from 'lucide-react';

function emptyLine(key) {
  return { key, variant_id: '', qty: '' };
}

function ResultBadge({ r, sourceItems }) {
  const label = sourceItems.find(i => i.variant?.id === r.variant_id);
  const name = label
    ? `${label.variant?.plant?.common_name} — ${label.variant?.container_size}`
    : r.variant_id;
  return (
    <div className={`flex items-center gap-2 text-sm py-1 ${r.ok ? 'text-forest-700' : 'text-red-600'}`}>
      {r.ok
        ? <CheckCircle size={14} className="text-green-600 shrink-0" />
        : <XCircle    size={14} className="text-red-500  shrink-0" />}
      <span className="font-medium">{name}</span>
      {r.ok
        ? <span className="text-forest-500">— transferred {r.transferred}</span>
        : <span>— {r.error}</span>}
    </div>
  );
}

export default function AdminInventoryTransfer() {
  const [fromLoc, setFromLoc]   = useState('');
  const [toLoc,   setToLoc]     = useState('');
  const [lines,   setLines]     = useState([emptyLine(0)]);
  const [nextKey, setNextKey]   = useState(1);
  const [results, setResults]   = useState(null);

  // All active locations
  const { data: locsData } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => locationsApi.list({ active: true }).then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const locationNames = (locsData ?? []).map(l => l.name);

  // Inventory at the selected from-location
  const { data: sourceData, isFetching: loadingSource } = useQuery({
    queryKey: ['inventory', 'by-location', fromLoc],
    queryFn:  () => inventoryApi.byLocation(fromLoc).then(r => r.data),
    enabled:  !!fromLoc,
    staleTime: 30_000,
  });

  const sourceItems = useMemo(() => {
    if (!sourceData?.inventory) return [];
    return sourceData.inventory.filter(inv => {
      const split = inv.location_splits?.find(
        s => s.location.toLowerCase() === fromLoc.toLowerCase()
      );
      return (split?.quantity ?? 0) > 0;
    });
  }, [sourceData, fromLoc]);

  function qtyAtSource(variant_id) {
    const inv = sourceItems.find(i => i.variant?.id === variant_id);
    if (!inv) return 0;
    const split = inv.location_splits?.find(
      s => s.location.toLowerCase() === fromLoc.toLowerCase()
    );
    return split?.quantity ?? 0;
  }

  function addLine() {
    setLines(prev => [...prev, emptyLine(nextKey)]);
    setNextKey(k => k + 1);
  }

  function removeLine(key) {
    setLines(prev => prev.filter(l => l.key !== key));
  }

  function setLine(key, field, value) {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  }

  const transferMutation = useMutation({
    mutationFn: (data) => inventoryApi.transfer(data).then(r => r.data),
    onSuccess: (data) => setResults(data.results),
    onError:   (e)    => setResults([{ error: e.response?.data?.error || 'Transfer failed' }]),
  });

  function handleSubmit() {
    const items = lines
      .filter(l => l.variant_id && l.qty !== '')
      .map(l => ({ variant_id: l.variant_id, quantity: parseInt(l.qty, 10) }));
    if (!items.length) return;
    setResults(null);
    transferMutation.mutate({ from_location: fromLoc, to_location: toLoc, items });
  }

  function reset() {
    setFromLoc('');
    setToLoc('');
    setLines([emptyLine(0)]);
    setNextKey(1);
    setResults(null);
  }

  const canSubmit =
    fromLoc &&
    toLoc &&
    fromLoc !== toLoc &&
    lines.some(l => l.variant_id && l.qty !== '' && parseInt(l.qty, 10) > 0) &&
    !transferMutation.isPending;

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Transfer Inventory</h1>
          <p className="text-forest-500 text-sm mt-0.5">Move plants between locations without changing total quantities.</p>
        </div>
      </div>

      {/* From / To row */}
      <div className="card p-5 mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-semibold text-forest-600 uppercase tracking-wide mb-1.5">From Location</label>
            <select
              className="input w-full"
              value={fromLoc}
              onChange={e => { setFromLoc(e.target.value); setLines([emptyLine(0)]); setNextKey(1); setResults(null); }}
            >
              <option value="">— select —</option>
              {locationNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <ArrowRight size={20} className="text-forest-400 mt-5 shrink-0" />

          <div className="flex-1 min-w-40">
            <label className="block text-xs font-semibold text-forest-600 uppercase tracking-wide mb-1.5">To Location</label>
            <select
              className="input w-full"
              value={toLoc}
              onChange={e => { setToLoc(e.target.value); setResults(null); }}
            >
              <option value="">— select —</option>
              {locationNames.filter(n => n !== fromLoc).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Line items */}
      {fromLoc && (
        <div className="card overflow-hidden mb-5">
          <div className="bg-forest-50 border-b border-forest-100 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-forest-600 uppercase tracking-wide">Items to Transfer</span>
            {loadingSource && <span className="text-xs text-forest-400 italic">Loading inventory…</span>}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50/50 border-b border-forest-100">
                <th className="px-4 py-2 text-left font-medium text-forest-600">Plant / Variant</th>
                <th className="px-4 py-2 text-center font-medium text-forest-600 w-28">At Location</th>
                <th className="px-4 py-2 text-center font-medium text-forest-600 w-28">Transfer Qty</th>
                <th className="px-4 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {lines.map(line => {
                const available = qtyAtSource(line.variant_id);
                const overLimit = line.qty !== '' && parseInt(line.qty, 10) > available;
                return (
                  <tr key={line.key}>
                    <td className="px-4 py-2.5">
                      <select
                        className="input w-full text-sm"
                        value={line.variant_id}
                        onChange={e => setLine(line.key, 'variant_id', e.target.value)}
                        disabled={sourceItems.length === 0}
                      >
                        <option value="">{sourceItems.length === 0 ? '— no stock at this location —' : '— select plant —'}</option>
                        {sourceItems.map(inv => {
                          const split = inv.location_splits?.find(s => s.location.toLowerCase() === fromLoc.toLowerCase());
                          const qty = split?.quantity ?? 0;
                          return (
                            <option key={inv.variant?.id} value={inv.variant?.id}>
                              {inv.variant?.plant?.common_name} — {inv.variant?.container_size} ({qty} available)
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {line.variant_id
                        ? <span className={`font-semibold ${available === 0 ? 'text-red-500' : 'text-forest-800'}`}>{available}</span>
                        : <span className="text-forest-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="1"
                        max={available || undefined}
                        className={`input w-full text-center text-sm ${overLimit ? 'border-red-400 bg-red-50' : ''}`}
                        placeholder="0"
                        value={line.qty}
                        onChange={e => setLine(line.key, 'qty', e.target.value)}
                        disabled={!line.variant_id}
                      />
                      {overLimit && <p className="text-red-500 text-xs mt-0.5 text-center">Max {available}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(line.key)} className="btn-ghost p-1.5 text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t border-forest-100">
            <button onClick={addLine} className="btn-secondary text-sm flex items-center gap-1.5">
              <Plus size={14} /> Add Item
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="card p-4 mb-5">
          <p className="text-xs font-semibold text-forest-600 uppercase tracking-wide mb-2">Transfer Results</p>
          {results.map((r, i) => (
            <ResultBadge key={i} r={r} sourceItems={sourceItems} />
          ))}
          {results.every(r => r.ok) && (
            <button onClick={reset} className="btn-secondary text-sm mt-3 flex items-center gap-1.5">
              <ArrowLeftRight size={14} /> New Transfer
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!results && (
        <div className="flex justify-end gap-3">
          <button onClick={reset} className="btn-secondary text-sm">Clear</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <ArrowLeftRight size={15} />
            {transferMutation.isPending ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      )}
    </div>
  );
}
