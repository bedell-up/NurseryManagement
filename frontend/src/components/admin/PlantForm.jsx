import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plants as plantsApi, plantTypes as plantTypesApi } from '../../api/client';
const SUN_OPTIONS = [
  { value: 'full_sun',         label: 'Full Sun' },
  { value: 'part_shade',       label: 'Part Shade' },
  { value: 'partial_shade_to_shade', label: 'Partial Shade to Shade' },
  { value: 'full_shade',       label: 'Full Shade' },
  { value: 'sun_to_part_shade',label: 'Sun to Part Shade' },
];
const WATER_OPTIONS = [
  { value: 'dry',          label: 'Dry' },
  { value: 'medium',       label: 'Medium' },
  { value: 'wet',          label: 'Wet' },
  { value: 'wet_to_medium',label: 'Wet to Medium' },
  { value: 'dry_to_medium',label: 'Dry to Medium' },
];

const SEED_UNITS = [
  { value: 'g',  label: 'per gram', factor: 1 },
  { value: 'oz', label: 'per oz',   factor: 1 / 28.3495 },
  { value: 'lb', label: 'per lb',   factor: 1 / 453.592 },
  { value: 'kg', label: 'per kg',   factor: 1 / 1000 },
];

const EMPTY = {
  common_name: '', scientific_name: '', genus: '', species: '', cultivar: '', family: '',
  plant_type: '', native_region: '', plant_code: '',
  sun_requirements: '', water_requirements: '', soil_type: '',
  bloom_time: '', bloom_color: '',
  mature_height_min_ft: '', mature_height_max_ft: '',
  mature_width_min_ft: '', mature_width_max_ft: '',
  hardiness_zone_min: '', hardiness_zone_max: '',
  attracts_pollinators: false, attracts_birds: false, attracts_butterflies: false, deer_resistant: false,
  is_edible: false, is_medicinal: false, is_fire_resistant: false,
  is_pet_friendly: null, portland_plant_list: null,
  seeds_per_gram: '',
  bouquet_use: '', landscape_use: '', description: '', notes: '',
  more_info_url: '', usda_profile_url: '', image_url: '',
  is_active: true, is_featured: false,
};

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-forest-600 uppercase tracking-wide mb-3 pb-1 border-b border-forest-100">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, full, children }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Checkbox({ label, name, value, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={!!value} onChange={e => onChange(name, e.target.checked)}
        className="w-4 h-4 rounded border-forest-300 text-forest-600 focus:ring-forest-500" />
      <span className="text-sm text-forest-700">{label}</span>
    </label>
  );
}

