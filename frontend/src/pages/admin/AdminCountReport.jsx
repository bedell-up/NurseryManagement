import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventory } from '../../api/client';
import { FileDown, Filter } from 'lucide-react';
import { SortHeader } from '../../components/ui/SortControls';
import { useMultiSort, applyMultiSort } from '../../hooks/useMultiSort';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const STATUS_LABELS = {
  retail_ready:   'Retail Ready',
  just_potted:    'Just Potted',
  available_soon: 'Available Soon',
  on_hold:        'On Hold',
  damaged:        'Damaged / Loss',
};

const STATUS_COLORS = {
  retail_ready:   'bg-green-100 text-green-800',
  just_potted:    'bg-sky-100 text-sky-800',
  available_soon: 'bg-amber-100 text-amber-800',
  on_hold:        'bg-purple-100 text-purple-800',
  damaged:        'bg-red-100 text-red-800',
};

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (preset) {
    case 'today':
      return { from: toDateStr(now), to: toDateStr(now) };
    case 'this_week': {
      const day = now.getDay(); // 0=Sun
      const mon = new Date(now); mon.setDate(d - (day === 0 ? 6 : day - 1));
      return { from: toDateStr(mon), to: toDateStr(now) };
    }
    case 'this_month':
      return { from: toDateStr(new Date(y, m, 1)), to: toDateStr(now) };
    case 'last_month': {
      const first = new Date(y, m - 1, 1);
      const last  = new Date(y, m, 0);
      return { from: toDateStr(first), to: toDateStr(last) };
    }
    case 'this_year':
      return { from: toDateStr(new Date(y, 0, 1)), to: toDateStr(now) };
    default:
      return null;
  }
}

const PRESETS = [
  { value: 'today',      label: 'Today' },
  { value: 'this_week',  label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year',  label: 'This Year' },
  { value: 'custom',     label: 'Custom' },
];

function exportCsv(entries) {
  const headers = ['Date', 'User', 'Plant', 'Scientific Name', 'SKU', 'Size', 'Location', 'Status', 'Before', 'Change', 'After', 'Notes'];
  const rows = entries.map(e => [
    new Date(e.createdAt).toLocaleString(),
    userName(e),
    e.variant?.plant?.common_name ?? '',
    e.variant?.plant?.scientific_name ?? '',
    e.variant?.sku ?? '',
    e.variant?.container_size ?? '',
    e.location ?? '',
    STATUS_LABELS[e.inventory_status] ?? e.inventory_status,
    e.quantity_before,
    e.quantity_change >= 0 ? `+${e.quantity_change}` : e.quantity_change,
    e.quantity_after,
    e.notes ?? '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `inventory-count-report-${toDateStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function userName(e) {
  return e.user?.name || e.user?.email || 'Unknown';
}

function getVal(e, col) {
  switch (col) {
    case 'date':    return e.createdAt || '';
    case 'plant':   return (e.variant?.plant?.scientific_name || e.variant?.plant?.common_name || '').toLowerCase();
    case 'sku':     return (e.variant?.sku || '').toLowerCase();
    case 'size':    return (e.variant?.container_size || '').toLowerCase();
    case 'status':  return e.inventory_status || '';
    case 'before':  return e.quantity_before ?? 0;
    case 'change':  return e.quantity_change ?? 0;
    case 'after':   return e.quantity_after ?? 0;
    case 'location':return (e.location || '').toLowerCase();
    case 'user':    return userName(e).toLowerCase();
    default:        return '';
  }
}

function exportPdf(entries, rangeLabel, userLabel) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

  doc.setFontSize(14);
  doc.text('Inventory Count Report', 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const subtitle = [rangeLabel, userLabel].filter(Boolean).join(' · ');
  if (subtitle) doc.text(subtitle, 40, 52);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 64);

  autoTable(doc, {
    startY: 78,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [44, 74, 54], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 245] },
    head: [['Date', 'User', 'Plant', 'SKU', 'Size', 'Status', 'Before', 'Change', 'After', 'Location']],
    body: entries.map(e => [
      new Date(e.createdAt).toLocaleDateString(),
      userName(e),
      [e.variant?.plant?.scientific_name, e.variant?.plant?.common_name].filter(Boolean).join('\n') || '—',
      e.variant?.sku || '—',
      e.variant?.container_size || '—',
      STATUS_LABELS[e.inventory_status] ?? e.inventory_status,
      e.quantity_before,
      e.quantity_change >= 0 ? `+${e.quantity_change}` : e.quantity_change,
      e.quantity_after,
      e.location || '—',
    ]),
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 70 },
      6: { cellWidth: 42, halign: 'center' },
      7: { cellWidth: 42, halign: 'center' },
      8: { cellWidth: 42, halign: 'center' },
    },
  });

  doc.save(`inventory-count-report-${toDateStr(new Date())}.pdf`);
}

