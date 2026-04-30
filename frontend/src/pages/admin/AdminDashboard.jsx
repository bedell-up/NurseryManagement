import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { plants as plantsApi, inventory, preorders, inat } from '../../api/client';
import { Leaf, Package, ShoppingBag, TrendingDown, AlertCircle, ImagePlus, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

function Stat({ icon: Icon, label, value, color, to }) {
  const content = (
    <div className="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`p-2.5 rounded-xl ${color}`}><Icon size={20} className="text-white" /></div>
      <div>
        <p className="text-forest-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-forest-900 mt-0.5">{value ?? '…'}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function LogViewer({ log, onClose }) {
  const [tab, setTab] = useState(log.not_found?.length ? 'not_found' : 'errors');
  const [search, setSearch] = useState('');

  const filter = (list) => list.filter(p =>
    !search || p.common_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.scientific_name?.toLowerCase().includes(search.toLowerCase())
  );

  const notFound = filter(log.not_found || []);
  const errors   = filter(log.errors || []);
  const missing  = filter(log.still_missing || []);

  const Tab = ({ id, label, count, color }) => (
    <button onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === id ? `${color} text-white` : 'text-forest-600 hover:bg-forest-100'}`}>
      {label} <span className="ml-1 opacity-80">({count})</span>
    </button>
  );

  const rows = tab === 'not_found' ? notFound : tab === 'errors' ? errors : missing;

  return (
    <div className="mt-4 border-t border-forest-100 pt-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {(log.not_found?.length > 0 || log.still_missing?.length > 0) && (
          <Tab id="not_found" label="Not Found on iNaturalist"
            count={log.not_found?.length || log.still_missing?.length}
            color="bg-amber-500" />
        )}
        {log.errors?.length > 0 && (
          <Tab id="errors" label="Errors" count={log.errors.length} color="bg-red-500" />
        )}
        {log.still_missing?.length > 0 && log.not_found?.length > 0 && (
          <Tab id="missing" label="All Still Missing" count={log.still_missing.length} color="bg-forest-500" />
        )}
        <div className="ml-auto">
          <input
            className="input text-sm w-52"
            placeholder="Filter by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-forest-400 text-sm py-4 text-center">No results</p>
      ) : (
        <div className="border border-forest-100 rounded-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto divide-y divide-forest-50">
            {rows.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-forest-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-forest-900 text-sm truncate">{item.common_name}</div>
                  <div className="text-xs text-forest-500 italic truncate">{item.scientific_name}</div>
                  {item.error && (
                    <div className="text-xs text-red-500 mt-0.5 truncate" title={item.error}>{item.error}</div>
                  )}
                </div>
                {item.plant_id && (
                  <a
                    href={`https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(item.scientific_name || item.common_name)}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs text-blue-500 hover:underline flex-shrink-0 mt-0.5"
                  >
                    Search iNat ↗
                  </a>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-2 bg-forest-50 border-t border-forest-100 text-xs text-forest-500">
            Showing {rows.length} {search ? 'matching ' : ''}plants
            {tab === 'not_found' && ' — these plants were searched but had no matching photos on iNaturalist'}
            {tab === 'errors' && ' — these encountered API errors during fetch (network timeouts, etc.)'}
          </div>
        </div>
      )}

      {log.note && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2 mt-3">{log.note}</p>
      )}
    </div>
  );
}