export default function PlantForm({ plant, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!plant?.id;
  const [form, setForm] = useState(plant ? { ...EMPTY, ...plant } : EMPTY);

  const { data: plantTypesList = [] } = useQuery({
    queryKey: ['plant-types', 'active'],
    queryFn: () => plantTypesApi.list({ active: 'true' }).then(r => r.data),
  });
  const [seedUnit, setSeedUnit] = useState('g');
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = (k) => ({ value: form[k] ?? '', onChange: e => set(k, e.target.value) });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? plantsApi.update(plant.id, data) : plantsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plants'] });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.error || 'Save failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form };
    // Coerce numeric fields
    ['mature_height_min_ft','mature_height_max_ft','mature_width_min_ft','mature_width_max_ft'].forEach(k => {
      payload[k] = payload[k] !== '' ? parseFloat(payload[k]) : null;
    });
    // Convert seeds_per_gram to always be seeds/gram regardless of input unit
    if (payload.seeds_per_gram !== '') {
      const unit = SEED_UNITS.find(u => u.value === seedUnit);
      payload.seeds_per_gram = parseFloat(payload.seeds_per_gram) * (unit?.factor ?? 1);
    } else {
      payload.seeds_per_gram = null;
    }
    // Coerce empties to null
    ['plant_type','sun_requirements','water_requirements','native_region','genus','species','cultivar',
     'family','soil_type','bloom_time','bloom_color','hardiness_zone_min','hardiness_zone_max',
     'bouquet_use','landscape_use','description','notes','more_info_url','usda_profile_url',
     'image_url','plant_code','scientific_name'].forEach(k => {
       if (payload[k] === '') payload[k] = null;
    });
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Section title="Identity">
        <Field label="Common Name *">
          <input className="input" required {...inp('common_name')} placeholder="e.g. Red Alder" />
        </Field>
        <Field label="Scientific Name">
          <input className="input" {...inp('scientific_name')} placeholder="e.g. Alnus rubra" />
        </Field>
        <Field label="Plant Code">
          <input className="input" {...inp('plant_code')} placeholder="e.g. Ar" maxLength={10} />
        </Field>
        <Field label="Plant Type">
          <select className="select" {...inp('plant_type')}>
            <option value="">— select —</option>
            {plantTypesList.map(t => <option key={t.name} value={t.name}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Genus"><input className="input" {...inp('genus')} /></Field>
        <Field label="Species"><input className="input" {...inp('species')} /></Field>
        <Field label="Cultivar/Variety"><input className="input" {...inp('cultivar')} /></Field>
        <Field label="Family"><input className="input" {...inp('family')} /></Field>
        <Field label="Native Region">
          <input className="input" {...inp('native_region')} placeholder="e.g. Pacific Northwest" />
        </Field>
        <div className="flex items-center gap-6 sm:col-span-2">
          <Checkbox label="PNW Native" name="native_region" value={form.native_region === 'Pacific Northwest'}
            onChange={(_, v) => set('native_region', v ? 'Pacific Northwest' : '')} />
          <Checkbox label="Portland Plant List" name="portland_plant_list" value={form.portland_plant_list}
            onChange={(k, v) => set(k, v)} />
        </div>
      </Section>

      <Section title="Growing Conditions">
        <Field label="Sun Requirements">
          <select className="select" {...inp('sun_requirements')}>
            <option value="">— select —</option>
            {SUN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Water/Moisture">
          <select className="select" {...inp('water_requirements')}>
            <option value="">— select —</option>
            {WATER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Soil Type"><input className="input" {...inp('soil_type')} placeholder="e.g. Well-drained, Clay" /></Field>
        <Field label="Bloom Time"><input className="input" {...inp('bloom_time')} placeholder="e.g. May - July" /></Field>
        <Field label="Bloom Color"><input className="input" {...inp('bloom_color')} /></Field>
        <div />
        <Field label="Min Height (ft)"><input className="input" type="number" step="0.5" {...inp('mature_height_min_ft')} /></Field>
        <Field label="Max Height (ft)"><input className="input" type="number" step="0.5" {...inp('mature_height_max_ft')} /></Field>
        <Field label="Min Width (ft)"><input className="input" type="number" step="0.5" {...inp('mature_width_min_ft')} /></Field>
        <Field label="Max Width (ft)"><input className="input" type="number" step="0.5" {...inp('mature_width_max_ft')} /></Field>
        <Field label="Hardiness Zone Min"><input className="input" {...inp('hardiness_zone_min')} placeholder="e.g. 6" /></Field>
        <Field label="Hardiness Zone Max"><input className="input" {...inp('hardiness_zone_max')} placeholder="e.g. 9" /></Field>
        <Field label="Seeds per Weight">
          <div className="flex gap-2">
            <input className="input flex-1" type="number" step="0.01" min="0" {...inp('seeds_per_gram')} placeholder="e.g. 250" />
            <select className="select w-32" value={seedUnit} onChange={e => setSeedUnit(e.target.value)}>
              {SEED_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          {form.seeds_per_gram !== '' && seedUnit !== 'g' && (
            <p className="text-xs text-forest-400 mt-1">
              = {(parseFloat(form.seeds_per_gram || 0) * (SEED_UNITS.find(u => u.value === seedUnit)?.factor ?? 1)).toFixed(2)} seeds/gram stored
            </p>
          )}
        </Field>
      </Section>

      <Section title="Attributes">
        <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Checkbox label="Attracts Pollinators" name="attracts_pollinators" value={form.attracts_pollinators} onChange={set} />
          <Checkbox label="Attracts Birds"        name="attracts_birds"        value={form.attracts_birds}        onChange={set} />
          <Checkbox label="Attracts Butterflies"  name="attracts_butterflies"  value={form.attracts_butterflies}  onChange={set} />
          <Checkbox label="Deer Resistant"        name="deer_resistant"        value={form.deer_resistant}        onChange={set} />
          <Checkbox label="Edible"                name="is_edible"             value={form.is_edible}             onChange={set} />
          <Checkbox label="Medicinal"             name="is_medicinal"          value={form.is_medicinal}          onChange={set} />
          <Checkbox label="Fire Resistant"        name="is_fire_resistant"     value={form.is_fire_resistant}     onChange={set} />
          <Checkbox label="Pet Friendly"          name="is_pet_friendly"       value={form.is_pet_friendly}       onChange={set} />
        </div>
        <Field label="Bouquet / Cut Flower Use">
          <input className="input" {...inp('bouquet_use')} placeholder="e.g. Blooms, Foliage" />
        </Field>
        <Field label="Landscape Use">
          <input className="input" {...inp('landscape_use')} placeholder="e.g. Rain Garden, Woodland Garden" />
        </Field>
      </Section>

      <Section title="Info & Links">
        <Field label="Description" full>
          <textarea className="input" rows={3} {...inp('description')} />
        </Field>
        <Field label="Ecological Notes / Companion Plants" full>
          <textarea className="input" rows={3} {...inp('notes')} />
        </Field>
        <Field label="More Info URL">
          <input className="input" type="url" {...inp('more_info_url')} placeholder="https://..." />
        </Field>
        <Field label="USDA Profile URL">
          <input className="input" type="url" {...inp('usda_profile_url')} placeholder="https://..." />
        </Field>
        <Field label="Image URL" full>
          <input className="input" type="url" {...inp('image_url')} placeholder="https://..." />
        </Field>
      </Section>

      <Section title="Status">
        <div className="sm:col-span-2 flex gap-6">
          <Checkbox label="Active (visible on site)" name="is_active"   value={form.is_active}   onChange={set} />
          <Checkbox label="Featured"                 name="is_featured" value={form.is_featured} onChange={set} />
        </div>
      </Section>

      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2">{error}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-forest-100">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Plant'}
        </button>
      </div>
    </form>
  );
}