export default function AdminCountReport() {
  const [preset, setPreset]         = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [userFilter,   setUserFilter] = useState('');
  const { sortCol, sortDir, handleSort } = useMultiSort('date', 'desc');

  const range = useMemo(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo };
    return getPresetRange(preset) ?? {};
  }, [preset, customFrom, customTo]);

  const params = {
    ...(range.from    ? { from:    range.from    } : {}),
    ...(range.to      ? { to:      range.to      } : {}),
    ...(statusFilter  ? { status:  statusFilter  } : {}),
    ...(userFilter    ? { user_id: userFilter    } : {}),
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['count-report', params],
    queryFn:  () => inventory.countReport(params).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['count-report-users'],
    queryFn:  () => inventory.countReportUsers().then(r => r.data),
    staleTime: 60_000,
  });
  const userOptions = usersData?.users ?? [];

  const rawEntries = data?.entries ?? [];
  const entries = useMemo(
    () => applyMultiSort(rawEntries, sortCol, sortDir, '', 'asc', getVal),
    [rawEntries, sortCol, sortDir]
  );

  // Summary counts by status
  const summary = useMemo(() => {
    const counts = {};
    for (const e of entries) {
      counts[e.inventory_status] = (counts[e.inventory_status] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Count Report</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            {isLoading ? '…' : `${entries.length} entries`}
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <button
            onClick={() => exportCsv(entries)}
            disabled={entries.length === 0}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <FileDown size={15} />
            CSV
          </button>
          <button
            onClick={() => {
              const rangeLabel = preset === 'custom'
                ? `${customFrom || '…'} – ${customTo || '…'}`
                : PRESETS.find(p => p.value === preset)?.label ?? '';
              const userLabel = userFilter
                ? (userOptions.find(u => u.id === userFilter)?.name || userOptions.find(u => u.id === userFilter)?.email || '')
                : '';
              exportPdf(entries, rangeLabel, userLabel);
            }}
            disabled={entries.length === 0}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <FileDown size={15} />
            PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-forest-700">
          <Filter size={14} />
          Filters
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Date presets */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  preset === p.value
                    ? 'bg-forest-700 text-white border-forest-700'
                    : 'border-forest-200 text-forest-600 hover:border-forest-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            className="select text-sm"
            value={statusFilter}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          {/* User filter */}
          <select
            className="select text-sm"
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
          >
            <option value="">All Users</option>
            {userOptions.map(u => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </div>

        {/* Custom date range */}
        {preset === 'custom' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="label text-xs">From</label>
              <input
                type="date"
                className="input text-sm"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">To</label>
              <input
                type="date"
                className="input text-sm"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Status summary pills */}
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-forest-100">
            {Object.entries(summary).map(([s, n]) => (
              <span key={s} className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[s] ?? 'bg-forest-100 text-forest-700'}`}>
                {STATUS_LABELS[s] ?? s}: {n}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50 border-b border-forest-100 text-left">
                <SortHeader label="Date"     col="date"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="User"     col="user"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Plant"    col="plant"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="SKU"      col="sku"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Size"     col="size"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Status"   col="status"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Before"   col="before"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center" />
                <SortHeader label="Change"   col="change"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center" />
                <SortHeader label="After"    col="after"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center" />
                <SortHeader label="Location" col="location" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                <th className="px-4 py-3 font-medium text-forest-600 hidden lg:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {isLoading || isFetching ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={10} className="px-4 py-3">
                      <div className="h-4 bg-forest-100 rounded animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-forest-400">
                    No count entries found for this period.
                  </td>
                </tr>
              ) : entries.map(e => {
                const plant = e.variant?.plant;
                const change = e.quantity_change;
                return (
                  <tr key={e.id} className="hover:bg-forest-50/40 transition-colors">
                    <td className="px-4 py-2.5 text-forest-500 text-xs whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleDateString()}<br />
                      <span className="text-forest-400">{new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-forest-700 whitespace-nowrap">
                      {e.user?.name || e.user?.email || <span className="text-forest-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium italic text-forest-900 text-xs">{plant?.scientific_name || plant?.common_name}</div>
                      {plant?.scientific_name && <div className="text-forest-400 text-xs">{plant?.common_name}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-forest-600">{e.variant?.sku ?? '—'}</td>
                    <td className="px-4 py-2.5 text-forest-600 text-xs">{e.variant?.container_size ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[e.inventory_status] ?? 'bg-forest-100 text-forest-700'}`}>
                        {STATUS_LABELS[e.inventory_status] ?? e.inventory_status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-forest-500">{e.quantity_before}</td>
                    <td className={`px-4 py-2.5 text-center font-semibold ${change > 0 ? 'text-green-700' : change < 0 ? 'text-red-600' : 'text-forest-400'}`}>
                      {change > 0 ? `+${change}` : change}
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-forest-900">{e.quantity_after}</td>
                    <td className="px-4 py-2.5 text-forest-500 text-xs hidden md:table-cell">{e.location || '—'}</td>
                    <td className="px-4 py-2.5 text-forest-400 text-xs hidden lg:table-cell max-w-[200px] truncate">{e.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
