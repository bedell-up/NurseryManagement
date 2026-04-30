import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { plants as plantsApi, inventory, pricing } from '../../api/client';
import Pagination from '../../components/ui/Pagination';
import { Search, Filter, X, Leaf, FileDown } from 'lucide-react';
import { generateWholesalePdf } from '../../utils/wholesalePdf';

const TYPES = ['tree','shrub','perennial','annual','graminoid','fern','vine','groundcover','bulb','aquatic','perennial_vegetable','other'];
const TYPE_LABELS = {
  tree:'Tree', shrub:'Shrub', perennial:'Perennial', annual:'Annual',
  graminoid:'Graminoid', fern:'Fern', vine:'Vine', groundcover:'Groundcover',
  bulb:'Bulb', aquatic:'Aquatic', perennial_vegetable:'Perennial Vegetable', other:'Other',
};
const SUN   = [['full_sun','Full Sun'],['part_shade','Part Shade'],['partial_shade_to_shade','Partial Shade to Shade'],['full_shade','Full Shade'],['sun_to_part_shade','Sun–Part Shade']];
const WATER = [['dry','Dry'],['medium','Medium'],['wet','Wet'],['wet_to_medium','Wet–Medium'],['dry_to_medium','Dry–Medium']];

function getAvailability(variants, invByVariant) {
  if (!variants?.length) return null;
  let totalAvailable = 0;
  let anyIncoming = 0;
  let anyLabel = null;

  for (const v of variants) {
    const inv = invByVariant[v.id];
    if (!inv) continue;
    const onHand   = Number(inv.quantity_on_hand  || 0);
    const reserved = Number(inv.quantity_reserved || 0);
    const incoming = Number(inv.quantity_incoming || 0);
    const available = onHand - reserved;
    totalAvailable += available;
    anyIncoming    += incoming;
    if (!anyLabel && inv.availability_label?.trim()) anyLabel = inv.availability_label.trim();
  }

  if (totalAvailable > 0) return { text: `In Stock`, status: 'in_stock' };
  if (anyLabel)           return { text: anyLabel,    status: 'custom' };
  if (anyIncoming > 0)    return { text: 'Incoming',  status: 'incoming' };
  return { text: 'Unavailable', status: 'unavailable' };
}

function getLowestRetailPrice(variants, priceByVariant) {
  let lowest = null;
  for (const v of variants ?? []) {
    const p = priceByVariant[v.id];
    if (!p) continue;
    const price = p.sale_price && isActiveSale(p) ? Number(p.sale_price) : Number(p.retail_price || 0);
    if (price > 0 && (lowest === null || price < lowest)) lowest = price;
  }
  return lowest;
}

function isActiveSale(p) {
  if (!p.sale_price) return false;
  const now = Date.now();
  const start = p.sale_starts_at ? new Date(p.sale_starts_at).getTime() : 0;
  const end   = p.sale_ends_at   ? new Date(p.sale_ends_at).getTime()   : Infinity;
  return now >= start && now <= end;
}

/** Deduplicate plants by common_name (case-insensitive), merging variants and boolean attrs. */
function deduplicatePlants(plantList) {
  const seen = new Map();
  const ordered = [];
  for (const plant of plantList) {
    const key = (plant.common_name ?? '').toLowerCase().trim();
    if (!key) { ordered.push(plant); continue; }
    if (!seen.has(key)) {
      seen.set(key, { ...plant, variants: [...(plant.variants ?? [])] });
      ordered.push(seen.get(key));
    } else {
      const primary = seen.get(key);
      // Merge variants
      const existingIds = new Set((primary.variants ?? []).map(v => v.id));
      for (const v of plant.variants ?? []) {
        if (!existingIds.has(v.id)) primary.variants.push(v);
      }
      // Merge boolean attributes (union)
      for (const attr of ['attracts_pollinators','attracts_birds','attracts_butterflies','is_edible','is_fire_resistant','deer_resistant','is_medicinal','is_pet_friendly','portland_plant_list']) {
        primary[attr] = primary[attr] || plant[attr];
      }
      // Fill in missing text/image from duplicate
      for (const field of ['image_url','description','notes','landscape_use','native_region']) {
        if (!primary[field] && plant[field]) primary[field] = plant[field];
      }
    }
  }
  return ordered;
}

