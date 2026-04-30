import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pricing, vendorSkus as vendorSkusApi } from '../../api/client';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { SortHeader, MultiSortBar } from '../../components/ui/SortControls';
import { useMultiSort, applyMultiSort } from '../../hooks/useMultiSort';
import { Pencil, ChevronRight, ChevronDown, Store, Search } from 'lucide-react';

const PRICING_SORT_COLS = [
  { value: 'plant',           label: 'Plant' },
  { value: 'size',            label: 'Size' },
  { value: 'retail_price',    label: 'Retail' },
  { value: 'wholesale_price', label: 'Wholesale' },
  { value: 'cost',            label: 'COG' },
];

function pricingGetVal(item, col) {
  switch (col) {
    case 'plant':           return (item.variant?.plant?.common_name || item.variant?.plant?.scientific_name || '').toLowerCase();
    case 'size':            return (item.variant?.container_size || '').toLowerCase();
    case 'retail_price':    return item.retail_price ?? 0;
    case 'wholesale_price': return item.wholesale_price ?? 0;
    case 'cost':            return item.cost ?? 0;
    default:                return '';
  }
}

function fmt(v) { return v != null && v !== '' ? `$${parseFloat(v).toFixed(2)}` : '—'; }

// Inline editable dollar cell — click to edit, blur/enter to save
function InlinePrice({ value, onSave, textClass = 'text-earth-700 font-medium', title = 'Click to edit' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  const start = () => {
    setVal(value != null ? parseFloat(value).toFixed(2) : '');
    setEditing(true);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    const parsed = val === '' ? null : parseFloat(val);
    if (parsed !== (value == null ? null : parseFloat(value))) {
      setSaving(true);
      await onSave(parsed);
      setSaving(false);
    }
    setEditing(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <div className="relative inline-flex items-center">
        <span className="absolute left-2 text-forest-400 text-xs">$</span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="input text-right text-sm pl-5 pr-2 py-0.5 w-24"
        />
      </div>
    );
  }

  return (
    <button
      onClick={start}
      disabled={saving}
      className={`text-right text-sm transition-colors hover:text-forest-900 hover:bg-forest-50 rounded px-1.5 py-0.5 ${textClass} ${saving ? 'animate-pulse' : ''}`}
      title={title}
    >
      {saving ? '…' : fmt(value)}
    </button>
  );
}

function VendorSkuRows({ vendorSkuList }) {
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, cost }) => vendorSkusApi.update(id, { cost }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });

  return (
    <>
      {vendorSkuList.map(vs => (
        <tr key={vs.id} className="bg-forest-50/40 border-b border-forest-50">
          <td className="pl-10 pr-4 py-2" colSpan={2}>
            <div className="flex items-center gap-2 text-xs text-forest-600">
              <Store size={11} className="text-forest-400 shrink-0" />
              <span className="font-medium">{vs.vendor_name}</span>
              <span className="font-mono text-forest-400 bg-white border border-forest-100 px-1.5 py-0.5 rounded">
                {vs.sku || vs.vendor_code}
              </span>
            </div>
          </td>
          <td className="px-4 py-2 text-right hidden sm:table-cell" />
          <td className="px-4 py-2 text-right hidden md:table-cell" />
          <td className="px-4 py-2 text-right hidden lg:table-cell" />
          <td className="px-4 py-2 text-right hidden xl:table-cell" />
          <td className="px-4 py-2 text-right">
            <InlinePrice
              value={vs.cost}
              onSave={(cost) => updateMutation.mutateAsync({ id: vs.id, cost })}
              title="Click to edit vendor COG"
            />
          </td>
          <td className="px-4 py-2" />
        </tr>
      ))}
    </>
  );
}

