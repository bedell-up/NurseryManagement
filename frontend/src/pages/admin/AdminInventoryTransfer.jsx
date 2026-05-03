import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inventory as inventoryApi, locations as locationsApi } from '../../api/client';
import { ArrowRight, Plus, Trash2, CheckCircle, XCircle, ArrowLeftRight, ChevronDown, X } from 'lucide-react';

function emptyLine(key) {
  return { key, variant_id: '', qty: '', toLoc: '' };
}

function ResultBadge({ r, sourceItems }) {
  const label = sourceItems.find(i => i.variant?.id === r.variant_id);
  const name = label
    ? `${label.variant?.plant?.scientific_name} — ${label.variant?.container_size}`
    : r.variant_id;
  return (
    <div className={`flex items-center gap-2 text-sm py-1 ${r.ok ? 'text-forest-700' : 'text-red-600'}`}>
      {r.ok
        ? <CheckCircle size={14} className="text-green-600 shrink-0" />
        : <XCircle    size={14} className="text-red-500  shrink-0" />}
      <span className="font-medium">{name}</span>
      {r.toLoc && <span className="text-forest-400 text-xs">→ {r.toLoc}</span>}
      {r.ok
        ? <span className="text-forest-500">— transferred {r.transferred}</span>
        : <span>— {r.error}</span>}
    </div>
  );
}

