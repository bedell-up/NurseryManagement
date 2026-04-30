import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Mobile-safe plant picker. Filters to max 30 options on keystroke
 * instead of dumping thousands of items into a native <select>.
 *
 * Props:
 *   plants     — array of plant objects from the API
 *   value      — current plant_id (string | '')
 *   onChange   — (plantId, plantObject | null) => void
 *   disabled   — boolean
 *   required   — boolean
 *   placeholder — string
 */
export default function PlantSearchSelect({
  plants = [],
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = '— search plant —',
}) {
  const selectedPlant = plants.find(p => p.id === value) ?? null;

  const [query,  setQuery]  = useState('');
  const [open,   setOpen]   = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plants.slice(0, 30);
    return plants
      .filter(p =>
        (p.scientific_name || '').toLowerCase().includes(q) ||
        (p.common_name     || '').toLowerCase().includes(q) ||
        (p.plant_code      || '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [query, plants]);

  const displayValue = open
    ? query
    : (selectedPlant
        ? (selectedPlant.scientific_name || selectedPlant.common_name)
        : '');

  const handleFocus = () => {
    setQuery('');
    setOpen(true);
  };

  const handleSelect = (plant) => {
    onChange(plant.id, plant);
    setQuery('');
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400 pointer-events-none" />
        <input
          type="text"
          className={`input pl-8 pr-8 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          placeholder={placeholder}
          value={displayValue}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={handleFocus}
          required={required && !value}
          readOnly={disabled}
          autoComplete="off"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-forest-300 hover:text-forest-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-forest-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-forest-400">No matches</div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => handleSelect(p)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-forest-50 transition-colors ${p.id === value ? 'bg-forest-50 font-medium' : ''}`}
              >
                <span className="italic text-forest-900">{p.scientific_name || p.common_name}</span>
                {p.scientific_name && p.common_name && (
                  <span className="text-forest-400 ml-1.5 text-xs">{p.common_name}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
