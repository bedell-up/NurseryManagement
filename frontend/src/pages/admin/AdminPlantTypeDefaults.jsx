import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plantTypeDefaults as api, trayTypes as trayTypesApi } from '../../api/client';
import { Check, ChevronDown, Shuffle } from 'lucide-react';


function MultiSelect({ options, selected, onChange, placeholder = 'None' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (name) => {
    onChange(selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]);
  };

  const label = selected.length === 0
    ? <span className="text-forest-300">{placeholder}</span>
    : <span className="text-forest-800">{selected.join(', ')}</span>;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input text-sm w-full text-left flex items-center justify-between gap-2 pr-2"
      >
        <span className="truncate text-xs">{label}</span>
        <ChevronDown size={13} className={`flex-shrink-0 text-forest-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[180px] bg-white border border-forest-200 rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-forest-400">No options — add some in Trays &amp; Pots</p>
          ) : (
            options.map(opt => (
              <label key={opt.name} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-forest-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.name)}
                  onChange={() => toggle(opt.name)}
                  className="w-3.5 h-3.5 rounded border-forest-300 text-forest-600"
                />
                <span className="text-sm text-forest-800">{opt.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TypeRow({ row, trayOptions, potOptions, onSave, isSaving }) {
  const [trays, setTrays] = useState(row.default_tray_types ?? []);
  const [pots,  setPots]  = useState(row.default_pot_sizes  ?? []);

  const dirty =
    JSON.stringify(trays.slice().sort()) !== JSON.stringify((row.default_tray_types ?? []).slice().sort()) ||
    JSON.stringify(pots.slice().sort())  !== JSON.stringify((row.default_pot_sizes  ?? []).slice().sort());

  return (
    <tr className="hover:bg-forest-50/40 transition-colors">
      <td className="px-4 py-3 w-32">
        <span className="font-medium text-forest-900">{row.label || row.plant_type}</span>
      </td>
      <td className="px-4 py-2.5">
        <MultiSelect
          options={trayOptions}
          selected={trays}
          onChange={setTrays}
          placeholder="None selected"
        />
      </td>
      <td className="px-4 py-2.5">
        <MultiSelect
          options={potOptions}
          selected={pots}
          onChange={setPots}
          placeholder="None selected"
        />
      </td>
      <td className="px-4 py-2.5 text-right w-20">
        {dirty && (
          <button
            onClick={() => onSave(row.plant_type, { default_tray_types: trays, default_pot_sizes: pots })}
            disabled={isSaving}
            className="btn-primary text-xs px-2.5 py-1.5"
          >
            <Check size={13} /> Save
          </button>
        )}
      </td>
    </tr>
  );
}

export default function AdminPlantTypeDefaults() {
  const qc = useQueryClient();

  const { data: defaults = [], isLoading } = useQuery({
    queryKey: ['plant-type-defaults'],
    queryFn: () => api.list().then(r => r.data),
  });

  const { data: trayData = [] } = useQuery({
    queryKey: ['tray-types', 'tray'],
    queryFn: () => trayTypesApi.list({ category: 'tray', active: 'true' }).then(r => r.data),
  });

  const { data: potData = [] } = useQuery({
    queryKey: ['tray-types', 'pot'],
    queryFn: () => trayTypesApi.list({ category: 'pot', active: 'true' }).then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: ({ plantType, data }) => api.upsert(plantType, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plant-type-defaults'] }),
  });

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Shuffle size={20} className="text-forest-600" />
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Plant Type Defaults</h1>
        </div>
        <p className="text-forest-500 text-sm">
          Set default tray types and pot sizes for each plant category. These auto-fill when creating a production batch.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-50 border-b border-forest-100 text-left">
              <th className="px-4 py-3 font-medium text-forest-600 w-32">Plant Type</th>
              <th className="px-4 py-3 font-medium text-forest-600">Default Tray Types</th>
              <th className="px-4 py-3 font-medium text-forest-600">Default Pot Sizes</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-50">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-4 bg-forest-100 rounded animate-pulse w-1/2" />
                  </td>
                </tr>
              ))
            ) : (
              defaults.map(row => (
                <TypeRow
                  key={row.plant_type}
                  row={row}
                  trayOptions={trayData}
                  potOptions={potData}
                  onSave={(plantType, data) => mutation.mutate({ plantType, data })}
                  isSaving={mutation.isPending}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
