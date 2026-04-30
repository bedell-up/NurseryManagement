import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { preorders } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { SortHeader, MultiSortBar } from '../../components/ui/SortControls';
import { useMultiSort, applyMultiSort } from '../../hooks/useMultiSort';

const PREORDER_SORT_COLS = [
  { value: 'customer',        label: 'Customer' },
  { value: 'plant',           label: 'Plant' },
  { value: 'status',          label: 'Status' },
  { value: 'quantity',        label: 'Qty' },
  { value: 'estimated_date',  label: 'Est. Date' },
];

function preorderGetVal(p, col) {
  switch (col) {
    case 'customer':       return (p.customer_name || '').toLowerCase();
    case 'plant':          return (p.variant?.plant?.common_name || '').toLowerCase();
    case 'status':         return p.status || '';
    case 'quantity':       return p.quantity ?? 0;
    case 'estimated_date': return p.estimated_availability_date || '';
    default:               return '';
  }
}

const STATUS_COLORS = {
  pending: 'badge-gray', confirmed: 'badge-blue', ready: 'badge-green',
  fulfilled: 'badge-earth', cancelled: 'badge-red',
};

function StatusForm({ preorder, onClose }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(preorder.status);
  const [notes, setNotes] = useState('');
  const mutation = useMutation({
    mutationFn: (d) => preorders.updateStatus(preorder.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['preorders'] }); onClose(); },
  });
  return (
    <div className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-3 text-sm">
        <div className="font-medium">{preorder.customer_name}</div>
        <div className="text-forest-500">{preorder.variant?.plant?.common_name} &bull; qty {preorder.quantity}</div>
      </div>
      <div>
        <label className="label">New Status</label>
        <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
          {['pending','confirmed','ready','fulfilled','cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => mutation.mutate({ status, notes })} disabled={mutation.isPending} className="btn-primary">Update</button>
      </div>
    </div>
  );
}

export default function AdminPreorders() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [editItem, setEditItem] = useState(null);
  const { sortCol, sortDir, sort2Col, setSort2Col, sort2Dir, setSort2Dir, handleSort } = useMultiSort('customer');

  const { data, isLoading } = useQuery({
    queryKey: ['preorders', page, statusFilter],
    queryFn: () => preorders.list({ page, limit: 50, status: statusFilter || undefined }).then(r => r.data),
    keepPreviousData: true,
  });

  const sortedPreorders = useMemo(
    () => applyMultiSort(data?.preorders ?? [], sortCol, sortDir, sort2Col, sort2Dir, preorderGetVal),
    [data?.preorders, sortCol, sortDir, sort2Col, sort2Dir],
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Pre-orders</h1>
          <p className="text-forest-500 text-sm mt-0.5">{data?.total ?? '…'} orders</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select className="select w-40" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {['pending','confirmed','ready','fulfilled','cancelled'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
            ))}
          </select>
          <MultiSortBar
            columns={PREORDER_SORT_COLS}
            sortCol={sortCol}
            sort2Col={sort2Col}
            setSort2Col={setSort2Col}
            sort2Dir={sort2Dir}
            setSort2Dir={setSort2Dir}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50 border-b border-forest-100 text-left">
                <SortHeader label="Customer" col="customer" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Plant" col="plant" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Qty" col="quantity" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center" />
                <SortHeader label="Est. Date" col="estimated_date" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                <SortHeader label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 font-medium text-forest-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {isLoading ? (
                Array.from({length:8}).map((_,i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-forest-100 rounded animate-pulse" /></td></tr>)
              ) : sortedPreorders.map(p => (
                <tr key={p.id} className="hover:bg-forest-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-forest-900">{p.customer_name}</div>
                    <div className="text-xs text-forest-400">{p.customer_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-forest-900">{p.variant?.plant?.common_name}</div>
                    <div className="text-xs text-forest-400">{p.variant?.container_size}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{p.quantity}</td>
                  <td className="px-4 py-3 text-forest-500 hidden md:table-cell">{p.estimated_availability_date || '—'}</td>
                  <td className="px-4 py-3"><span className={STATUS_COLORS[p.status]}>{p.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditItem(p)} className="btn-secondary text-xs px-3 py-1.5">Update</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <div className="px-4 py-3 border-t border-forest-100"><Pagination page={page} total={data.total} limit={50} onPage={setPage} /></div>}
      </div>

      {editItem && (
        <Modal title="Update Pre-order" onClose={() => setEditItem(null)} size="sm">
          <StatusForm preorder={editItem} onClose={() => setEditItem(null)} />
        </Modal>
      )}
    </div>
  );
}
