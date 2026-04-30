import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { plants as plantsApi, spotlights } from '../../api/client';
import { Leaf, Search, ArrowRight, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import banner from "../../assets/BD_banner.webp";

function Countdown({ endsAt, label }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt) - new Date();
      if (diff <= 0) { setTime('Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <div className="flex items-center gap-2 text-earth-600 text-sm mt-2">
      <Clock size={14} />
      <span>{label || 'Ends in'}: <strong>{time}</strong></span>
    </div>
  );
}

const PLANT_TYPES = ['tree','shrub','perennial','annual','graminoid','fern','vine','aquatic','perennial_vegetable','other'];
const PLANT_TYPE_LABELS = {
  tree:'Tree', shrub:'Shrub', perennial:'Perennial', annual:'Annual',
  graminoid:'Graminoid', fern:'Fern', vine:'Vine', aquatic:'Aquatic',
  perennial_vegetable:'Perennial Vegetable', other:'Other',
};

export default function Home() {
  const { data: spotlightData = [] } = useQuery({
    queryKey: ['spotlights','active'],
    queryFn: () => spotlights.listActive().then(r => r.data),
  });
  const { data: featuredData } = useQuery({
    queryKey: ['plants','featured'],
    queryFn: () => plantsApi.list({ featured: 'true', limit: 6 }).then(r => r.data),
  });
  const { data: allData } = useQuery({
    queryKey: ['plants','count'],
    queryFn: () => plantsApi.list({ limit: 1 }).then(r => r.data),
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-forest-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-950 via-forest-900 to-forest-800 opacity-90" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-forest-700/60 rounded-full px-4 py-1.5 text-forest-200 text-sm mb-6">
            <Leaf size={14} /> {allData?.total ?? '…'} native plants in our catalog
          </div>
          <h1 className="mb-5">
            <img src={banner} alt="Bloomsday Natives" className="mx-auto max-w-md md:max-w-lg" />
          </h1>
          <p className="text-forest-300 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            Sustainably grown natives for gardens, restoration projects, and food forests.
            From woodland understory to pollinator meadows.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/catalog" className="btn-earth py-3 px-8 text-base justify-center">
              Browse Catalog <ArrowRight size={18} />
            </Link>
            <Link to="/preorder" className="btn-secondary py-3 px-8 text-base justify-center text-white border-white/20 hover:bg-white/10">
              Pre-Order Plants
            </Link>
          </div>
        </div>
      </section>

      {/* Spotlights */}
      {spotlightData.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-14">
          <h2 className="font-serif text-2xl font-semibold text-forest-900 mb-6">Featured Now</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {spotlightData.map(s => (
              <div key={s.id} className="card overflow-hidden group">
                {s.image_url && (
                  <div className="h-44 overflow-hidden">
                    <img src={s.image_url} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <div className="p-5">
                  <span className={`badge-${s.type === 'sale' ? 'earth' : s.type === 'plant' ? 'green' : 'blue'} text-xs mb-2 inline-block`}>{s.type}</span>
                  <h3 className="font-semibold text-forest-900 text-lg leading-snug">{s.title}</h3>
                  {s.subtitle && <p className="text-forest-500 text-sm mt-1">{s.subtitle}</p>}
                  {s.countdown_ends_at && <Countdown endsAt={s.countdown_ends_at} label={s.countdown_label} />}
                  {s.cta_text && s.cta_url && (
                    <a href={s.cta_url} className="btn-primary mt-4 inline-flex text-sm">{s.cta_text} <ArrowRight size={14} /></a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Browse by type */}
      <section className="bg-forest-900/5 py-14">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="font-serif text-2xl font-semibold text-forest-900 mb-2">Browse by Type</h2>
          <p className="text-forest-500 mb-7">Find the right plant for your project</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {PLANT_TYPES.map(type => {
              const icons = { tree:'🌳', shrub:'🌿', perennial:'🌸', annual:'🌼', graminoid:'🌾', fern:'🌿', vine:'🍃', aquatic:'💧', perennial_vegetable:'🥬', other:'🪴' };
              return (
                <Link key={type} to={`/catalog?type=${type}`}
                  className="card p-4 text-center hover:border-forest-300 hover:shadow-md transition-all group">
                  <div className="text-2xl mb-2">{icons[type]}</div>
                  <div className="text-sm font-medium text-forest-800 group-hover:text-forest-600">{PLANT_TYPE_LABELS[type] || type}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick search CTA */}
      <section className="max-w-3xl mx-auto px-4 py-14 text-center">
        <h2 className="font-serif text-2xl font-semibold text-forest-900 mb-3">Looking for something specific?</h2>
        <p className="text-forest-500 mb-6">Search by name, sun/shade requirements, bloom time, wildlife value, and more</p>
        <Link to="/catalog" className="btn-primary py-3 px-8 text-base inline-flex">
          <Search size={18} /> Open Plant Catalog
        </Link>
      </section>
    </div>
  );
}
