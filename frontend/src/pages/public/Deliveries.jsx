import { useQuery } from '@tanstack/react-query';
import { deliveries } from '../../api/client';
import { Truck, Calendar, Package } from 'lucide-react';

const STATUS_LABELS = { planned:'Planned', ordered:'Ordered', in_transit:'In Transit', arrived:'Arrived', cancelled:'Cancelled' };
const STATUS_COLORS = { planned:'badge-gray', ordered:'badge-blue', in_transit:'badge-earth', arrived:'badge-green', cancelled:'badge-red' };

export default function Deliveries() {
  const { data: windows = [], isLoading } = useQuery({
    queryKey: ['deliveries','public'],
    queryFn: () => deliveries.list({ status: 'planned,ordered,in_transit' }).then(r => r.data),
  });

  const visible = windows.filter(w => w.is_visible_to_customers);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-forest-900">Plant Availability</h1>
        <p className="text-forest-500 mt-2">Upcoming deliveries and expected availability dates</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({length:3}).map((_,i) => <div key={i} className="card h-32 animate-pulse bg-forest-100" />)}</div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center text-forest-400">
          <Truck size={40} className="mx-auto mb-3 opacity-40" />
          <p>No upcoming deliveries scheduled yet. Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {visible.map(w => (
            <div key={w.id} className="card p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-forest-900 text-lg">{w.name}</h2>
                  {w.supplier_name && <p className="text-forest-500 text-sm">{w.supplier_name}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={STATUS_COLORS[w.status]}>{STATUS_LABELS[w.status]}</span>
                  <div className="flex items-center gap-1.5 text-forest-600 text-sm">
                    <Calendar size={14} />
                    {w.confirmed_date || w.expected_date}
                  </div>
                </div>
              </div>

              {w.notes && <p className="text-forest-600 text-sm mb-4">{w.notes}</p>}

              {w.items?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-forest-500 uppercase tracking-wide mb-2">Included Plants</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {w.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-forest-50 rounded-lg px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-forest-800">{item.variant?.plant?.common_name}</span>
                          <span className="text-forest-400 text-xs ml-2">{item.variant?.container_size}</span>
                        </div>
                        <span className="text-forest-500 text-xs">qty: {item.quantity_expected}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
