import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorOrders as ordersApi, vendors as vendorsApi, plants as plantsApi, locations as locationsApi } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Confirm from '../../components/ui/Confirm';
import PlantSearchSelect from '../../components/admin/PlantSearchSelect';
import { Plus, Pencil, Trash2, CheckCircle, ChevronRight, ChevronDown, Truck, PackageCheck, XCircle } from 'lucide-react';

const STATUS_COLORS = {
  draft:     'bg-forest-100 text-forest-600',
  ordered:   'bg-amber-100 text-amber-800',
  received:  'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-600',
};
const STATUS_LABELS = { draft: 'Draft', ordered: 'Ordered', received: 'Received', cancelled: 'Cancelled' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtMoney(v) {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

// ─── Order Form ───────────────────────────────────────────────────────────────

const EMPTY_ITEM = () => ({ plant_id: '', variant_id: '', quantity_ordered: '1', unit_cost: '', location: '' });

function OrderForm({ order, vendors, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!order?.id;

  const [vendorId,      setVendorId]      = useState(order?.vendor_id    || '');
  const [orderDate,     setOrderDate]     = useState(order?.order_date    || '');
  const [expectedDate,  setExpectedDate]  = useState(order?.expected_date || '');
  const [notes,         setNotes]         = useState(order?.notes         || '');
  const [items,         setItems]         = useState(
    order?.items?.length
      ? order.items.map(i => ({
          plant_id:        i.variant?.plant?.id || '',
          variant_id:      i.variant_id,
          quantity_ordered: String(i.quantity_ordered),
          unit_cost:       i.unit_cost ?? '',
          location:        i.location  || '',
        }))
      : [EMPTY_ITEM()]
  );
  const [error, setError] = useState('');

  const { data: plantsData } = useQuery({
    queryKey: ['vendor-order-plants'],
    queryFn: () => plantsApi.list({ limit: 9999 }).then(r => r.data),
    staleTime: 60_000,
  });
  const allPlants = useMemo(() =>
    (plantsData?.plants ?? []).slice().sort((a, b) =>
      (a.scientific_name || a.common_name).localeCompare(b.scientific_name || b.common_name)
    ), [plantsData]
  );
  const plantsById = useMemo(() => Object.fromEntries(allPlants.map(p => [p.id, p])), [allPlants]);

  const { data: locationsData } = useQuery({
    queryKey: ['locations-all'],
    queryFn: () => locationsApi.list().then(r => r.data),
    staleTime: 60_000,
  });
  const locationOptions = (locationsData?.locations ?? locationsData ?? []).filter(l => l.is_active !== false);

  // Selected vendor's code — used to find existing VendorSku cost
  const selectedVendor = vendors.find(v => v.id === vendorId);

  const setItem = (i, field, val) =>
    setItems(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const addItem = () => setItems(prev => [...prev, EMPTY_ITEM()]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handlePlantChange = (i, plantId) => {
    setItems(prev => prev.map((r, idx) => idx === i
      ? { ...r, plant_id: plantId, variant_id: '', unit_cost: '' }
      : r
    ));
  };

  const handleVariantChange = (i, variantId) => {
    const plant   = plantsById[items[i]?.plant_id];
    const variant = (plant?.variants ?? []).find(v => v.id === variantId);
    // Pre-fill cost from existing VendorSku for this vendor, if available
    const existingCost = selectedVendor
      ? variant?.vendor_skus?.find(vs => vs.vendor_code === selectedVendor.code)?.cost
      : undefined;
    setItems(prev => prev.map((r, idx) => idx === i
      ? { ...r, variant_id: variantId, unit_cost: existingCost != null ? String(existingCost) : r.unit_cost }
      : r
    ));
  };

  // Show existing vendor cost for a line item
  const getExistingCost = (item) => {
    if (!selectedVendor || !item.variant_id) return null;
    const plant   = plantsById[item.plant_id];
    const variant = (plant?.variants ?? []).find(v => v.id === item.variant_id);
    return variant?.vendor_skus?.find(vs => vs.vendor_code === selectedVendor.code)?.cost ?? null;
  };

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? ordersApi.update(order.id, data) : ordersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-orders'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error || 'Save failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!vendorId) return setError('Select a vendor');
    const validItems = items.filter(i => i.variant_id && parseInt(i.quantity_ordered, 10) > 0);
    if (!validItems.length) return setError('Add at least one item');
    mutation.mutate({
      vendor_id:     vendorId,
      order_date:    orderDate    || null,
      expected_date: expectedDate || null,
      notes:         notes        || null,
      items: validItems.map(i => ({
        variant_id:       i.variant_id,
        quantity_ordered: parseInt(i.quantity_ordered, 10),
        unit_cost:        i.unit_cost !== '' ? parseFloat(i.unit_cost) : null,
        location:         i.location || null,
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Order header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Vendor *</label>
          <select className="select" value={vendorId} onChange={e => setVendorId(e.target.value)}>
            <option value="">— select vendor —</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Order Date</label>
          <input className="input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Expected Arrival</label>
          <input className="input" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Items *</label>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_70px_100px_120px_32px] gap-2 mb-1 px-0.5">
          {['Plant', 'Size', 'Qty', 'COG / unit', 'Location', ''].map((h, i) => (
            <div key={i} className="text-xs font-medium text-forest-500">{h}</div>
          ))}
        </div>

        <div className="space-y-2.5">
          {items.map((item, i) => {
            const itemPlant    = plantsById[item.plant_id];
            const itemVariants = (itemPlant?.variants ?? []).filter(v => v.is_active !== false);
            const existingCost = getExistingCost(item);

            return (
              <div key={i} className="grid grid-cols-[1fr_1fr_70px_100px_120px_32px] gap-2 items-start">
                <PlantSearchSelect
                  plants={allPlants}
                  value={item.plant_id}
                  onChange={(plantId) => handlePlantChange(i, plantId)}
                  placeholder="Search plant…"
                />

                <select
                  className="select text-sm"
                  value={item.variant_id}
                  onChange={e => handleVariantChange(i, e.target.value)}
                  disabled={!item.plant_id}
                >
                  <option value="">— size —</option>
                  {itemVariants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.container_size}{v.sku ? ` (${v.sku})` : ''}
                    </option>
                  ))}
                </select>

                <input
                  className="input text-sm text-center"
                  type="number" min="1"
                  value={item.quantity_ordered}
                  onChange={e => setItem(i, 'quantity_ordered', e.target.value)}
                />

                {/* COG input — shows existing cost as placeholder */}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-forest-400 text-xs">$</span>
                  <input
                    className="input text-sm pl-5"
                    type="number" min="0" step="0.01"
                    value={item.unit_cost}
                    onChange={e => setItem(i, 'unit_cost', e.target.value)}
                    placeholder={existingCost != null ? existingCost.toFixed(2) : '0.00'}
                    title={existingCost != null ? `Current vendor COG: $${parseFloat(existingCost).toFixed(2)}` : undefined}
                  />
                </div>

                <select
                  className="select text-sm"
                  value={item.location}
                  onChange={e => setItem(i, 'location', e.target.value)}
                >
                  <option value="">— any —</option>
                  {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>

                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  className="flex items-center justify-center w-8 h-8 rounded text-forest-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={addItem} className="mt-2 flex items-center gap-1 text-sm text-forest-500 hover:text-forest-700">
          <Plus size={14} /> Add item
        </button>

        {selectedVendor && (
          <p className="mt-2 text-xs text-forest-400">
            Existing COG for <strong>{selectedVendor.name}</strong> appears as placeholder; entering a new value will update it on receive.
          </p>
        )}
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="PO number, shipping details…" />
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 rounded px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-forest-100">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Order'}
        </button>
      </div>
    </form>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, vendors, onEdit, onDelete, onMarkOrdered, onReceive }) {
  const [expanded, setExpanded] = useState(false);
  const isEditable = order.status === 'draft' || order.status === 'ordered';

  const itemCount = order.items?.length ?? 0;
  const totalCost = (order.items ?? []).reduce((s, i) => {
    return s + (parseFloat(i.unit_cost) || 0) * (i.quantity_ordered || 0);
  }, 0);

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-forest-50/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded
            ? <ChevronDown size={15} className="text-forest-400 flex-shrink-0" />
            : <ChevronRight size={15} className="text-forest-400 flex-shrink-0" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-forest-900">Order #{order.order_number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
              {order.vendor?.name && (
                <span className="text-sm text-forest-600">{order.vendor.name}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-forest-400 flex-wrap">
              <span>{fmtDate(order.order_date || order.createdAt)}</span>
              <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
              {totalCost > 0 && <span>est. {fmtMoney(totalCost)}</span>}
              {order.expected_date && <span>expected {fmtDate(order.expected_date)}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {order.status === 'draft' && (
            <button
              onClick={() => onMarkOrdered(order)}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
              title="Mark as ordered / sent to vendor"
            >
              <Truck size={13} /> Mark Ordered
            </button>
          )}
          {(order.status === 'draft' || order.status === 'ordered') && (
            <button
              onClick={() => onReceive(order)}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
              title="Receive order — adds to inventory and updates COG"
            >
              <PackageCheck size={13} /> Receive
            </button>
          )}
          {isEditable && (
            <button onClick={() => onEdit(order)} className="btn-ghost px-2 py-1.5 text-forest-500 hover:text-forest-800" title="Edit">
              <Pencil size={14} />
            </button>
          )}
          {order.status !== 'received' && (
            <button onClick={() => onDelete(order)} className="btn-ghost px-2 py-1.5 text-forest-400 hover:text-red-500" title="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-forest-100">
          {order.notes && (
            <div className="px-5 py-3 bg-forest-50/50 text-sm text-forest-600 border-b border-forest-100">
              {order.notes}
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50 border-b border-forest-100">
                <th className="px-5 py-2.5 text-left font-medium text-forest-600">Plant</th>
                <th className="px-4 py-2.5 text-left font-medium text-forest-600">Size / SKU</th>
                <th className="px-4 py-2.5 text-center font-medium text-forest-600">Qty Ordered</th>
                {order.status === 'received' && (
                  <th className="px-4 py-2.5 text-center font-medium text-forest-600">Qty Received</th>
                )}
                <th className="px-4 py-2.5 text-left font-medium text-forest-600 hidden sm:table-cell">Location</th>
                <th className="px-4 py-2.5 text-right font-medium text-forest-600">COG / unit</th>
                <th className="px-4 py-2.5 text-right font-medium text-forest-600">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {(order.items ?? []).map(item => {
                const plant     = item.variant?.plant;
                const lineTotal = (parseFloat(item.unit_cost) || 0) * (item.quantity_ordered || 0);
                const existingCost = item.variant?.vendor_skus?.find(
                  vs => vs.vendor_code === order.vendor?.code
                )?.cost;
                const cogChanged = item.unit_cost != null && existingCost != null
                  && parseFloat(item.unit_cost) !== parseFloat(existingCost);

                return (
                  <tr key={item.id} className="hover:bg-forest-50/30">
                    <td className="px-5 py-2.5">
                      <div className="font-medium italic text-forest-900 text-xs">{plant?.scientific_name || plant?.common_name || '—'}</div>
                      {plant?.scientific_name && <div className="text-forest-400 text-xs">{plant?.common_name}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs text-forest-700">{item.variant?.container_size}</div>
                      {item.variant?.sku && <div className="text-xs text-forest-400 font-mono">{item.variant.sku}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-forest-900">{item.quantity_ordered}</td>
                    {order.status === 'received' && (
                      <td className="px-4 py-2.5 text-center text-forest-600">{item.quantity_received ?? '—'}</td>
                    )}
                    <td className="px-4 py-2.5 text-xs text-forest-500 hidden sm:table-cell">{item.location || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <span className={item.unit_cost != null ? 'text-forest-800 font-medium' : 'text-forest-400'}>
                        {item.unit_cost != null ? fmtMoney(item.unit_cost) : '—'}
                      </span>
                      {cogChanged && (
                        <div className="text-forest-400 line-through text-[10px]">{fmtMoney(existingCost)}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium text-forest-800">
                      {lineTotal > 0 ? fmtMoney(lineTotal) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totalCost > 0 && (
              <tfoot>
                <tr className="border-t border-forest-200 bg-forest-50">
                  <td colSpan={order.status === 'received' ? 6 : 5} className="px-5 py-2.5 text-right text-sm font-medium text-forest-700">
                    Estimated Total Cost
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-forest-900">{fmtMoney(totalCost)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {order.received_date && (
            <div className="px-5 py-2.5 text-xs text-forest-400 border-t border-forest-100">
              Received {fmtDate(order.received_date)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Receive Modal ────────────────────────────────────────────────────────────
// Lets the user confirm received quantities before committing.

function ReceiveModal({ order, onConfirm, onCancel, isPending }) {
  const [quantities, setQuantities] = useState(
    Object.fromEntries((order.items ?? []).map(i => [i.id, String(i.quantity_ordered)]))
  );

  const setQty = (id, val) => setQuantities(prev => ({ ...prev, [id]: val }));

  const handleConfirm = () => {
    const items = (order.items ?? []).map(i => ({
      id: i.id,
      quantity_received: parseInt(quantities[i.id], 10) || i.quantity_ordered,
    }));
    onConfirm({ items });
  };

  return (
    <Modal title={`Receive Order #${order.order_number}`} onClose={onCancel} size="md">
      <div className="space-y-4">
        <p className="text-sm text-forest-600">
          Confirm received quantities. Inventory will be updated and COG will be saved per vendor.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-50 border-b border-forest-100">
              <th className="px-3 py-2 text-left font-medium text-forest-600">Plant</th>
              <th className="px-3 py-2 text-left font-medium text-forest-600">Size</th>
              <th className="px-3 py-2 text-center font-medium text-forest-600">Ordered</th>
              <th className="px-3 py-2 text-center font-medium text-forest-600">Received</th>
              <th className="px-3 py-2 text-right font-medium text-forest-600">COG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-50">
            {(order.items ?? []).map(item => {
              const plant = item.variant?.plant;
              return (
                <tr key={item.id}>
                  <td className="px-3 py-2.5">
                    <div className="text-xs italic text-forest-900">{plant?.scientific_name || plant?.common_name || '—'}</div>
                    {plant?.scientific_name && <div className="text-forest-400 text-xs">{plant?.common_name}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-forest-700">{item.variant?.container_size}</td>
                  <td className="px-3 py-2.5 text-center text-forest-600">{item.quantity_ordered}</td>
                  <td className="px-3 py-2.5">
                    <input
                      className="input text-sm text-center w-16 mx-auto block"
                      type="number" min="0"
                      value={quantities[item.id] ?? item.quantity_ordered}
                      onChange={e => setQty(item.id, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-forest-700">
                    {item.unit_cost != null ? fmtMoney(item.unit_cost) : <span className="text-forest-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end gap-3 pt-2 border-t border-forest-100">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={handleConfirm} disabled={isPending} className="btn-primary flex items-center gap-1.5">
            <PackageCheck size={14} />
            {isPending ? 'Receiving…' : 'Confirm Receive'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminVendorOrders() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [editOrder,    setEditOrder]    = useState(null);
  const [addOpen,      setAddOpen]      = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['vendor-orders', statusFilter],
    queryFn:  () => ordersApi.list(statusFilter ? { status: statusFilter } : {}).then(r => r.data),
    staleTime: 30_000,
  });
  const orders = ordersData?.orders ?? [];

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn:  () => vendorsApi.list().then(r => r.data),
    staleTime: 120_000,
  });
  const vendors = vendorsData?.vendors ?? vendorsData ?? [];

  const markOrderedMutation = useMutation({
    mutationFn: (id) => ordersApi.markOrdered(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-orders'] }),
    onError: (e) => alert(e.response?.data?.error || 'Failed'),
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, data }) => ordersApi.receive(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-orders'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setReceiveTarget(null);
    },
    onError: (e) => alert(e.response?.data?.error || 'Receive failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => ordersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-orders'] }); setDeleteTarget(null); },
  });

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Vendor Orders</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            {isLoading ? '…' : `${orders.length} order${orders.length !== 1 ? 's' : ''}`}
            {statusFilter ? ` · ${STATUS_LABELS[statusFilter]}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className={`select text-sm ${statusFilter ? 'border-forest-500' : ''}`}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button onClick={() => setAddOpen(true)} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={15} /> New Order
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="h-5 bg-forest-100 rounded animate-pulse w-1/3 mb-2" />
              <div className="h-4 bg-forest-50 rounded animate-pulse w-1/2" />
            </div>
          ))
        ) : orders.length === 0 ? (
          <div className="card p-14 text-center">
            <Truck size={32} className="mx-auto text-forest-300 mb-3" />
            <p className="text-forest-500 font-medium">No vendor orders yet.</p>
            <p className="text-forest-400 text-sm mt-1">Create an order to track incoming plants and update COG by vendor.</p>
          </div>
        ) : orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            vendors={vendors}
            onEdit={setEditOrder}
            onMarkOrdered={(o) => markOrderedMutation.mutate(o.id)}
            onReceive={setReceiveTarget}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>

      {addOpen && (
        <Modal title="New Vendor Order" onClose={() => setAddOpen(false)} size="xl">
          <OrderForm vendors={vendors} onClose={() => setAddOpen(false)} />
        </Modal>
      )}

      {editOrder && (
        <Modal title={`Edit Order #${editOrder.order_number}`} onClose={() => setEditOrder(null)} size="xl">
          <OrderForm order={editOrder} vendors={vendors} onClose={() => setEditOrder(null)} />
        </Modal>
      )}

      {receiveTarget && (
        <ReceiveModal
          order={receiveTarget}
          isPending={receiveMutation.isPending}
          onConfirm={(data) => receiveMutation.mutate({ id: receiveTarget.id, data })}
          onCancel={() => setReceiveTarget(null)}
        />
      )}

      {deleteTarget && (
        <Confirm
          title="Delete Vendor Order"
          message={`Delete order #${deleteTarget.order_number} from ${deleteTarget.vendor?.name ?? 'vendor'}? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
