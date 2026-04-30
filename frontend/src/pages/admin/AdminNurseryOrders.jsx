import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nurseryOrders as ordersApi, plants as plantsApi, locations as locationsApi } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Confirm from '../../components/ui/Confirm';
import PlantSearchSelect from '../../components/admin/PlantSearchSelect';
import { Plus, Pencil, Trash2, CheckCircle, XCircle, ChevronRight, ChevronDown, ShoppingBag } from 'lucide-react';

const STATUS_COLORS = {
  draft:     'bg-forest-100 text-forest-600',
  confirmed: 'bg-amber-100 text-amber-800',
  fulfilled: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUS_LABELS = { draft: 'Draft', confirmed: 'Confirmed', fulfilled: 'Fulfilled', cancelled: 'Cancelled' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Order Form ───────────────────────────────────────────────────────────────

const EMPTY_ITEM = () => ({ plant_id: '', variant_id: '', quantity: '1', location: '', unit_price: '' });

function OrderForm({ order, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!order?.id;

  const [customerName,  setCustomerName]  = useState(order?.customer_name  || '');
  const [customerEmail, setCustomerEmail] = useState(order?.customer_email || '');
  const [customerPhone, setCustomerPhone] = useState(order?.customer_phone || '');
  const [notes,         setNotes]         = useState(order?.notes          || '');
  const [items,         setItems]         = useState(
    order?.items?.length
      ? order.items.map(i => ({
          plant_id:   i.variant?.plant?.id || '',
          variant_id: i.variant_id,
          quantity:   String(i.quantity),
          location:   i.location || '',
          unit_price: i.unit_price ?? '',
        }))
      : [EMPTY_ITEM()]
  );
  const [error, setError] = useState('');

  const { data: plantsData } = useQuery({
    queryKey: ['nursery-order-plants'],
    queryFn: () => plantsApi.list({ limit: 9999 }).then(r => r.data),
    staleTime: 60_000,
  });
  const allPlants = useMemo(() =>
    (plantsData?.plants ?? []).slice().sort((a, b) =>
      (a.scientific_name || a.common_name).localeCompare(b.scientific_name || b.common_name)
    ),
    [plantsData]
  );
  const plantsById = useMemo(() =>
    Object.fromEntries(allPlants.map(p => [p.id, p])),
    [allPlants]
  );

  const { data: locationsData } = useQuery({
    queryKey: ['locations-all'],
    queryFn: () => locationsApi.list().then(r => r.data),
    staleTime: 60_000,
  });
  const locationOptions = (locationsData?.locations ?? locationsData ?? []).filter(l => l.is_active !== false);

  const setItem = (i, field, val) =>
    setItems(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const addItem = () => setItems(prev => [...prev, EMPTY_ITEM()]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handlePlantChange = (i, plantId, plant) => {
    setItems(prev => prev.map((r, idx) => idx === i
      ? { ...r, plant_id: plantId, variant_id: '', unit_price: '' }
      : r
    ));
  };

  const handleVariantChange = (i, variantId) => {
    const plantId = items[i]?.plant_id;
    const plant   = plantsById[plantId];
    const variant = (plant?.variants ?? []).find(v => v.id === variantId);
    const price   = variant?.pricing?.retail_price;
    setItems(prev => prev.map((r, idx) => idx === i
      ? { ...r, variant_id: variantId, unit_price: price ? String(price) : '' }
      : r
    ));
  };

  const orderTotal = items.reduce((sum, item) => {
    const qty   = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? ordersApi.update(order.id, data) : ordersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nursery-orders'] });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.error || 'Save failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const validItems = items.filter(i => i.variant_id && parseInt(i.quantity, 10) > 0);
    if (!validItems.length) return setError('Add at least one item with a plant and quantity');
    mutation.mutate({
      customer_name:  customerName  || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      notes:          notes         || null,
      items: validItems.map(i => ({
        variant_id: i.variant_id,
        quantity:   parseInt(i.quantity, 10),
        location:   i.location || null,
        unit_price: i.unit_price !== '' ? parseFloat(i.unit_price) : null,
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Customer info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Customer Name</label>
          <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in / name" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="optional" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="optional" />
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Order Items *</label>
          {orderTotal > 0 && (
            <span className="text-sm font-medium text-forest-700">Total: ${orderTotal.toFixed(2)}</span>
          )}
        </div>

        <div className="space-y-3">
          {items.map((item, i) => {
            const itemPlant    = plantsById[item.plant_id];
            const itemVariants = (itemPlant?.variants ?? []).filter(v => v.is_active !== false);
            return (
            <div key={i} className="grid grid-cols-[1fr_1fr_80px_120px_100px_32px] gap-2 items-start">
              {/* Plant search */}
              <div>
                {i === 0 && <div className="text-xs font-medium text-forest-500 mb-1">Plant</div>}
                <PlantSearchSelect
                  plants={allPlants}
                  value={item.plant_id}
                  onChange={(plantId, plant) => handlePlantChange(i, plantId, plant)}
                  placeholder="Search plant…"
                />
              </div>

              {/* Size / variant */}
              <div>
                {i === 0 && <div className="text-xs font-medium text-forest-500 mb-1">Size</div>}
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
              </div>

              {/* Qty */}
              <div>
                {i === 0 && <div className="text-xs font-medium text-forest-500 mb-1">Qty</div>}
                <input
                  className="input text-sm text-center"
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => setItem(i, 'quantity', e.target.value)}
                  placeholder="1"
                />
              </div>

              {/* Location */}
              <div>
                {i === 0 && <div className="text-xs font-medium text-forest-500 mb-1">Location</div>}
                <select
                  className="select text-sm"
                  value={item.location}
                  onChange={e => setItem(i, 'location', e.target.value)}
                >
                  <option value="">— any —</option>
                  {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </div>

              {/* Unit price */}
              <div>
                {i === 0 && <div className="text-xs font-medium text-forest-500 mb-1">Unit Price</div>}
                <input
                  className="input text-sm"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={e => setItem(i, 'unit_price', e.target.value)}
                  placeholder="$0.00"
                />
              </div>

              <div className={i === 0 ? 'mt-5' : ''}>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  className="flex items-center justify-center w-8 h-8 rounded text-forest-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            );
          })}
        </div>

        <button type="button" onClick={addItem} className="mt-2 flex items-center gap-1 text-sm text-forest-500 hover:text-forest-700">
          <Plus size={14} /> Add item
        </button>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Pickup time, special instructions…" />
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

function OrderCard({ order, onEdit, onFulfill, onCancel, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const isFulfillable = order.status === 'draft' || order.status === 'confirmed';
  const itemCount = order.items?.length ?? 0;
  const orderTotal = (order.items ?? []).reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * (i.quantity || 0), 0);

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-forest-50/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown size={15} className="text-forest-400 flex-shrink-0" /> : <ChevronRight size={15} className="text-forest-400 flex-shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-forest-900">Order #{order.order_number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
              {order.customer_name && (
                <span className="text-sm text-forest-600">{order.customer_name}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-forest-400 flex-wrap">
              <span>{fmtDate(order.createdAt)}</span>
              <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
              {orderTotal > 0 && <span>${orderTotal.toFixed(2)}</span>}
              {order.customer_phone && <span>{order.customer_phone}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {isFulfillable && (
            <button
              onClick={() => onFulfill(order)}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
              title="Fulfill order — deducts inventory"
            >
              <CheckCircle size={13} /> Fulfill
            </button>
          )}
          {isFulfillable && (
            <button onClick={() => onEdit(order)} className="btn-ghost px-2 py-1.5 text-forest-500 hover:text-forest-800" title="Edit">
              <Pencil size={14} />
            </button>
          )}
          {order.status !== 'fulfilled' && (
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
                <th className="px-4 py-2.5 text-center font-medium text-forest-600">Qty</th>
                <th className="px-4 py-2.5 font-medium text-forest-600 hidden sm:table-cell">Location</th>
                <th className="px-4 py-2.5 text-right font-medium text-forest-600">Unit Price</th>
                <th className="px-4 py-2.5 text-right font-medium text-forest-600">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {(order.items ?? []).map(item => {
                const plant   = item.variant?.plant;
                const lineTotal = (parseFloat(item.unit_price) || 0) * item.quantity;
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
                    <td className="px-4 py-2.5 text-center font-semibold text-forest-900">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-xs text-forest-500 hidden sm:table-cell">{item.location || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-forest-600">
                      {item.unit_price ? `$${parseFloat(item.unit_price).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium text-forest-800">
                      {lineTotal > 0 ? `$${lineTotal.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {orderTotal > 0 && (
              <tfoot>
                <tr className="border-t border-forest-200 bg-forest-50">
                  <td colSpan={5} className="px-5 py-2.5 text-right text-sm font-medium text-forest-700">Order Total</td>
                  <td className="px-4 py-2.5 text-right font-bold text-forest-900">${orderTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {order.status === 'fulfilled' && order.fulfilled_at && (
            <div className="px-5 py-2.5 text-xs text-forest-400 border-t border-forest-100">
              Fulfilled {fmtDate(order.fulfilled_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminNurseryOrders() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [editOrder,    setEditOrder]    = useState(null);
  const [addOpen,      setAddOpen]      = useState(false);
  const [fulfillTarget, setFulfillTarget] = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['nursery-orders', statusFilter],
    queryFn:  () => ordersApi.list(statusFilter ? { status: statusFilter } : {}).then(r => r.data),
    staleTime: 30_000,
  });
  const orders = data?.orders ?? [];

  const fulfillMutation = useMutation({
    mutationFn: (id) => ordersApi.fulfill(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['nursery-orders'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setFulfillTarget(null);
    },
    onError: (e) => alert(e.response?.data?.error || 'Fulfill failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => ordersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nursery-orders'] }); setDeleteTarget(null); },
  });

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Nursery Orders</h1>
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
            <ShoppingBag size={32} className="mx-auto text-forest-300 mb-3" />
            <p className="text-forest-500 font-medium">No orders yet.</p>
            <p className="text-forest-400 text-sm mt-1">Click "New Order" to record an in-person or phone sale.</p>
          </div>
        ) : orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onEdit={setEditOrder}
            onFulfill={setFulfillTarget}
            onCancel={() => {}}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>

      {addOpen && (
        <Modal title="New Nursery Order" onClose={() => setAddOpen(false)} size="lg">
          <OrderForm onClose={() => setAddOpen(false)} />
        </Modal>
      )}

      {editOrder && (
        <Modal title={`Edit Order #${editOrder.order_number}`} onClose={() => setEditOrder(null)} size="lg">
          <OrderForm order={editOrder} onClose={() => setEditOrder(null)} />
        </Modal>
      )}

      {fulfillTarget && (
        <Confirm
          title={`Fulfill Order #${fulfillTarget.order_number}?`}
          message={`This will deduct ${fulfillTarget.items?.length ?? 0} line item${fulfillTarget.items?.length !== 1 ? 's' : ''} from inventory. This cannot be undone.${fulfillTarget.customer_name ? ` Customer: ${fulfillTarget.customer_name}.` : ''}`}
          confirmLabel="Fulfill Order"
          onConfirm={() => fulfillMutation.mutate(fulfillTarget.id)}
          onCancel={() => setFulfillTarget(null)}
        />
      )}

      {deleteTarget && (
        <Confirm
          title="Delete Order"
          message={`Delete order #${deleteTarget.order_number}? This will not restore any inventory.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
