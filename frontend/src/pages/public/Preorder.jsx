import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { plants as plantsApi, preorders } from '../../api/client';
import { Search, CheckCircle } from 'lucide-react';

export default function Preorder() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ customer_name:'', customer_email:'', customer_phone:'', quantity:1, notes:'' });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { data } = useQuery({
    queryKey: ['plants','preorder-search', search],
    queryFn: () => plantsApi.list({ search, limit: 10 }).then(r => r.data),
    enabled: search.length > 1,
  });

  const mutation = useMutation({
    mutationFn: (d) => preorders.create(d),
    onSuccess: () => { setSuccess(true); setSelected(null); setForm({ customer_name:'', customer_email:'', customer_phone:'', quantity:1, notes:'' }); },
    onError: (e) => setError(e.response?.data?.error || 'Submission failed'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected) return setError('Please select a plant');
    const variant = selected.variants?.[0];
    if (!variant) return setError('No variant found for this plant');
    mutation.mutate({ ...form, variant_id: variant.id, quantity: parseInt(form.quantity) });
  };

  if (success) return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <CheckCircle size={48} className="text-forest-500 mx-auto mb-4" />
      <h1 className="font-serif text-2xl font-semibold text-forest-900 mb-2">Pre-order Confirmed!</h1>
      <p className="text-forest-500 mb-6">We'll reach out to {form.customer_email || 'you'} when your plant is ready.</p>
      <button onClick={() => setSuccess(false)} className="btn-primary">Place Another Pre-order</button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-serif text-3xl font-semibold text-forest-900 mb-2">Pre-order Plants</h1>
      <p className="text-forest-500 mb-8">Reserve plants before they're in stock. We'll contact you with availability and deposit info.</p>

      <div className="card p-6 space-y-5">
        {/* Plant search */}
        <div>
          <label className="label">Find a Plant *</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
            <input className="input pl-9" placeholder="Search by common or scientific name…"
              value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }} />
          </div>
          {data?.plants?.length > 0 && !selected && (
            <div className="mt-1 border border-forest-200 rounded-lg overflow-hidden shadow-md">
              {data.plants.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { setSelected(p); setSearch(p.common_name); }}
                  className="w-full text-left px-4 py-3 hover:bg-forest-50 border-b border-forest-100 last:border-0 transition-colors">
                  <div className="font-medium text-forest-900 text-sm">{p.common_name}</div>
                  <div className="text-xs text-forest-500 italic">{p.scientific_name}</div>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="mt-2 bg-forest-50 rounded-lg px-4 py-3 text-sm">
              <span className="font-medium text-forest-800">Selected: {selected.common_name}</span>
              <span className="text-forest-500 italic text-xs ml-2">{selected.scientific_name}</span>
            </div>
          )}
        </div>

        <div>
          <label className="label">Your Name *</label>
          <input className="input" required value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" required value={form.customer_email} onChange={e => set('customer_email', e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" type="tel" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Quantity</label>
          <input className="input" type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Container size preference, questions, etc." />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button onClick={handleSubmit} disabled={mutation.isPending || !selected} className="btn-primary w-full justify-center py-3">
          {mutation.isPending ? 'Submitting…' : 'Submit Pre-order'}
        </button>
      </div>
    </div>
  );
}
