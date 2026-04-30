import { useState, useRef } from 'react';
import { importApi, skuApi } from '../../api/client';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw, Tag } from 'lucide-react';

export default function AdminImport() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef();

  const [skuLoading, setSkuLoading] = useState(false);
  const [skuResult, setSkuResult] = useState(null);
  const [skuError, setSkuError] = useState('');

  const handleRegenerateSkus = async () => {
    setSkuLoading(true); setSkuResult(null); setSkuError('');
    try {
      const res = await skuApi.regenerateAll();
      setSkuResult(res.data);
    } catch (err) {
      setSkuError(err.response?.data?.error || 'Failed to regenerate SKUs');
    } finally {
      setSkuLoading(false);
    }
  };

  const handleFile = (f) => {
    setFile(f); setResult(null); setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await importApi.upload(file);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-forest-900">Import Spreadsheet</h1>
        <p className="text-forest-500 text-sm mt-0.5">Upload an .xlsx, .xls, or .csv file to bulk-import plants</p>
      </div>

      <div className="card p-6 mb-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${file ? 'border-forest-400 bg-forest-50' : 'border-forest-200 hover:border-forest-400'}`}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
            <FileSpreadsheet size={36} className={`mx-auto mb-3 ${file ? 'text-forest-600' : 'text-forest-300'}`} />
            {file ? (
              <div>
                <p className="font-medium text-forest-800">{file.name}</p>
                <p className="text-forest-500 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-forest-600 font-medium">Drop a spreadsheet here or click to browse</p>
                <p className="text-forest-400 text-sm mt-1">.xlsx, .xls, or .csv &bull; Max 50MB</p>
              </div>
            )}
          </div>

          <div className="bg-forest-50 rounded-lg p-4 text-sm text-forest-600 space-y-1">
            <p className="font-medium text-forest-800 mb-2">Expected column headers (flexible matching):</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {['Common Name','Scientific Name','Size / Container','Qty / Stock','Price / Retail Price',
                'Sun Requirements','Moisture / Water','Bloom Time','Landscape Use','PNW Native',
                'Edible','Medicinal','Fire Resistant','More info (URL)'].map(h => (
                <span key={h} className="font-mono text-xs text-forest-500">{h}</span>
              ))}
            </div>
          </div>

          {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm"><AlertCircle size={16} />{error}</div>}

          <button type="submit" disabled={!file || loading} className="btn-primary w-full justify-center py-3">
            <Upload size={16} />
            {loading ? 'Importing…' : 'Import Plants'}
          </button>
        </form>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-semibold text-forest-800 mb-1">
              <Tag size={16} className="text-forest-500" />
              Regenerate SKUs
            </div>
            <p className="text-sm text-forest-500">
              Rebuilds every variant SKU from genus + species + size
              (e.g. <span className="font-mono">SIDNEL-1g</span>).
              Safe to re-run — vendor SKUs are updated automatically too.
            </p>
          </div>
          <button
            onClick={handleRegenerateSkus}
            disabled={skuLoading}
            className="btn-secondary shrink-0 flex items-center gap-2"
          >
            <RefreshCw size={14} className={skuLoading ? 'animate-spin' : ''} />
            {skuLoading ? 'Running…' : 'Run'}
          </button>
        </div>

        {skuError && (
          <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={15} /> {skuError}
          </div>
        )}

        {skuResult && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2 text-forest-700 text-sm font-medium">
              <CheckCircle size={15} className="text-forest-500" />
              {skuResult.updated} variant SKUs updated
              {skuResult.vendorSkusUpdated > 0 && (
                <span className="text-forest-400 font-normal">· {skuResult.vendorSkusUpdated} vendor SKUs updated</span>
              )}
            </div>

            {skuResult.conflicts?.length > 0 && (
              <div className="text-xs space-y-2">
                <p className="font-medium text-amber-700">
                  {skuResult.conflicts.length} SKU conflict{skuResult.conflicts.length !== 1 ? 's' : ''} skipped —
                  multiple variants resolve to the same SKU (likely duplicate imports).
                  Fix the underlying variants in the Plants page, then re-run.
                </p>
                {skuResult.conflicts.map((c, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-100 rounded px-3 py-2 space-y-1">
                    <div className="font-mono font-medium text-amber-800">{c.sku}</div>
                    {c.variants.map((v, j) => (
                      <div key={j} className="text-amber-700">
                        <span className="italic">{v.plant}</span> — <span className="font-mono">{v.container_size}</span>
                        {v.current_sku && <span className="text-amber-400 ml-1">(currently: {v.current_sku})</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {skuResult.errors?.length > 0 && (
              <div className="text-xs space-y-1">
                <p className="font-medium text-red-700">Errors:</p>
                {skuResult.errors.map((e, i) => (
                  <div key={i} className="text-red-600 bg-red-50 rounded px-3 py-1">{e.plant} ({e.size}): {e.error}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {result && (
        <div className="card p-6">
          <div className="flex items-center gap-2 text-forest-700 font-semibold mb-4">
            <CheckCircle size={18} className="text-forest-500" />
            Import Complete
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-forest-50 rounded-lg">
              <div className="text-2xl font-bold text-forest-700">{result.imported}</div>
              <div className="text-xs text-forest-500 mt-1">New Plants</div>
            </div>
            <div className="text-center p-4 bg-earth-50 rounded-lg">
              <div className="text-2xl font-bold text-earth-700">{result.updated}</div>
              <div className="text-xs text-earth-500 mt-1">Updated</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{result.errors?.length || 0}</div>
              <div className="text-xs text-red-500 mt-1">Errors</div>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="text-sm space-y-1">
              <p className="font-medium text-forest-800 mb-2">Row errors:</p>
              {result.errors.map((e, i) => (
                <div key={i} className="text-red-600 text-xs bg-red-50 rounded px-3 py-1.5">Row {e.row}: {e.error}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
