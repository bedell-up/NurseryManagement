import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { plants as plantsApi, inventory, pricing } from '../../api/client';
import { ArrowLeft, Sun, Droplets, ExternalLink, Leaf } from 'lucide-react';

function Row({ label, value }) {
  if (!value && value !== false && value !== 0) return null;
  return (
    <div className="flex gap-3 py-2.5 border-b border-forest-50 last:border-0">
      <span className="text-forest-500 text-sm w-36 flex-shrink-0">{label}</span>
      <span className="text-forest-900 text-sm">{String(value)}</span>
    </div>
  );
}

function YesNo({ v }) {
  if (v === null || v === undefined) return <span className="text-forest-400">Unknown</span>;
  return v ? <span className="text-forest-600 font-medium">Yes</span> : <span className="text-forest-400">No</span>;
}

const SUN_LABELS   = { full_sun:'Full Sun', part_shade:'Part Shade', partial_shade_to_shade:'Partial Shade to Shade',full_shade:'Full Shade', sun_to_part_shade:'Sun to Part Shade' };
const WATER_LABELS = { dry:'Dry', medium:'Medium', wet:'Wet', wet_to_medium:'Wet to Medium', dry_to_medium:'Dry to Medium' };

function getAvailabilityInfo(inv) {
  if (!inv) return { text: 'Unavailable', status: 'unavailable' };
  const onHand   = Number(inv.quantity_on_hand  || 0);
  const reserved = Number(inv.quantity_reserved || 0);
  const incoming = Number(inv.quantity_incoming || 0);
  const available = onHand - reserved;
  const label = inv.availability_label?.trim();

  if (available > 0) return { text: `In Stock (${available})`, status: 'in_stock' };
  if (label)         return { text: label,                      status: 'custom' };
  if (incoming > 0)  return { text: `Incoming (${incoming})`,  status: 'incoming' };
  return { text: 'Unavailable', status: 'unavailable' };
}

function isActiveSale(p) {
  if (!p?.sale_price) return false;
  const now = Date.now();
  const start = p.sale_starts_at ? new Date(p.sale_starts_at).getTime() : 0;
  const end   = p.sale_ends_at   ? new Date(p.sale_ends_at).getTime()   : Infinity;
  return now >= start && now <= end;
}