function PlantCombobox({ sourceItems, fromLoc, value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const [open,  setOpen]  = useState(false);
  const containerRef      = useRef(null);
  const inputRef          = useRef(null);

  const selected = sourceItems.find(i => i.variant?.id === value);

  const options = useMemo(() => {
    if (!query.trim()) return sourceItems;
    const q = query.toLowerCase();
    return sourceItems.filter(inv => {
      const sci    = (inv.variant?.plant?.scientific_name ?? '').toLowerCase();
      const common = (inv.variant?.plant?.common_name     ?? '').toLowerCase();
      const size   = (inv.variant?.container_size         ?? '').toLowerCase();
      return sci.includes(q) || common.includes(q) || size.includes(q);
    });
  }, [sourceItems, query]);

  function displayLabel(inv) {
    if (!inv) return '';
    const sci    = inv.variant?.plant?.scientific_name ?? '';
    const common = inv.variant?.plant?.common_name     ?? '';
    const size   = inv.variant?.container_size         ?? '';
    return common ? `${sci} (${common}) — ${size}` : `${sci} — ${size}`;
  }

  function selectOption(inv) {
    onChange(inv.variant?.id ?? '');
    setQuery('');
    setOpen(false);
  }

  function clear(e) {
    e.stopPropagation();
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  }

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleInputChange(e) {
    setQuery(e.target.value);
    if (!open) setOpen(true);
    if (value) onChange('');
  }

  const placeholder = disabled ? '— no stock at this location —' : '— type to search plants —';
  const inputValue  = open ? query : (selected ? displayLabel(selected) : '');

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`input flex items-center gap-1 pr-2 cursor-text ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
      >
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder-forest-400"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => { if (!disabled) setOpen(true); }}
          disabled={disabled}
          autoComplete="off"
        />
        {selected && !open
          ? <button type="button" onClick={clear} className="shrink-0 text-forest-400 hover:text-forest-700"><X size={13} /></button>
          : <ChevronDown size={13} className="shrink-0 text-forest-400" />}
      </div>

      {open && !disabled && (
        <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-forest-200 bg-white shadow-lg text-sm">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-forest-400 italic">No matches</li>
          ) : options.map(inv => {
            const sci    = inv.variant?.plant?.scientific_name ?? '';
            const common = inv.variant?.plant?.common_name     ?? '';
            const size   = inv.variant?.container_size         ?? '';
            const split  = inv.location_splits?.find(s => s.location.toLowerCase() === fromLoc.toLowerCase());
            const qty    = split?.quantity ?? 0;
            return (
              <li
                key={inv.variant?.id}
                onMouseDown={() => selectOption(inv)}
                className={`px-3 py-2 cursor-pointer hover:bg-forest-50 ${value === inv.variant?.id ? 'bg-forest-100' : ''}`}
              >
                <span className="font-medium italic text-forest-900">{sci}</span>
                {common && <span className="text-forest-500 ml-1">({common})</span>}
                <span className="text-forest-400 ml-1">— {size}</span>
                <span className="float-right text-forest-400 text-xs">{qty} avail.</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminInventoryTransfer() {
  const [fromLoc, setFromLoc] = useState('');
  const [lines,   setLines]   = useState([emptyLine(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: locsData } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => locationsApi.list({ active: true }).then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const locationNames = (locsData ?? []).map(l => l.name);

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

  // Total qty allocated per variant across all lines
  function allocatedForVariant(variant_id, excludeKey = null) {
    return lines
      .filter(l => l.variant_id === variant_id && l.key !== excludeKey && l.qty !== '')
      .reduce((sum, l) => sum + (parseInt(l.qty, 10) || 0), 0);
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

  async function handleSubmit() {
    const valid = lines.filter(l => l.variant_id && l.toLoc && l.qty !== '' && parseInt(l.qty, 10) > 0);
    if (!valid.length) return;
    setResults(null);
    setSubmitting(true);

    // Group by destination location
    const byDest = {};
    for (const l of valid) {
      if (!byDest[l.toLoc]) byDest[l.toLoc] = [];
      byDest[l.toLoc].push({ variant_id: l.variant_id, quantity: parseInt(l.qty, 10) });
    }

    const allResults = [];
    for (const [toLoc, items] of Object.entries(byDest)) {
      try {
        const res = await inventoryApi.transfer({ from_location: fromLoc, to_location: toLoc, items }).then(r => r.data);
        allResults.push(...res.results.map(r => ({ ...r, toLoc })));
      } catch (e) {
        allResults.push({ error: e.response?.data?.error || 'Transfer failed', toLoc });
      }
    }

    setResults(allResults);
    setSubmitting(false);
  }

  function reset() {
    setFromLoc('');
    setLines([emptyLine(0)]);
    setNextKey(1);
    setResults(null);
  }

  const validLines = lines.filter(l => l.variant_id && l.toLoc && l.qty !== '' && parseInt(l.qty, 10) > 0);
  const canSubmit  = fromLoc && validLines.length > 0 && !submitting;

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Transfer Inventory</h1>
          <p className="text-forest-500 text-sm mt-0.5">Move plants between locations. Each line can go to a different destination.</p>
        </div>
      </div>

      {/* From location */}
      <div className="card p-5 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-64">
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
          {fromLoc && (
            <div className="flex items-center gap-2 mt-5 text-xs text-forest-400">
              <ArrowRight size={14} />
              <span>To location is set per line below</span>
            </div>
          )}
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
                <th className="px-4 py-2 text-center font-medium text-forest-600 w-20">Avail.</th>
                <th className="px-4 py-2 text-center font-medium text-forest-600 w-24">Qty</th>
                <th className="px-4 py-2 text-left font-medium text-forest-600 w-44">To Location</th>
                <th className="px-4 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {lines.map(line => {
                const available  = qtyAtSource(line.variant_id);
                const alreadyUsed = line.variant_id ? allocatedForVariant(line.variant_id, line.key) : 0;
                const maxForLine  = Math.max(0, available - alreadyUsed);
                const qty         = parseInt(line.qty, 10) || 0;
                const overLimit   = line.qty !== '' && qty > maxForLine;
                const toOptions   = locationNames.filter(n => n !== fromLoc);

                return (
                  <tr key={line.key}>
                    <td className="px-4 py-2.5">
                      <PlantCombobox
                        sourceItems={sourceItems}
                        fromLoc={fromLoc}
                        value={line.variant_id}
                        onChange={v => setLine(line.key, 'variant_id', v)}
                        disabled={sourceItems.length === 0}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {line.variant_id
                        ? <span className={`font-semibold ${maxForLine === 0 ? 'text-red-500' : 'text-forest-800'}`}>
                            {maxForLine}
                            {alreadyUsed > 0 && <span className="block text-xs text-forest-400 font-normal">of {available}</span>}
                          </span>
                        : <span className="text-forest-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="1"
                        max={maxForLine || undefined}
                        className={`input w-full text-center text-sm ${overLimit ? 'border-red-400 bg-red-50' : ''}`}
                        placeholder="0"
                        value={line.qty}
                        onChange={e => setLine(line.key, 'qty', e.target.value)}
                        disabled={!line.variant_id}
                      />
                      {overLimit && <p className="text-red-500 text-xs mt-0.5 text-center">Max {maxForLine}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        className="input w-full text-sm"
                        value={line.toLoc}
                        onChange={e => setLine(line.key, 'toLoc', e.target.value)}
                        disabled={!line.variant_id}
                      >
                        <option value="">— destination —</option>
                        {toOptions.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
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
              <Plus size={14} /> Add Line
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
            {submitting ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      )}
    </div>
  );
}
