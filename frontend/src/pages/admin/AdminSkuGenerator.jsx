import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skuGenerator, vendors as vendorsApi } from '../../api/client';
import { Tags, Zap, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function AdminSkuGenerator() {
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState('');
  const [result, setResult] = useState(null);

  const { data: vendorList = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.list().then(r => r.data),
  });

  const { data: preview, isLoading: previewLoading, refetch } = useQuery({
    queryKey: ['sku-generator-preview', vendorId],
    queryFn: () => skuGenerator.preview(vendorId || null).then(r => r.data),
    staleTime: 0,
  });

  const generateMutation = useMutation({
    mutationFn: () => skuGenerator.generate(vendorId || null),
    onSuccess: (res) => {
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ['sku-generator-preview', vendorId] });
    },
  });

  const rows = preview?.rows || [];
  const toCreate = rows.filter(r => !r.exists);
  const alreadyExist = rows.filter(r => r.exists);

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Tags size={20} className="text-forest-600" />
          <h1 className="text-2xl font-serif font-semibold text-forest-900">SKU Generator</h1>
        </div>
        <p className="text-forest-500 text-sm">
          Auto-create plant variant SKUs from plant type defaults and tray/pot size codes.
        </p>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Vendor <span className="text-forest-400 font-normal">(optional — appends vendor code to SKU)</span></label>
            <select className="select" value={vendorId} onChange={e => { setVendorId(e.target.value); setResult(null); }}>
              <option value="">— No vendor suffix —</option>
              {vendorList.map(v => (
                <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ''}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setResult(null); refetch(); }}
            className="btn-secondary flex items-center gap-1.5"
            disabled={previewLoading}
          >
            <RefreshCw size={14} className={previewLoading ? 'animate-spin' : ''} />
            Refresh Preview
          </button>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={toCreate.length === 0 || generateMutation.isPending}
            className="btn-primary flex items-center gap-1.5"
          >
            <Zap size={14} />
            {generateMutation.isPending ? 'Generating…' : `Generate ${toCreate.length} SKU${toCreate.length !== 1 ? 's' : ''}`}
          </button>
        </div>

        {result && (
          <div className={`mt-4 flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm ${result.created > 0 ? 'bg-green-50 text-green-800' : 'bg-forest-50 text-forest-600'}`}>
            <CheckCircle size={16} className="flex-shrink-0" />
            <span>
              <strong>{result.created}</strong> SKU{result.created !== 1 ? 's' : ''} created,{' '}
              <strong>{result.skipped}</strong> already existed or skipped.
            </span>
          </div>
        )}
      </div>

      {previewLoading ? (
        <div className="card overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-forest-50">
              <div className="h-4 bg-forest-100 rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-12 text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-forest-200" />
          <p className="text-forest-500 font-medium">No SKUs to generate</p>
          <p className="text-forest-400 text-xs mt-1">
            Make sure plants have a type, type defaults are configured, and tray/pot sizes have SKU codes set.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-forest-50 border-b border-forest-100 flex items-center justify-between">
            <span className="text-sm font-medium text-forest-700">
              Preview — {toCreate.length} to create, {alreadyExist.length} already exist
            </span>
            {toCreate.length === 0 && (
              <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">All up to date</span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest-50/60 border-b border-forest-100 text-left">
                <th className="px-4 py-2.5 font-medium text-forest-600">Plant</th>
                <th className="px-4 py-2.5 font-medium text-forest-600">Type</th>
                <th className="px-4 py-2.5 font-medium text-forest-600">Size</th>
                <th className="px-4 py-2.5 font-medium text-forest-600">SKU</th>
                <th className="px-4 py-2.5 font-medium text-forest-600 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {rows.map((row, i) => (
                <tr key={i} className={row.exists ? 'opacity-50' : 'hover:bg-forest-50/40'}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-forest-900">{row.plant_name}</div>
                    {row.scientific_name && <div className="text-xs text-forest-400 italic">{row.scientific_name}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-forest-500 capitalize">{row.plant_type}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-forest-700">{row.container_size}</span>
                    <span className="ml-1.5 text-xs text-forest-400 capitalize">({row.category})</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs bg-forest-100 text-forest-800 px-2 py-0.5 rounded">{row.sku}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.exists
                      ? <span className="text-xs text-forest-400">exists</span>
                      : <span className="text-xs text-green-700 font-medium">new</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