export default function PlantDetail() {
  const { id } = useParams();
  const { data: plant, isLoading } = useQuery({
    queryKey: ['plant', id],
    queryFn: () => plantsApi.get(id).then(r => r.data),
  });

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

  const invByVariant   = Object.fromEntries((invData?.inventory ?? []).map(i => [i.variant_id, i]));
  const priceByVariant = Object.fromEntries((priceData?.pricing  ?? []).map(p => [p.variant_id, p]));

  if (isLoading) return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-pulse space-y-4">
      <div className="h-8 bg-forest-100 rounded w-1/2" />
      <div className="h-64 bg-forest-100 rounded-xl" />
    </div>
  );

  if (!plant) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center text-forest-400">
      <Leaf size={40} className="mx-auto mb-3 opacity-40" />
      <p>Plant not found</p>
      <Link to="/catalog" className="btn-secondary mt-4 inline-flex">← Back to Catalog</Link>
    </div>
  );

  const heightStr = plant.mature_height_min_ft
    ? plant.mature_height_min_ft === plant.mature_height_max_ft
      ? `${plant.mature_height_min_ft}'`
      : `${plant.mature_height_min_ft}' – ${plant.mature_height_max_ft}'`
    : null;

  const widthStr = plant.mature_width_min_ft
    ? plant.mature_width_min_ft === plant.mature_width_max_ft
      ? `${plant.mature_width_min_ft}'`
      : `${plant.mature_width_min_ft}' – ${plant.mature_width_max_ft}'`
    : null;

  // Build variant rows with pricing + availability
  const variantRows = (plant.variants ?? []).map(v => {
    const inv   = invByVariant[v.id];
    const price = priceByVariant[v.id];
    const avail = getAvailabilityInfo(inv);
    const onSale = price && isActiveSale(price);
    const displayPrice = onSale ? Number(price.sale_price) : price?.retail_price ? Number(price.retail_price) : null;
    return { variant: v, inv, price, avail, displayPrice, onSale };
  });

  const availClass = {
    in_stock:    'text-green-700 bg-green-50 border border-green-200',
    custom:      'text-sky-700 bg-sky-50 border border-sky-200',
    incoming:    'text-amber-700 bg-amber-50 border border-amber-200',
    unavailable: 'text-forest-400 bg-forest-50 border border-forest-100',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/catalog" className="inline-flex items-center gap-1.5 text-forest-500 hover:text-forest-700 text-sm mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to Catalog
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Left column */}
        <div className="md:col-span-2">
          {plant.image_url ? (
            <img src={plant.image_url} alt={plant.common_name} className="w-full rounded-xl object-cover aspect-[4/3] mb-4" />
          ) : (
            <div className="w-full rounded-xl bg-forest-100 aspect-[4/3] mb-4 flex items-center justify-center">
              <Leaf size={48} className="text-forest-300" />
            </div>
          )}

          {/* Wildlife badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {plant.attracts_pollinators && <span className="badge-green">🐝 Pollinators</span>}
            {plant.attracts_birds       && <span className="badge-blue">🐦 Birds</span>}
            {plant.attracts_butterflies && <span className="badge-green">🦋 Butterflies</span>}
            {plant.deer_resistant       && <span className="badge-earth">🦌 Deer Resistant</span>}
            {plant.is_edible            && <span className="badge-earth">🌿 Edible</span>}
            {plant.is_medicinal         && <span className="badge-blue">💊 Medicinal</span>}
            {plant.is_fire_resistant    && <span className="badge-red">🔥 Fire Resistant</span>}
            {plant.is_pet_friendly      && <span className="badge-green">🐾 Pet Friendly</span>}
            {plant.portland_plant_list  && <span className="badge-gray">PDX Approved</span>}
          </div>

          {/* Quick sun/water */}
          <div className="card p-4 space-y-3">
            {plant.sun_requirements && (
              <div className="flex items-center gap-3">
                <Sun size={16} className="text-earth-500 flex-shrink-0" />
                <span className="text-sm text-forest-700">{SUN_LABELS[plant.sun_requirements]}</span>
              </div>
            )}
            {plant.water_requirements && (
              <div className="flex items-center gap-3">
                <Droplets size={16} className="text-blue-500 flex-shrink-0" />
                <span className="text-sm text-forest-700">{WATER_LABELS[plant.water_requirements]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="md:col-span-3">
          <div className="mb-1">
            {plant.plant_type && <span className="badge-green text-xs mb-3 inline-block capitalize">{plant.plant_type}</span>}
          </div>
          <h1 className="font-serif text-3xl font-semibold text-forest-900 leading-tight">{plant.common_name}</h1>
          <p className="italic text-forest-500 text-lg mt-1">{plant.scientific_name}</p>

          {plant.description && (
            <p className="text-forest-700 mt-4 leading-relaxed">{plant.description}</p>
          )}

          {/* Pricing & availability per variant */}
          {variantRows.length > 0 && (
            <div className="card mt-6 overflow-hidden">
              <div className="px-5 py-3 border-b border-forest-100">
                <h2 className="font-semibold text-forest-900">Sizes & Availability</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-forest-50 text-left">
                    <th className="px-5 py-2.5 font-medium text-forest-600">Size</th>
                    <th className="px-5 py-2.5 font-medium text-forest-600 text-right">Price</th>
                    <th className="px-5 py-2.5 font-medium text-forest-600 text-right">Availability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-50">
                  {variantRows.map(({ variant, price, avail, displayPrice, onSale }) => (
                    <tr key={variant.id}>
                      <td className="px-5 py-3 text-forest-800">{variant.container_size}</td>
                      <td className="px-5 py-3 text-right">
                        {displayPrice !== null ? (
                          <span className="font-semibold text-forest-900">
                            ${displayPrice.toFixed(2)}
                            {onSale && price?.retail_price && (
                              <span className="text-forest-400 line-through ml-2 font-normal text-xs">
                                ${Number(price.retail_price).toFixed(2)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-forest-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${availClass[avail.status]}`}>
                          {avail.text}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card p-5 mt-4">
            <h2 className="font-semibold text-forest-900 mb-3">Plant Details</h2>
            <Row label="Native Region"    value={plant.native_region} />
            <Row label="Bloom Time"       value={plant.bloom_time} />
            <Row label="Bloom Color"      value={plant.bloom_color} />
            <Row label="Mature Height"    value={heightStr} />
            <Row label="Mature Width"     value={widthStr} />
            <Row label="Soil Type"        value={plant.soil_type} />
            <Row label="Hardiness Zone"   value={plant.hardiness_zone_min && plant.hardiness_zone_max ? `${plant.hardiness_zone_min}–${plant.hardiness_zone_max}` : plant.hardiness_zone_min} />
            <Row label="Landscape Use"    value={plant.landscape_use} />
            <Row label="Bouquet Use"      value={plant.bouquet_use} />
          </div>

          {plant.notes && (
            <div className="card p-5 mt-4">
              <h2 className="font-semibold text-forest-900 mb-3">Ecological Notes</h2>
              <p className="text-sm text-forest-700 whitespace-pre-line">{plant.notes}</p>
            </div>
          )}

          <div className="flex gap-3 mt-5 flex-wrap">
            {plant.more_info_url && (
              <a href={plant.more_info_url} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
                More Info <ExternalLink size={13} />
              </a>
            )}
            {plant.usda_profile_url && (
              <a href={plant.usda_profile_url} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
                USDA Profile <ExternalLink size={13} />
              </a>
            )}
            <Link to="/preorder" className="btn-primary text-sm">Pre-order This Plant</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