function PricingRow({ item, onEdit }) {
  const qc = useQueryClient();
  const vendorSkus = item.variant?.vendor_skus ?? [];
  const [expanded, setExpanded] = useState(false);

  const save = (field) => (value) =>
    pricing.update(item.variant_id, { [field]: value })
      .then(() => qc.invalidateQueries({ queryKey: ['pricing'] }));

  return (
    <>
      <tr className="hover:bg-forest-50/60 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {vendorSkus.length > 0 && (
              <button
                onClick={() => setExpanded(o => !o)}
                className="text-forest-400 hover:text-forest-700 transition-colors p-0.5 rounded"
                title={`${vendorSkus.length} vendor${vendorSkus.length !== 1 ? 's' : ''}`}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            {vendorSkus.length === 0 && <span className="w-5 inline-block" />}
            <div>
              <div className="font-medium text-forest-900">{item.variant?.plant?.common_name}</div>
              {item.variant?.plant?.scientific_name !== item.variant?.plant?.common_name && (
                <div className="text-xs text-forest-400 italic">{item.variant?.plant?.scientific_name}</div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-forest-500 hidden sm:table-cell">
          <div className="flex items-center gap-1.5">
            <span>{item.variant?.container_size}</span>
            {item.variant?.sku && (
              <span className="font-mono text-xs text-forest-300">{item.variant.sku}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <InlinePrice value={item.retail_price} onSave={save('retail_price')}
            textClass="font-medium text-forest-900" title="Click to edit retail price" />
        </td>
        <td className="px-4 py-3 text-right hidden md:table-cell">
          <InlinePrice value={item.sale_price} onSave={save('sale_price')}
            textClass="text-earth-600" title="Click to edit sale price" />
        </td>
        <td className="px-4 py-3 text-right hidden lg:table-cell">
          <InlinePrice value={item.wholesale_price} onSave={save('wholesale_price')}
            textClass="text-forest-500" title="Click to edit wholesale price" />
        </td>
        <td className="px-4 py-3 text-right hidden xl:table-cell">{fmt(item.preorder_price)}</td>
        <td className="px-4 py-3 text-right">
          <InlinePrice value={item.cost} onSave={save('cost')}
            title="Click to edit COG" />
        </td>
        <td className="px-4 py-3 text-right">
          <button onClick={() => onEdit(item)} className="btn-ghost px-2 py-1.5" title="Edit all pricing">
            <Pencil size={14} />
          </button>
        </td>
      </tr>
      {expanded && vendorSkus.length > 0 && (
        <VendorSkuRows vendorSkuList={vendorSkus} />
      )}
    </>
  );
}

function PriceForm({ item, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    retail_price:   item.retail_price  ?? '',
    sale_price:     item.sale_price    ?? '',
    wholesale_price:item.wholesale_price ?? '',
    preorder_price: item.preorder_price ?? '',
    cost:           item.cost          ?? '',
    sale_starts_at: item.sale_starts_at?.split('T')[0] ?? '',
    sale_ends_at:   item.sale_ends_at?.split('T')[0]   ?? '',
    sync_shopify: false,
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d) => pricing.update(item.variant_id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricing'] }); onClose(); },
    onError: (e) => setError(e.response?.data?.error || 'Failed'),
  });

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    ['retail_price','sale_price','wholesale_price','preorder_price','cost'].forEach(k => {
      payload[k] = payload[k] !== '' ? parseFloat(payload[k]) : null;
    });
    ['sale_starts_at','sale_ends_at'].forEach(k => { if (!payload[k]) payload[k] = null; });
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-forest-50 rounded-lg p-3 text-sm">
        <div className="font-medium">{item.variant?.plant?.common_name}</div>
        <div className="text-forest-500">{item.variant?.container_size}</div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          ['retail_price',    'Retail Price *'],
          ['sale_price',      'Sale Price'],
          ['wholesale_price', 'Wholesale'],
          ['preorder_price',  'Pre-order Price'],
          ['cost',            'Our Cost (COG)'],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="label">{label}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400 text-sm">$</span>
              <input className="input pl-7" type="number" step="0.01" min="0"
                value={form[k]} onChange={e => set(k, e.target.value)}
                required={k === 'retail_price'} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Sale Starts</label><input className="input" type="date" value={form.sale_starts_at} onChange={e => set('sale_starts_at', e.target.value)} /></div>
        <div><label className="label">Sale Ends</label><input className="input" type="date" value={form.sale_ends_at} onChange={e => set('sale_ends_at', e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={form.sync_shopify} onChange={e => set('sync_shopify', e.target.checked)}
          className="w-4 h-4 rounded border-forest-300 text-forest-600 focus:ring-forest-500" />
        <span className="text-forest-700">Sync to Shopify</span>
      </label>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">Save Pricing</button>
      </div>
    </form>
  );
}

export default function AdminPricing() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState(null);
  const { sortCol, sortDir, sort2Col, setSort2Col, sort2Dir, setSort2Dir, handleSort } = useMultiSort('plant');

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

  const { data, isLoading } = useQuery({
    queryKey: ['pricing', page, search],
    queryFn: () => pricing.list({ page, limit: 50, search: search || undefined }).then(r => r.data),
    keepPreviousData: true,
    staleTime: 60_000,
  });

  const sortedPricing = useMemo(
    () => applyMultiSort(data?.pricing ?? [], sortCol, sortDir, sort2Col, sort2Dir, pricingGetVal),
    [data?.pricing, sortCol, sortDir, sort2Col, sort2Dir],
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-forest-900">Pricing</h1>
        <p className="text-forest-500 text-sm mt-0.5">
          {data?.total ?? '…'} variants — click any <span className="text-earth-700 font-medium">COG</span> value to edit inline, or use the pencil to edit all fields
        </p>
      </div>

      <div className="card p-4 mb-5 flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
          <input
            className="input pl-9"
            placeholder="Search by plant name, scientific name, or SKU…"
            value={search}
            onChange={handleSearch}
          />
        </div>
        <MultiSortBar
          columns={PRICING_SORT_COLS}
          sortCol={sortCol}
          sort2Col={sort2Col}
          setSort2Col={setSort2Col}
          sort2Dir={sort2Dir}
          setSort2Dir={setSort2Dir}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50 border-b border-forest-100 text-left">
                <SortHeader label="Plant" col="plant" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Size" col="size" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                <SortHeader label="Retail" col="retail_price" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <th className="px-4 py-3 font-medium text-forest-600 text-right hidden md:table-cell">Sale</th>
                <SortHeader label="Wholesale" col="wholesale_price" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right hidden lg:table-cell" />
                <th className="px-4 py-3 font-medium text-forest-600 text-right hidden xl:table-cell">Pre-order</th>
                <SortHeader label="COG" col="cost" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right text-earth-600" />
                <th className="px-4 py-3 font-medium text-forest-600 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-3">
                        <div className="h-4 bg-forest-100 rounded animate-pulse w-3/4" />
                      </td>
                    </tr>
                  ))
                : sortedPricing.map(item => (
                    <PricingRow key={item.id} item={item} onEdit={setEditItem} />
                  ))
              }
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 py-3 border-t border-forest-100">
            <Pagination page={page} total={data.total} limit={50} onPage={setPage} />
          </div>
        )}
      </div>

      {editItem && (
        <Modal title="Edit Pricing" onClose={() => setEditItem(null)} size="sm">
          <PriceForm item={editItem} onClose={() => setEditItem(null)} />
        </Modal>
      )}
    </div>
  );
}
