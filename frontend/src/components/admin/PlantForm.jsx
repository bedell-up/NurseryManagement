import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plants as plantsApi, plantTypes as plantTypesApi, usda as usdaApi, inat as inatApi } from '../../api/client';
import { Search, Loader, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

const SUN_OPTIONS = [
  { value: 'full_sun',                  label: 'Full Sun' },
  { value: 'sun_to_part_shade',         label: 'Sun to Part Shade' },
  { value: 'part_shade',                label: 'Part Shade' },
  { value: 'partial_shade_to_shade',    label: 'Partial Shade to Shade' },
  { value: 'full_shade',                label: 'Full Shade' },
];
const WATER_OPTIONS = [
  { value: 'dry',           label: 'Dry' },
  { value: 'dry_to_medium', label: 'Dry to Medium' },
  { value: 'medium',        label: 'Medium' },
  { value: 'wet_to_medium', label: 'Wet to Medium' },
  { value: 'wet',           label: 'Wet' },
];

const SEED_UNITS = [
  { value: 'g',  label: 'per gram', factor: 1 },
  { value: 'oz', label: 'per oz',   factor: 1 / 28.3495 },
  { value: 'lb', label: 'per lb',   factor: 1 / 453.592 },
  { value: 'kg', label: 'per kg',   factor: 1 / 1000 },
];

const LANDSCAPE_USE_OPTIONS = [
  'Rain Garden', 'Wetland / Riparian', 'Woodland Garden', 'Shade Garden',
  'Mixed Border', 'Pollinator Garden', 'Hedgerow / Wildlife Corridor',
  'Erosion Control', 'Screening / Privacy', 'Rock Garden',
];

const BOUQUET_OPTIONS = [
  'Blooms', 'Foliage', 'Seed Heads / Pods', 'Berries / Fruit', 'Branches',
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
  more_info_url: '', usda_profile_url: '', oregon_flora_url: '', image_url: '',
  is_active: true, is_featured: false,
};

// Parse comma-separated values to/from checkbox arrays
function toSet(str) {
  return new Set((str || '').split(',').map(s => s.trim()).filter(Boolean));
}
function fromSet(set) {
  return [...set].join(', ');
}

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

function MultiCheckGroup({ options, value, onChange }) {
  const selected = toSet(value);
  const toggle = (opt) => {
    const next = new Set(selected);
    next.has(opt) ? next.delete(opt) : next.add(opt);
    onChange(fromSet(next));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            selected.has(opt)
              ? 'bg-forest-600 border-forest-600 text-white'
              : 'border-forest-300 text-forest-600 hover:border-forest-500'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// Inline status chip shown after a lookup attempt
function LookupStatus({ status }) {
  if (!status) return null;
  if (status === 'loading') return (
    <span className="flex items-center gap-1 text-xs text-forest-400">
      <Loader size={12} className="animate-spin" /> Looking up USDA…
    </span>
  );
  if (status === 'found') return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <CheckCircle size={12} /> USDA data filled in
    </span>
  );
  if (status === 'not_found') return (
    <span className="flex items-center gap-1 text-xs text-amber-600">
      <AlertCircle size={12} /> Not found in USDA — fill in manually
    </span>
  );
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-xs text-red-600">
      <AlertCircle size={12} /> USDA lookup failed
    </span>
  );
  return null;
}

export default function PlantForm({ plant, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!plant?.id;
  const [form, setForm] = useState(plant ? { ...EMPTY, ...plant } : EMPTY);
  const [seedUnit, setSeedUnit] = useState('g');
  const [error, setError] = useState('');
  const [lookupStatus, setLookupStatus] = useState(null);
  const [photoSource, setPhotoSource] = useState('inat'); // 'inat' | 'own'

  const { data: plantTypesList = [] } = useQuery({
    queryKey: ['plant-types', 'active'],
    queryFn: () => plantTypesApi.list({ active: 'true' }).then(r => r.data),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = (k) => ({ value: form[k] ?? '', onChange: e => set(k, e.target.value) });

  // USDA lookup + Oregon Flora URL auto-fill
  const handleUsdalookup = async () => {
    const q = form.scientific_name.trim();
    if (!q) return;
    setLookupStatus('loading');
    try {
      const resp = await usdaApi.lookup(q);
      const { found, data } = resp.data;
      if (!found) { setLookupStatus('not_found'); return; }

      // Oregon Flora URL constructed server-side; also auto-fill fields
      setForm(f => {
        const next = { ...f };
        Object.entries(data).forEach(([k, v]) => {
          // Don't overwrite fields the user has already filled in
          if (v !== null && v !== undefined && (f[k] === '' || f[k] === null || f[k] === false)) {
            next[k] = v;
          }
          // Always take URLs and scientific name from USDA
          if (['usda_profile_url', 'oregon_flora_url', 'scientific_name', 'genus', 'species', 'family'].includes(k) && v) {
            next[k] = v;
          }
        });
        return next;
      });
      setLookupStatus('found');
    } catch {
      setLookupStatus('error');
    }
  };

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
    ['mature_height_min_ft','mature_height_max_ft','mature_width_min_ft','mature_width_max_ft'].forEach(k => {
      payload[k] = payload[k] !== '' ? parseFloat(payload[k]) : null;
    });
    if (payload.seeds_per_gram !== '') {
      const unit = SEED_UNITS.find(u => u.value === seedUnit);
      payload.seeds_per_gram = parseFloat(payload.seeds_per_gram) * (unit?.factor ?? 1);
    } else {
      payload.seeds_per_gram = null;
    }
    ['plant_type','sun_requirements','water_requirements','native_region','genus','species','cultivar',
     'family','soil_type','bloom_time','bloom_color','hardiness_zone_min','hardiness_zone_max',
     'bouquet_use','landscape_use','description','notes','more_info_url','usda_profile_url',
     'oregon_flora_url','image_url','plant_code','scientific_name'].forEach(k => {
       if (payload[k] === '') payload[k] = null;
    });
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">

      {/* Identity */}
      <Section title="Identity">
        <Field label="Common Name *">
          <input className="input" required {...inp('common_name')} placeholder="e.g. Red Alder" />
        </Field>

        {/* Scientific name + USDA lookup button */}
        <Field label="Scientific Name">
          <div className="flex gap-2">
            <input className="input flex-1" {...inp('scientific_name')} placeholder="e.g. Alnus rubra" />
            <button
              type="button"
              onClick={handleUsdalookup}
              disabled={!form.scientific_name.trim() || lookupStatus === 'loading'}
              title="Look up USDA Plants database"
              className="btn-secondary flex items-center gap-1.5 shrink-0 text-xs px-3"
            >
              {lookupStatus === 'loading'
                ? <Loader size={13} className="animate-spin" />
                : <Search size={13} />}
              USDA Lookup
            </button>
          </div>
          <div className="mt-1.5 min-h-[1.25rem]">
            <LookupStatus status={lookupStatus} />
          </div>
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

      {/* Growing Conditions */}
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
        <Field label="Bloom Time"><input className="input" {...inp('bloom_time')} placeholder="e.g. May – July" /></Field>
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

      {/* Attributes */}
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

        <Field label="Landscape Use" full>
          <MultiCheckGroup
            options={LANDSCAPE_USE_OPTIONS}
            value={form.landscape_use}
            onChange={v => set('landscape_use', v)}
          />
          <input className="input mt-2" {...inp('landscape_use')} placeholder="Or type custom values…" />
        </Field>

        <Field label="Bouquet / Cut Use" full>
          <MultiCheckGroup
            options={BOUQUET_OPTIONS}
            value={form.bouquet_use}
            onChange={v => set('bouquet_use', v)}
          />
          <input className="input mt-2" {...inp('bouquet_use')} placeholder="Or type custom values…" />
        </Field>
      </Section>

      {/* Info & Links */}
      <Section title="Info & Links">
        <Field label="Description" full>
          <textarea className="input" rows={3} {...inp('description')} />
        </Field>
        <Field label="Ecological Notes / Companion Plants" full>
          <textarea className="input" rows={3} {...inp('notes')} />
        </Field>
        <Field label="USDA Profile URL">
          <div className="flex gap-1.5 items-center">
            <input className="input flex-1" type="url" {...inp('usda_profile_url')} placeholder="https://plants.usda.gov/…" />
            {form.usda_profile_url && (
              <a href={form.usda_profile_url} target="_blank" rel="noreferrer" className="text-forest-400 hover:text-forest-700 shrink-0" title="Open USDA page">
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </Field>
        <Field label="Oregon Flora URL">
          <div className="flex gap-1.5 items-center">
            <input className="input flex-1" type="url" {...inp('oregon_flora_url')} placeholder="https://oregonflora.org/…" />
            {form.oregon_flora_url && (
              <a href={form.oregon_flora_url} target="_blank" rel="noreferrer" className="text-forest-400 hover:text-forest-700 shrink-0" title="Open Oregon Flora page">
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </Field>
        <Field label="More Info URL">
          <input className="input" type="url" {...inp('more_info_url')} placeholder="https://…" />
        </Field>
      </Section>

      {/* Photo */}
      <Section title="Photo">
        {/* Toggle: iNaturalist vs own photo */}
        <div className="sm:col-span-2">
          <div className="flex rounded-lg border border-forest-200 overflow-hidden w-fit mb-4">
            {[
              { value: 'inat', label: 'Add from iNaturalist' },
              { value: 'own',  label: 'Add own photo URL' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPhotoSource(opt.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  photoSource === opt.value
                    ? 'bg-forest-600 text-white'
                    : 'bg-white text-forest-600 hover:bg-forest-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {photoSource === 'inat' ? (
            <div className="space-y-2">
              <p className="text-xs text-forest-500">
                After saving, use the iNaturalist fetch button on the plant list to pull a photo automatically using the scientific name.
              </p>
              {form.image_url && (
                <img src={form.image_url} alt="" className="h-32 w-32 object-cover rounded-lg border border-forest-200" />
              )}
            </div>
          ) : (
            <Field label="Image URL" full>
              <input className="input" type="url" {...inp('image_url')} placeholder="https://…" />
              {form.image_url && (
                <img src={form.image_url} alt="" className="mt-2 h-32 w-32 object-cover rounded-lg border border-forest-200" />
              )}
            </Field>
          )}
        </div>
      </Section>

      {/* Status */}
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