function PlantCard({ plant, invByVariant, priceByVariant }) {
  const typeColors = { tree:'badge-green', shrub:'badge-green', perennial:'badge-blue', annual:'badge-earth', graminoid:'badge-gray', fern:'badge-green', vine:'badge-earth', aquatic:'badge-blue', perennial_vegetable:'badge-earth', other:'badge-gray' };
  const availability = getAvailability(plant.variants, invByVariant);
  const lowestPrice  = getLowestRetailPrice(plant.variants, priceByVariant);

  const availClass = {
    in_stock:    'text-green-700 bg-green-50 border border-green-200',
    custom:      'text-sky-700 bg-sky-50 border border-sky-200',
    incoming:    'text-amber-700 bg-amber-50 border border-amber-200',
    unavailable: 'text-forest-400 bg-forest-50 border border-forest-100',
  }[availability?.status] ?? '';

  return (
    <Link to={`/plant/${plant.id}`} className="card p-5 hover:shadow-md hover:border-forest-200 transition-all group block">
      {plant.image_url && (
        <div className="h-40 rounded-lg overflow-hidden mb-4 -mx-5 -mt-5">
          <img src={plant.image_url} alt={plant.common_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-forest-900 leading-snug group-hover:text-forest-600 transition-colors">{plant.common_name}</h3>
        {plant.plant_type && <span className={`${typeColors[plant.plant_type] || 'badge-gray'} flex-shrink-0 text-xs`}>{TYPE_LABELS[plant.plant_type] || plant.plant_type}</span>}
      </div>
      <p className="text-forest-500 text-xs italic mb-3">{plant.scientific_name}</p>
      {plant.landscape_use && <p className="text-forest-600 text-xs mb-3 line-clamp-2">{plant.landscape_use}</p>}

      {/* Pricing & availability */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {lowestPrice !== null
          ? <span className="text-forest-800 text-sm font-semibold">From ${lowestPrice.toFixed(2)}</span>
          : <span />}
        {availability && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${availClass}`}>
            {availability.text}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mt-auto">
        {plant.attracts_pollinators && <span className="badge-green text-xs">🐝</span>}
        {plant.attracts_birds       && <span className="badge-blue  text-xs">🐦</span>}
        {plant.attracts_butterflies && <span className="badge-green text-xs">🦋</span>}
        {plant.is_edible            && <span className="badge-earth text-xs">🌿 Edible</span>}
        {plant.is_fire_resistant    && <span className="badge-red   text-xs">🔥</span>}
        {plant.native_region        && <span className="badge-gray  text-xs">PNW</span>}
      </div>
    </Link>
  );
}

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [type, setType] = useState(params.get('type') || '');
  const [sun, setSun] = useState('');
  const [water, setWater] = useState('');
  const [pollinators, setPollinators] = useState(false);
  const [birds, setBirds] = useState(false);
  const [edible, setEdible] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['plants','catalog', page, search, type, sun, water, pollinators, birds, edible],
    queryFn: () => plantsApi.list({
      page, limit: 24, search: search || undefined, type: type || undefined,
      sun: sun || undefined, water: water || undefined,
      pollinators: pollinators || undefined, birds: birds || undefined,
      edible: edible || undefined,
    }).then(r => r.data),
    keepPreviousData: true,
  });

  // Fetch all inventory & pricing to show on cards
  const { data: invData }   = useQuery({
    queryKey: ['inventory','all'],
    queryFn: () => inventory.list({ limit: 9999 }).then(r => r.data),
    staleTime: 60_000,
  });
  const { data: priceData } = useQuery({
    queryKey: ['pricing','all'],
    queryFn: () => pricing.list({ limit: 9999 }).then(r => r.data),
    staleTime: 60_000,
  });

  // Build from nested plant data (publicly available) and supplement with separately-fetched data if loaded
  const nestedVariants = (data?.plants ?? []).flatMap(p => p.variants ?? []);
  const invByVariant = {
    ...Object.fromEntries(nestedVariants.filter(v => v.inventory).map(v => [v.id, v.inventory])),
    ...Object.fromEntries((invData?.inventory ?? []).map(i => [i.variant_id, i])),
  };
  const priceByVariant = {
    ...Object.fromEntries(nestedVariants.filter(v => v.pricing).map(v => [v.id, v.pricing])),
    ...Object.fromEntries((priceData?.pricing ?? []).map(p => [p.variant_id, p])),
  };

  const dedupedPlants = deduplicatePlants(data?.plants ?? []).filter(plant => {
    if (!inStockOnly) return true;
    const avail = getAvailability(plant.variants, invByVariant);
    return avail?.status === 'in_stock';
  });

  const hasFilters = type || sun || water || pollinators || birds || edible || inStockOnly;
  const clearFilters = () => { setType(''); setSun(''); setWater(''); setPollinators(false); setBirds(false); setEdible(false); setInStockOnly(false); setPage(1); };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try { await generateWholesalePdf(); }
    finally { setPdfLoading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-forest-900 mb-1">Plant Catalog</h1>
          <p className="text-forest-500">{data?.total ?? '…'} native plants</p>
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="btn-secondary text-sm gap-2 flex items-center self-start sm:self-auto"
        >
          <FileDown size={15} />
          {pdfLoading ? 'Generating…' : 'Wholesale Price List PDF'}
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
          <input className="input pl-9" placeholder="Search plants…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary gap-2 ${hasFilters ? 'border-forest-400 text-forest-700 bg-forest-50' : ''}`}>
          <Filter size={15} /> Filters {hasFilters && <span className="badge-green text-xs ml-1">on</span>}
        </button>
        {hasFilters && <button onClick={clearFilters} className="btn-ghost text-forest-500"><X size={15} /></button>}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-5 mb-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div>
            <label className="label text-xs">Plant Type</label>
            <select className="select text-sm" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">Any</option>
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Sun</label>
            <select className="select text-sm" value={sun} onChange={e => { setSun(e.target.value); setPage(1); }}>
              <option value="">Any</option>
              {SUN.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Moisture</label>
            <select className="select text-sm" value={water} onChange={e => { setWater(e.target.value); setPage(1); }}>
              <option value="">Any</option>
              {WATER.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 justify-center">
            {[['pollinators','🐝 Pollinators', pollinators, setPollinators],
              ['birds',      '🐦 Birds',       birds,       setBirds],
              ['edible',     '🌿 Edible',      edible,      setEdible]].map(([k,label,val,set]) => (
              <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={val} onChange={e => { set(e.target.checked); setPage(1); }}
                  className="w-4 h-4 rounded border-forest-300 text-forest-600" />
                <span className="text-forest-700">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-2 justify-center">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => { setInStockOnly(e.target.checked); setPage(1); }}
                className="w-4 h-4 rounded border-forest-300 text-green-600"
              />
              <span className="text-forest-700">✅ In Stock only</span>
            </label>
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({length:12}).map((_,i) => <div key={i} className="card h-52 animate-pulse bg-forest-100" />)}
        </div>
      ) : dedupedPlants.length === 0 ? (
        <div className="text-center py-20 text-forest-400">
          <Leaf size={40} className="mx-auto mb-3 opacity-40" />
          <p>No plants match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {dedupedPlants.map(p => (
            <PlantCard
              key={p.id}
              plant={p}
              invByVariant={invByVariant}
              priceByVariant={priceByVariant}
            />
          ))}
        </div>
      )}

      {data && <Pagination page={page} total={data.total} limit={24} onPage={setPage} />}
    </div>
  );
}
