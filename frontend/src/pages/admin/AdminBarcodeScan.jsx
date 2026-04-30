import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { inventory, scan as scanApi } from '../../api/client';
import {
  ArrowLeft, CheckCircle, AlertCircle, Loader2,
  CameraOff, ScanBarcode, History, ChevronRight,
} from 'lucide-react';

// ── Scan session stats (per-calendar-day in localStorage) ──────────────────
function todayKey() { return `bd_scans_${new Date().toDateString()}`; }
function getTodayCount() { return parseInt(localStorage.getItem(todayKey()) || '0', 10); }
function bumpCount() {
  const n = getTodayCount() + 1;
  localStorage.setItem(todayKey(), String(n));
  localStorage.setItem('bd_last_scan', new Date().toISOString());
  return n;
}
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ── Corner bracket decoration for the viewfinder ───────────────────────────
function Brackets() {
  const arm = 'absolute w-5 h-5 border-forest-400';
  return (
    <>
      <span className={`${arm} top-3 left-3 border-t-2 border-l-2 rounded-tl`} />
      <span className={`${arm} top-3 right-3 border-t-2 border-r-2 rounded-tr`} />
      <span className={`${arm} bottom-3 left-3 border-b-2 border-l-2 rounded-bl`} />
      <span className={`${arm} bottom-3 right-3 border-b-2 border-r-2 rounded-br`} />
    </>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function AdminBarcodeScan() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // phase: 'scanning' | 'found' | 'confirmed'
  const [phase, setPhase] = useState('scanning');
  const [manualInput, setManualInput] = useState('');
  const [result, setResult] = useState(null);       // API scan result
  const [adjQty, setAdjQty] = useState(0);          // adjusted quantity shown in found screen
  const [scanErr, setScanErr] = useState(null);      // transient "not found" banner
  const [updateErr, setUpdateErr] = useState(null);  // update failure
  const [camErr, setCamErr] = useState(null);        // camera init failure
  const [camReady, setCamReady] = useState(false);
  const [count, setCount] = useState(getTodayCount);
  const [lastScan, setLastScan] = useState(() => localStorage.getItem('bd_last_scan'));
  const [confirmed, setConfirmed] = useState(null);  // confirmation summary object

  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const seenRef = useRef(new Set()); // debounce repeated scan frames

  // ── Scan lookup ────────────────────────────────────────────────────────
  const lookup = useMutation({
    mutationFn: async (code) => {
      const clean = code.trim().toUpperCase();
      // BD + 8 unambiguous chars → internal barcode; otherwise treat as SKU
      if (/^BD[A-Z0-9]{8}$/.test(clean)) {
        return scanApi.byBarcode(clean).then(r => r.data);
      }
      return scanApi.bySku(code.trim()).then(r => r.data);
    },
    onSuccess: (data) => {
      setResult(data);
      setAdjQty(data.inventory?.quantity_on_hand ?? 0);
      setScanErr(null);
      setPhase('found');
      const n = bumpCount();
      setCount(n);
      setLastScan(new Date().toISOString());
    },
    onError: (e) => {
      const msg = e.response?.data?.error || 'Item not found';
      setScanErr(msg);
      setTimeout(() => {
        setScanErr(null);
        seenRef.current.clear();
      }, 2500);
    },
  });

  // ── Inventory adjustment ───────────────────────────────────────────────
  const adjust = useMutation({
    mutationFn: (vars) => inventory.adjust(vars),
    onSuccess: (res) => {
      setConfirmed({
        item:   result?.plant?.common_name,
        sku:    result?.variant?.sku,
        before: res.data.quantity_before,
        after:  res.data.quantity_after,
        by:     user?.name || user?.email || 'Staff',
        at:     new Date(),
      });
      setPhase('confirmed');
    },
    onError: (e) => setUpdateErr(e.response?.data?.error || 'Update failed'),
  });

  // Keep a stable ref to mutate so the ZXing callback isn't stale
  const mutateRef = useRef(null);
  mutateRef.current = lookup.mutate;

  // ── Camera lifecycle (only active while on scanning phase) ────────────
  useEffect(() => {
    if (phase !== 'scanning') return;

    // Camera requires a secure context (HTTPS or localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamErr('Camera requires HTTPS — use manual entry below');
      return;
    }

    let alive = true;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (!alive || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (res) => {
            if (!alive || !res) return;
            const code = res.getText();
            if (!code || seenRef.current.has(code)) return;
            seenRef.current.add(code);
            mutateRef.current?.(code);
          }
        );
        controlsRef.current = controls;
        if (alive) setCamReady(true);
      } catch (e) {
        if (!alive) return;
        if (e.name === 'NotAllowedError') {
          setCamErr('Camera permission denied — use manual entry below');
        } else if (e.name === 'NotFoundError') {
          setCamErr('No camera found — use manual entry below');
        } else {
          setCamErr('Camera unavailable — use manual entry below');
        }
      }
    })();

    return () => {
      alive = false;
      controlsRef.current?.stop?.();
      controlsRef.current = null;
      setCamReady(false);
    };
  }, [phase]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const isPendingRef = useRef(false);
  isPendingRef.current = lookup.isPending;

  const handleManual = (e) => {
    e.preventDefault();
    const code = manualInput.trim();
    if (!code || isPendingRef.current) return;
    seenRef.current.add(code);
    lookup.mutate(code);
    setManualInput('');
  };

  const handleUpdate = () => {
    const currentQty = result?.inventory?.quantity_on_hand ?? 0;
    const change = adjQty - currentQty;
    setUpdateErr(null);
    if (change === 0) {
      setConfirmed({
        item:   result?.plant?.common_name,
        sku:    result?.variant?.sku,
        before: currentQty,
        after:  currentQty,
        by:     user?.name || user?.email || 'Staff',
        at:     new Date(),
      });
      setPhase('confirmed');
      return;
    }
    adjust.mutate({
      variant_id:      result?.variant?.id,
      quantity_change: change,
      change_type:     'adjustment',
      notes:           `Scan by ${user?.name || user?.email || 'staff'}`,
    });
  };

  const reset = () => {
    setResult(null);
    setAdjQty(0);
    setConfirmed(null);
    setUpdateErr(null);
    setScanErr(null);
    seenRef.current.clear();
    setPhase('scanning');
  };

  // ── Derived display values ────────────────────────────────────────────
  const currentQty  = result?.inventory?.quantity_on_hand ?? 0;
  const invLocation = result?.inventory?.location_splits?.[0]?.location
    || result?.inventory?.location
    || '—';
  const inStock = currentQty > 0;
  const changeDelta = adjQty - currentQty;
  const displayChange = changeDelta >= 0 ? `+${changeDelta}` : String(changeDelta);

  // ════════════════════════════════════════════════════════════════════════
  // SCREEN: Scanning
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'scanning') {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col max-w-sm mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-forest-500 text-xs font-mono uppercase tracking-widest">
              Bloomsday Natives
            </p>
            <p className="text-white text-sm font-semibold">
              {user?.name || user?.email || 'Staff'}
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/inventory')}
            className="bg-forest-800 border border-forest-700 rounded-lg px-3 py-1.5 text-forest-400 text-xs font-mono hover:text-white transition-colors"
          >
            EXIT
          </button>
        </div>

        {/* Camera viewfinder */}
        <div className="mx-4 rounded-2xl overflow-hidden border border-forest-800 bg-forest-950">
          <div className="relative h-52 bg-forest-950 flex items-center justify-center">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Corner brackets overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <Brackets />
            </div>
            {/* States overlaid on the viewfinder */}
            {!camReady && !camErr && (
              <div className="absolute inset-0 flex items-center justify-center bg-forest-950/80">
                <Loader2 size={20} className="text-forest-500 animate-spin" />
              </div>
            )}
            {camErr && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-forest-950/90">
                <CameraOff size={22} className="text-forest-600" />
                <p className="text-forest-500 text-xs font-mono text-center px-4">{camErr}</p>
              </div>
            )}
            {lookup.isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-forest-950/80">
                <Loader2 size={20} className="text-forest-400 animate-spin" />
                <p className="text-forest-400 text-xs font-mono">Looking up…</p>
              </div>
            )}
            {scanErr && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/80">
                <AlertCircle size={18} className="text-red-400" />
                <p className="text-red-300 text-xs font-mono text-center px-4">{scanErr}</p>
              </div>
            )}
          </div>
          {/* Viewfinder footer */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-forest-800">
            <ScanBarcode size={13} className="text-forest-500" />
            <span className="text-forest-500 text-xs font-mono uppercase tracking-wider">
              {camErr ? 'CAMERA UNAVAILABLE' : camReady ? 'CAMERA ACTIVE' : 'STARTING…'}
            </span>
            {!camErr && (
              <span
                className={`ml-auto w-2 h-2 rounded-full ${camReady ? 'bg-green-500' : 'bg-forest-700'}`}
              />
            )}
          </div>
        </div>

        {/* Manual entry */}
        <div className="mx-4 mt-4">
          <p className="text-forest-600 text-xs font-mono uppercase tracking-wider mb-2">
            Or enter manually
          </p>
          <form onSubmit={handleManual} className="flex gap-2">
            <input
              className="flex-1 bg-forest-900 border border-forest-700 rounded-xl px-4 py-3 text-forest-300 text-sm font-mono placeholder-forest-700 focus:outline-none focus:border-forest-500 transition-colors"
              placeholder="Item ID or barcode…"
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={!manualInput.trim() || lookup.isPending}
              className="bg-forest-600 hover:bg-forest-500 disabled:opacity-40 rounded-xl px-4 flex items-center justify-center transition-colors"
            >
              <ChevronRight size={18} className="text-white" />
            </button>
          </form>
        </div>

        {/* Stats */}
        <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
          <div className="bg-forest-900 border border-forest-800 rounded-xl p-3">
            <p className="text-forest-600 text-xs font-mono uppercase mb-1">Today's scans</p>
            <p className="text-white text-2xl font-bold font-mono">{count}</p>
          </div>
          <div className="bg-forest-900 border border-forest-800 rounded-xl p-3">
            <p className="text-forest-600 text-xs font-mono uppercase mb-1">Last scan</p>
            <p className="text-white text-sm font-bold font-mono">{fmtTime(lastScan)}</p>
          </div>
        </div>

        <div className="flex-1" />
        <p className="text-forest-800 text-xs font-mono text-center pb-6">
          native.pscapps.com
        </p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // SCREEN: Item Found
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'found') {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col max-w-sm mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-3">
          <button
            onClick={reset}
            className="bg-forest-900 border border-forest-800 rounded-lg p-1.5 hover:bg-forest-800 transition-colors"
          >
            <ArrowLeft size={14} className="text-forest-400" />
          </button>
          <div>
            <p className="text-forest-500 text-xs font-mono uppercase tracking-wider">
              Item found
            </p>
            <p className="text-white text-sm font-semibold">Update inventory</p>
          </div>
        </div>

        {/* Item card */}
        <div className="mx-4 bg-forest-900 border border-forest-800 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-white text-base font-semibold truncate">
                {result?.plant?.common_name || 'Unknown Plant'}
              </p>
              <p className="text-forest-500 text-xs font-mono mt-0.5">
                SKU: {result?.variant?.sku || '—'}
              </p>
            </div>
            <span
              className={`flex-shrink-0 border rounded-lg px-2 py-1 text-xs font-mono ${
                inStock
                  ? 'bg-forest-950 border-forest-600 text-forest-400'
                  : 'bg-red-950 border-red-800 text-red-400'
              }`}
            >
              {inStock ? 'IN STOCK' : 'OUT OF STOCK'}
            </span>
          </div>
          <div className="border-t border-forest-800 pt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-forest-600 text-xs font-mono uppercase mb-1">Current qty</p>
              <p className="text-forest-400 text-2xl font-bold font-mono">{currentQty}</p>
              <p className="text-forest-700 text-xs font-mono">
                {result?.variant?.container_size || ''}
              </p>
            </div>
            <div>
              <p className="text-forest-600 text-xs font-mono uppercase mb-1">Location</p>
              <p className="text-white text-sm font-semibold">{invLocation}</p>
              {result?.inventory?.location_splits?.[1] && (
                <p className="text-forest-700 text-xs font-mono">
                  +{result.inventory.location_splits.length - 1} more
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quantity adjuster */}
        <div className="mx-4 mt-3 bg-forest-900 border border-forest-800 rounded-2xl p-4">
          <p className="text-forest-600 text-xs font-mono uppercase tracking-wider mb-3">
            Adjust quantity
          </p>
          <div className="flex items-center justify-center gap-5 mb-4">
            <button
              onClick={() => setAdjQty(q => Math.max(0, q - 1))}
              className="w-11 h-11 bg-forest-950 border border-forest-800 rounded-xl flex items-center justify-center text-white text-xl hover:border-forest-600 transition-colors"
            >
              −
            </button>
            <div className="text-center min-w-[3rem]">
              <span className="text-white text-4xl font-bold font-mono">{adjQty}</span>
              {changeDelta !== 0 && (
                <p className={`text-xs font-mono mt-0.5 ${changeDelta > 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {displayChange}
                </p>
              )}
            </div>
            <button
              onClick={() => setAdjQty(q => q + 1)}
              className="w-11 h-11 bg-forest-950 border border-forest-800 rounded-xl flex items-center justify-center text-white text-xl hover:border-forest-600 transition-colors"
            >
              +
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAdjQty(Math.max(0, currentQty - 1))}
              className="bg-forest-950 border border-forest-800 rounded-xl py-2 text-center text-forest-400 text-sm font-mono hover:border-forest-600 transition-colors"
            >
              Remove one
            </button>
            <button
              onClick={() => setAdjQty(currentQty + 1)}
              className="bg-forest-950 border border-forest-800 rounded-xl py-2 text-center text-forest-400 text-sm font-mono hover:border-forest-600 transition-colors"
            >
              Add one
            </button>
          </div>
        </div>

        {updateErr && (
          <div className="mx-4 mt-3 flex items-center gap-2 bg-red-950 border border-red-800 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{updateErr}</p>
          </div>
        )}

        {/* Update button */}
        <div className="mx-4 mt-3">
          <button
            onClick={handleUpdate}
            disabled={adjust.isPending}
            className="w-full bg-forest-600 hover:bg-forest-500 disabled:opacity-50 rounded-xl py-3.5 text-center text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {adjust.isPending
              ? <><Loader2 size={16} className="animate-spin" /> Updating…</>
              : 'Update Inventory'
            }
          </button>
        </div>

        <div className="flex-1 pb-6" />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // SCREEN: Confirmed
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center max-w-sm mx-auto px-6">

      {/* Success icon */}
      <div className="w-16 h-16 bg-forest-900 border-2 border-forest-600 rounded-full flex items-center justify-center mb-5">
        <CheckCircle size={28} className="text-forest-500" />
      </div>

      <p className="text-white text-xl font-semibold mb-1">Updated!</p>
      <p className="text-forest-500 text-sm font-mono mb-7">Synced to database</p>

      {/* Summary card */}
      <div className="w-full bg-forest-900 border border-forest-800 rounded-2xl p-4 mb-5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-forest-500 text-xs font-mono">Item</span>
          <span className="text-white text-xs font-mono text-right max-w-[60%] truncate">
            {confirmed?.item || '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-forest-500 text-xs font-mono">SKU</span>
          <span className="text-white text-xs font-mono">{confirmed?.sku || '—'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-forest-500 text-xs font-mono">Change</span>
          <span className="text-forest-400 text-xs font-mono">
            {confirmed?.before ?? '—'} → <strong className="text-white">{confirmed?.after ?? '—'}</strong>
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-forest-500 text-xs font-mono">By</span>
          <span className="text-white text-xs font-mono">{confirmed?.by}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-forest-500 text-xs font-mono">Timestamp</span>
          <span className="text-white text-xs font-mono">
            {confirmed?.at ? fmtTime(confirmed.at.toISOString()) + ' today' : '—'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={reset}
        className="w-full bg-forest-600 hover:bg-forest-500 rounded-xl py-3.5 text-center text-white font-semibold mb-3 transition-colors"
      >
        Scan Next Item
      </button>
      <button
        onClick={() => navigate('/admin/inventory')}
        className="w-full bg-forest-900 border border-forest-800 hover:border-forest-700 rounded-xl py-3 text-center text-forest-400 text-sm font-mono flex items-center justify-center gap-2 transition-colors"
      >
        <History size={14} />
        View inventory
      </button>
    </div>
  );
}
