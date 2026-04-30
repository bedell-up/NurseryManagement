import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { barcodeSheet, locations as locationsApi } from '../../api/client';
import { Printer, Loader2, AlertCircle, MapPin, RefreshCw } from 'lucide-react';
import JsBarcode from 'jsbarcode';

// ── Helpers ─────────────────────────────────────────────────────────────────

const SUN_LABELS = {
  full_sun:          'Full Sun',
  part_shade:        'Part Shade',
  full_shade:        'Full Shade',
  sun_to_part_shade: 'Sun / Part Shade',
};
const WATER_LABELS = {
  dry:            'Dry',
  medium:         'Medium',
  wet:            'Wet',
  wet_to_medium:  'Wet–Medium',
  dry_to_medium:  'Dry–Medium',
};
const TYPE_LABELS = {
  tree:        'Tree',
  shrub:       'Shrub',
  perennial:   'Perennial',
  annual:      'Annual',
  graminoid:           'Graminoid',
  fern:                'Fern',
  vine:                'Vine',
  groundcover:         'Groundcover',
  bulb:                'Bulb',
  aquatic:             'Aquatic',
  perennial_vegetable: 'Perennial Vegetable',
  other:               'Other',
};

// ── Single barcode card ──────────────────────────────────────────────────────

function BarcodeCard({ item }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !item.variant.barcode) return;
    try {
      JsBarcode(svgRef.current, item.variant.barcode, {
        format:      'CODE128',
        width:       1.4,
        height:      36,
        displayValue: false,
        margin:      0,
      });
    } catch (_) {}
  }, [item.variant.barcode]);

  const plant = item.plant;
  const variant = item.variant;
  const details = [
    TYPE_LABELS[plant.plant_type],
    SUN_LABELS[plant.sun_requirements],
    WATER_LABELS[plant.water_requirements],
    plant.native_region,
  ].filter(Boolean);

  return (
    <div className="barcode-card">
      {/* Plant name */}
      <div className="card-header">
        {plant.scientific_name && (
          <p className="plant-name">{plant.scientific_name}</p>
        )}
        <p className="sci-name" style={{ fontStyle: 'normal', color: '#376e3a' }}>{plant.common_name}</p>
      </div>

      {/* Details row */}
      {details.length > 0 && (
        <p className="card-details">{details.join(' · ')}</p>
      )}

      {/* Container size */}
      {variant.container_size && (
        <p className="container-size">{variant.container_size}</p>
      )}

      {/* Barcode */}
      <div className="barcode-wrap">
        {item.variant.barcode ? (
          <svg ref={svgRef} />
        ) : (
          <p className="no-barcode">No barcode</p>
        )}
      </div>

      {/* SKU */}
      <p className="sku-label">{variant.sku || '—'}</p>

      {/* Location hint */}
      {item.location && (
        <p className="location-label">{item.location}</p>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminBarcodeSheets() {
  const [location, setLocation] = useState('');
  const [submitted, setSubmitted] = useState('');   // what we actually fetched

  // Locations for the dropdown
  const { data: locData = [] } = useQuery({
    queryKey: ['locations-all'],
    queryFn: () => locationsApi.list().then(r => r.data),
  });
  const locationOptions = (locData?.locations ?? locData).filter(l => l.is_active !== false);

  // Barcode sheet data
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['barcode-sheet', submitted],
    queryFn: () => barcodeSheet.get(submitted || undefined).then(r => r.data),
    enabled: true,
    staleTime: 0,
  });

  const handleGenerate = (e) => {
    e.preventDefault();
    setSubmitted(location);
  };

  const items = data?.items ?? [];
  const sheetTitle = submitted
    ? `Location: ${submitted}`
    : 'All Locations';

  return (
    <>
      {/* ── Print styles injected into <head> ─────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #barcode-print-area,
          #barcode-print-area * { visibility: visible; }
          #barcode-print-area {
            position: fixed;
            inset: 0;
            padding: 0.5in;
          }
          .print-title { margin-bottom: 0.25in; }
        }

        /* Card grid */
        .barcode-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media print {
          .barcode-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
        }

        /* Individual card */
        .barcode-card {
          border: 1px solid #c2dbc3;
          border-radius: 8px;
          padding: 10px 12px 8px;
          background: white;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .card-header { margin-bottom: 4px; }
        .plant-name {
          font-size: 13px;
          font-weight: 700;
          color: #1f3a22;
          line-height: 1.2;
          margin: 0;
        }
        .sci-name {
          font-size: 10px;
          font-style: italic;
          color: #4a8a4d;
          margin: 1px 0 0;
        }
        .card-details {
          font-size: 9px;
          color: #669e69;
          margin: 3px 0 2px;
          line-height: 1.3;
        }
        .container-size {
          font-size: 10px;
          font-weight: 600;
          color: #376e3a;
          margin: 2px 0 4px;
        }
        .barcode-wrap {
          text-align: center;
          margin: 4px 0 2px;
        }
        .barcode-wrap svg {
          max-width: 100%;
          height: auto;
        }
        .no-barcode {
          font-size: 9px;
          color: #97c099;
          text-align: center;
          margin: 0;
        }
        .sku-label {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: #264628;
          text-align: center;
          margin: 2px 0 0;
          letter-spacing: 0.5px;
        }
        .location-label {
          font-size: 8px;
          color: #97c099;
          text-align: right;
          margin: 2px 0 0;
        }
      `}</style>

      {/* ── Screen UI ──────────────────────────────────────────────────── */}
      <div className="p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Barcode Sheets</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            Print a master inventory reference sheet with barcodes by location.
          </p>
        </div>

        {/* Controls */}
        <form onSubmit={handleGenerate} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="label flex items-center gap-1.5">
              <MapPin size={13} className="text-forest-500" />
              Location
            </label>
            <select
              className="select"
              value={location}
              onChange={e => setLocation(e.target.value)}
            >
              <option value="">— All locations —</option>
              {locationOptions.map(l => (
                <option key={l.id} value={l.name}>{l.name}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary" disabled={isFetching}>
            {isFetching
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : <><RefreshCw size={14} /> Generate Sheet</>
            }
          </button>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary"
            >
              <Printer size={14} /> Print
            </button>
          )}
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <AlertCircle size={15} />
            <span className="text-sm">{error.message || 'Failed to load inventory'}</span>
          </div>
        )}

        {/* Count summary */}
        {!isFetching && items.length > 0 && (
          <p className="text-forest-500 text-sm mb-4">
            <span className="font-medium text-forest-700">{items.length}</span> items
            {submitted ? ` at ${submitted}` : ' across all locations'}
            {' · '}
            {Math.ceil(items.length / 15)} page{items.length > 15 ? 's' : ''} (15 per page)
          </p>
        )}
        {!isFetching && data && items.length === 0 && (
          <p className="text-forest-400 text-sm">No active inventory found{submitted ? ` at "${submitted}"` : ''}.</p>
        )}

        {/* ── Printable area ─────────────────────────────────────────── */}
        {items.length > 0 && (
          <div id="barcode-print-area">
            {/* Print header */}
            <div className="print-title mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-semibold text-forest-900">
                  Bloomsday Natives — Inventory Reference
                </h2>
                <p className="text-forest-500 text-sm">
                  {sheetTitle} · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <p className="text-forest-400 text-xs font-mono">{items.length} items</p>
            </div>

            {/* Card grid */}
            <div className="barcode-grid">
              {items.map(item => (
                <BarcodeCard key={item.inventory_id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
