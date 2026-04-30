import { useState, useRef, useMemo, useCallback, memo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { inventory, locations as locationsApi, plants as plantsApi } from '../../api/client';
import { Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

const SKU_DATALIST_ID = 'sku-options';
const LS_LOCATION_KEY = 'inv_count_location';
const LS_STATUS_KEY   = 'inv_count_status';

const EMPTY_ROW = () => ({ sku: '', quantity: '' });

const STATUS_OPTIONS = [
  { value: 'retail_ready',   label: 'Retail Ready' },
  { value: 'just_potted',    label: 'Just Potted' },
  { value: 'available_soon', label: 'Available Soon' },
  { value: 'on_hold',        label: 'On Hold' },
  { value: 'damaged',        label: 'Damaged / Loss' },
];

// Isolated from focusedRow state so iOS doesn't re-render the selects while the native picker is open
const SessionControls = memo(function SessionControls({ status, setStatus, location, setLocation, locationOptions }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="label">Plant Status</label>
        <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-xs text-forest-400 mt-1">Applied to all entries in this count session.</p>
      </div>
      <div>
        <label className="label">Location <span className="text-forest-400 font-normal">(optional)</span></label>
        <select className="select" value={location} onChange={e => setLocation(e.target.value)}>
          <option value="">— all / unspecified —</option>
          {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
        </select>
        {location && <p className="text-xs text-forest-400 mt-1">All items assigned to <span className="font-medium text-forest-600">{location}</span>.</p>}
      </div>
    </div>
  );
});

export default function AdminInventoryCount() {
  const [rows, setRows] = useState([EMPTY_ROW()]);
  const [results, setResults] = useState(null);
  // Persist location and status in localStorage so they survive navigation and iOS page reloads
  const [location, setLocationState] = useState(() => localStorage.getItem(LS_LOCATION_KEY) ?? '');
  const [status,   setStatusState]   = useState(() => localStorage.getItem(LS_STATUS_KEY)   ?? 'retail_ready');
  const [focusedRow, setFocusedRow] = useState(null);
  const lastRowRef = useRef(null);

  const setLocation = useCallback((val) => {
    setLocationState(val);
    localStorage.setItem(LS_LOCATION_KEY, val);
  }, []);

  const setStatus = useCallback((val) => {
    setStatusState(val);
    localStorage.setItem(LS_STATUS_KEY, val);
  }, []);

  const { data: locationsData = [] } = useQuery({
    queryKey: ['locations-all'],
    queryFn: () => locationsApi.list().then(r => r.data),
  });
  const locationOptions = (locationsData?.locations ?? locationsData).filter(l => l.is_active !== false);

  const { data: skuOptions = [] } = useQuery({
    queryKey: ['plants-with-skus'],
    queryFn: () => plantsApi.list({ limit: 1000 }).then(r =>
      (r.data.plants ?? [])
        .flatMap(plant =>
          (plant.variants ?? [])
            .filter(v => v.sku && v.is_active !== false)
            .map(v => ({
              sku: v.sku,
              label: [plant.common_name, v.container_size].filter(Boolean).join(' — '),
            }))
        )
        .sort((a, b) => a.sku.localeCompare(b.sku))
    ),
  });

  // Only inject matching options into the datalist so mobile browsers don't
  // try to render a native picker with thousands of entries (causes tab crash).
  const visibleSkuOptions = useMemo(() => {
    if (focusedRow === null || skuOptions.length === 0) return [];
    const term = (rows[focusedRow]?.sku ?? '').trim().toLowerCase();
    if (!term) return skuOptions.slice(0, 30);
    return skuOptions
      .filter(o => o.sku.toLowerCase().includes(term) || o.label.toLowerCase().includes(term))
      .slice(0, 30);
  }, [focusedRow, rows, skuOptions]);

  const mutation = useMutation({
    mutationFn: (data) => inventory.bulkCount(data),
    onSuccess: (res) => setResults(res.data.results),
    onError: (e) => setResults([{ sku: '—', error: e.response?.data?.error || 'Submission failed' }]),
  });

  const updateRow = (i, field, value) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, EMPTY_ROW()]);
    // Focus the new SKU field after render
    setTimeout(() => lastRowRef.current?.focus(), 50);
  };

  const removeRow = (i) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleKeyDown = (e, i, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'sku') {
        // Move to quantity field in same row
        document.getElementById(`qty-${i}`)?.focus();
      } else {
        // Move to next row's SKU, or add a new row
        const nextSku = document.getElementById(`sku-${i + 1}`);
        if (nextSku) {
          nextSku.focus();
        } else {
          addRow();
        }
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setResults(null);
    const payload = rows
      .filter(r => r.sku.trim())
      .map(r => ({ sku: r.sku.trim(), quantity: parseInt(r.quantity, 10), inventory_status: status, ...(location ? { location } : {}) }));
    if (payload.length === 0) return;
    mutation.mutate(payload);
  };

  const handleReset = () => {
    setRows([EMPTY_ROW()]);
    setResults(null);
    // Intentionally keep location and status — user is typically continuing at the same spot
  };

  const validRows = rows.filter(r => r.sku.trim() && r.quantity !== '');

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-forest-900">Inventory Count</h1>
        <p className="text-forest-500 text-sm mt-0.5">
          Enter SKU codes and counts. Quantities are set as absolute values.
        </p>
      </div>

      {results ? (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h2 className="font-medium text-forest-800">Results</h2>
            <div className="flex items-center gap-3 text-xs text-forest-500">
              <span>Status: <span className="font-medium text-forest-700">{STATUS_OPTIONS.find(o => o.value === status)?.label}</span></span>
              {location && <span>Location: <span className="font-medium text-forest-700">{location}</span></span>}
            </div>
          </div>
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 text-sm rounded-lg px-4 py-3 ${
                r.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'
              }`}
            >
              {r.error
                ? <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                : <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />}
              <div>
                <span className="font-mono font-medium">{r.sku}</span>
                {r.error
                  ? <span className="ml-2">{r.error}</span>
                  : <span className="ml-2">
                      {r.before} → <strong>{r.after}</strong>
                      <span className="ml-1 opacity-70">
                        ({r.change >= 0 ? '+' : ''}{r.change})
                      </span>
                    </span>}
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <button onClick={handleReset} className="btn-primary">
              New Count
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <SessionControls
            status={status}
            setStatus={setStatus}
            location={location}
            setLocation={setLocation}
            locationOptions={locationOptions}
          />

          <datalist id={SKU_DATALIST_ID}>
            {visibleSkuOptions.map(opt => (
              <option key={opt.sku} value={opt.sku}>{opt.label ? `${opt.label} (${opt.sku})` : opt.sku}</option>
            ))}
          </datalist>

          <div className="grid grid-cols-[1fr_120px_36px] gap-2 text-xs font-medium text-forest-500 px-1">
            <span>SKU Code</span>
            <span>Quantity</span>
            <span />
          </div>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
                <input
                  id={`sku-${i}`}
                  ref={i === rows.length - 1 ? lastRowRef : null}
                  className="input font-mono text-sm"
                  placeholder="e.g. ANBU-1G"
                  list={SKU_DATALIST_ID}
                  value={row.sku}
                  onChange={e => updateRow(i, 'sku', e.target.value)}
                  onKeyDown={e => handleKeyDown(e, i, 'sku')}
                  onFocus={() => setFocusedRow(i)}
                  onBlur={() => setFocusedRow(null)}
                  autoComplete="off"
                />
                <input
                  id={`qty-${i}`}
                  className="input text-sm text-center"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={row.quantity}
                  onChange={e => updateRow(i, 'quantity', e.target.value)}
                  onKeyDown={e => handleKeyDown(e, i, 'quantity')}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-forest-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-forest-500 hover:text-forest-700 transition-colors"
          >
            <Plus size={15} />
            Add row
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-forest-100">
            <span className="text-xs text-forest-400">
              {validRows.length} {validRows.length === 1 ? 'item' : 'items'} ready to submit
            </span>
            <button
              type="submit"
              disabled={validRows.length === 0 || mutation.isPending}
              className="btn-primary"
            >
              {mutation.isPending ? 'Submitting…' : 'Submit Count'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