function BulkImageFetcher() {
  const qc = useQueryClient();
  const [state, setState] = useState('idle'); // idle | running | done
  const [progress, setProgress] = useState(null);
  const [log, setLog] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const { data: fetchLog, refetch: refetchLog } = useQuery({
    queryKey: ['inat-log'],
    queryFn: () => inat.getLog().then(r => r.data),
    retry: false,
  });

  const start = () => {
    setState('running');
    setProgress(null);
    setLog([]);

    const token = localStorage.getItem('natives_token');
    const es = new EventSource(`/api/inaturalist/bulk-fetch/stream?limit=502&token=${token}`);

    // EventSource doesn't support custom headers — use a workaround via fetch SSE
    es.close();

    // Use fetch with ReadableStream instead (supports Authorization header)
    fetch('/api/inaturalist/bulk-fetch/stream?limit=502', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'start') {
              setProgress({ total: evt.total, updated: 0, skipped: 0, errors: 0 });
            } else if (evt.type === 'progress') {
              setProgress({ total: evt.total, updated: evt.updated, skipped: evt.skipped, errors: evt.errors });
              if (evt.status === 'updated') {
                setLog(l => [`✓ ${evt.plant}`, ...l.slice(0, 19)]);
              }
            } else if (evt.type === 'done') {
              setProgress({ total: evt.total, updated: evt.updated, skipped: evt.skipped, errors: evt.errors });
              setState('done');
              qc.invalidateQueries({ queryKey: ['plants'] });
              refetchLog();
            }
          } catch {}
        }
      }
      setState('done');
    }).catch(() => setState('idle'));
  };

  const pct = progress ? Math.round(((progress.updated + progress.skipped + progress.errors) / progress.total) * 100) : 0;

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-semibold text-forest-900 flex items-center gap-2">
            <ImagePlus size={17} className="text-earth-500" />
            iNaturalist Photo Import
          </h2>
          <p className="text-forest-500 text-sm mt-0.5">
            Automatically fetch plant photos from iNaturalist for all plants missing images.
          </p>
        </div>
        <button
          onClick={start}
          disabled={state === 'running'}
          className={`btn-earth flex-shrink-0 ${state === 'running' ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {state === 'running'
            ? <><Loader size={15} className="animate-spin" /> Fetching…</>
            : <><ImagePlus size={15} /> Fetch All Photos</>}
        </button>
      </div>

      {state !== 'idle' && progress && (
        <div className="space-y-3">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-forest-500 mb-1">
              <span>{progress.updated + progress.skipped + progress.errors} / {progress.total} processed</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-forest-100 rounded-full h-2">
              <div className="bg-forest-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Counters */}
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-forest-600"><CheckCircle size={13} /> {progress.updated} found</span>
            <span className="flex items-center gap-1.5 text-forest-400">— {progress.skipped} not found</span>
            {progress.errors > 0 && <span className="flex items-center gap-1.5 text-red-500"><XCircle size={13} /> {progress.errors} errors</span>}
          </div>

          {/* Live log */}
          {log.length > 0 && (
            <div className="bg-forest-50 rounded-lg p-3 max-h-36 overflow-y-auto space-y-1">
              {log.map((entry, i) => (
                <div key={i} className="text-xs text-forest-600">{entry}</div>
              ))}
            </div>
          )}

              {state === 'done' && (
            <p className="text-sm font-medium text-forest-700">
              Done — {progress.updated} photos added out of {progress.total} plants searched.
            </p>
          )}
        </div>
      )}

      {/* View last results */}
      {fetchLog && state !== 'running' && (
        <div className="mt-4 border-t border-forest-100 pt-4">
          <button
            onClick={() => setShowResults(!showResults)}
            className="flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 transition-colors"
          >
            {showResults ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {showResults ? 'Hide' : 'View'} last fetch results
            <span className="text-forest-400 font-normal">
              — {new Date(fetchLog.run_at).toLocaleDateString()} &bull; {fetchLog.summary?.updated ?? 0} found &bull; {(fetchLog.not_found?.length || fetchLog.still_missing?.length) ?? 0} not found &bull; {fetchLog.errors?.length ?? 0} errors
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); refetchLog(); }}
              className="ml-auto text-forest-400 hover:text-forest-600"
              title="Refresh log"
            >
              <RefreshCw size={13} />
            </button>
          </button>
          {showResults && <LogViewer log={fetchLog} onClose={() => setShowResults(false)} />}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: plantData }    = useQuery({ queryKey: ['plants','dash'],    queryFn: () => plantsApi.list({ limit: 1 }).then(r => r.data) });
  const { data: invData }      = useQuery({ queryKey: ['inventory','dash'], queryFn: () => inventory.list({ limit: 1 }).then(r => r.data) });
  const { data: lowData }      = useQuery({ queryKey: ['inventory','low'],  queryFn: () => inventory.list({ low_stock: true, limit: 10 }).then(r => r.data) });
  const { data: preorderData } = useQuery({ queryKey: ['preorders','dash'], queryFn: () => preorders.list({ status: 'confirmed', limit: 1 }).then(r => r.data) });

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-serif font-semibold text-forest-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Leaf}        label="Total Plants"      value={plantData?.total}          color="bg-forest-600" to="/admin/plants" />
        <Stat icon={Package}     label="Inventory Records" value={invData?.total}             color="bg-earth-500"  to="/admin/inventory" />
        <Stat icon={ShoppingBag} label="Active Pre-orders" value={preorderData?.total}        color="bg-blue-500"   to="/admin/preorders" />
        <Stat icon={TrendingDown}label="Low Stock Items"   value={lowData?.inventory?.length} color="bg-red-500"    to="/admin/inventory?low=true" />
      </div>

      {/* iNaturalist bulk photo importer */}
      <BulkImageFetcher />

      {/* Low stock alert */}
      {lowData?.inventory?.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-red-500" />
            <h2 className="font-semibold text-forest-900">Low Stock Plants</h2>
          </div>
          <div className="space-y-2">
            {lowData.inventory.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-forest-50 last:border-0">
                <div>
                  <span className="font-medium text-forest-900 text-sm">{item.variant?.plant?.common_name}</span>
                  <span className="text-forest-400 text-xs ml-2">{item.variant?.container_size}</span>
                </div>
                <span className="badge-red">{item.quantity_on_hand} left</span>
              </div>
            ))}
          </div>
          <Link to="/admin/inventory" className="btn-secondary mt-4 text-xs inline-flex">View all inventory →</Link>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold text-forest-900 mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Link to="/admin/plants"     className="btn-secondary justify-center py-3">Manage Plants</Link>
          <Link to="/admin/pricing"    className="btn-secondary justify-center py-3">Update Pricing</Link>
          <Link to="/admin/preorders"  className="btn-secondary justify-center py-3">Pre-orders</Link>
          <Link to="/admin/deliveries" className="btn-secondary justify-center py-3">Deliveries</Link>
          <Link to="/admin/spotlights" className="btn-secondary justify-center py-3">Spotlights</Link>
          <Link to="/admin/import"     className="btn-secondary justify-center py-3">Import Data</Link>
        </div>
      </div>
    </div>
  );
}
