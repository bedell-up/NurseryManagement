import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { landscaping } from '../../api/client';
import { MapPin, TreePine, Briefcase, RefreshCw, AlertCircle, Images } from 'lucide-react';
import PhotoGallery from '../../components/admin/PhotoGallery';
import Modal from '../../components/ui/Modal';

// ---- Marker icon factory ----
function makeIcon(type, status) {
  const faded = status === 'completed' || status === 'cancelled';
  const fill  = type === 'in_ground' ? '#15803d' : '#1d4ed8';
  const ring  = faded ? '#94a3b8' : 'white';
  const op    = faded ? 0.45 : 1;

  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
      <path d="M15 2C8.4 2 3 7.4 3 14c0 9.5 12 22 12 22S27 23.5 27 14C27 7.4 21.6 2 15 2z"
        fill="${fill}" stroke="${ring}" stroke-width="2.5" opacity="${op}"/>
      <circle cx="15" cy="14" r="5.5" fill="${ring}" opacity="${op}"/>
    </svg>`,
    iconSize:    [30, 38],
    iconAnchor:  [15, 38],
    popupAnchor: [0, -40],
  });
}

const STATUS_COLORS = {
  planned:   'bg-sky-100 text-sky-700',
  active:    'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-400',
};

// ---- Auto-fit map bounds when projects change ----
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

// ---- Per-marker popup that loads plant details on open ----
function ProjectMarker({ project, onSeePhotos }) {
  const [open, setOpen] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['landscaping-project', project.id],
    queryFn: () => landscaping.getProject(project.id).then(r => r.data.project),
    enabled: open,
    staleTime: 60_000,
  });

  const plants = detail?.plants ?? [];
  const totalQty = plants.reduce((s, p) => s + (p.quantity || 0), 0);

  return (
    <Marker
      position={[project.lat, project.lng]}
      icon={makeIcon(project.type, project.status)}
      eventHandlers={{ popupopen: () => setOpen(true), popupclose: () => setOpen(false) }}
    >
      <Popup minWidth={220} maxWidth={300}>
        <div className="text-sm space-y-2 py-1">
          {/* Header */}
          <div>
            <div className="font-semibold text-forest-900 text-base leading-tight">{project.name}</div>
            {project.client_name && (
              <div className="text-forest-500 text-xs mt-0.5">{project.client_name}</div>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] || ''}`}>
              {project.status}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-forest-100 text-forest-600">
              {project.type === 'in_ground' ? <TreePine size={10} /> : <Briefcase size={10} />}
              {project.type === 'in_ground' ? 'In Ground' : 'Landscaping Job'}
            </span>
          </div>

          {/* Address */}
          {project.location && (
            <div className="flex items-start gap-1 text-forest-500 text-xs">
              <MapPin size={11} className="mt-0.5 flex-shrink-0" />
              <span>{project.location}</span>
            </div>
          )}

          {/* Plant list */}
          <div className="border-t border-forest-100 pt-2">
            {isLoading ? (
              <div className="text-forest-400 text-xs animate-pulse">Loading plants…</div>
            ) : plants.length === 0 ? (
              <div className="text-forest-300 text-xs">No plants added yet</div>
            ) : (
              <>
                <div className="text-forest-500 text-xs font-medium mb-1">
                  {totalQty} {totalQty === 1 ? 'plant' : 'plants'} · {plants.length} {plants.length === 1 ? 'entry' : 'entries'}
                </div>
                <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                  {plants.map(p => {
                    const name = p.variant?.plant?.common_name || p.variant?.plant?.scientific_name || '—';
                    const sci  = p.variant?.plant?.scientific_name;
                    return (
                      <li key={p.id} className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-forest-700 truncate">
                          {sci ? <em>{sci}</em> : name}
                        </span>
                        <span className="text-forest-400 flex-shrink-0">×{p.quantity}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          {/* Photo strip */}
          <div className="border-t border-forest-100 pt-2">
            <PhotoGallery
              projectId={project.id}
              compact
              enabled={open}
              onSeeAll={() => onSeePhotos(project)}
            />
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// ---- GeocodeButton — re-pin a project from the sidebar ----
function GeocodeButton({ project }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState('');

  const mutation = useMutation({
    mutationFn: () => landscaping.geocodeProject(project.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landscaping-map-projects'] });
      setMsg('Pinned!');
      setTimeout(() => setMsg(''), 3000);
    },
    onError: (e) => setMsg(e.response?.data?.error || 'Failed'),
  });

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        title="Re-geocode address"
        className="text-forest-400 hover:text-forest-700 disabled:opacity-40 transition-colors"
      >
        <RefreshCw size={13} className={mutation.isPending ? 'animate-spin' : ''} />
      </button>
      {msg && <span className="text-xs text-forest-500">{msg}</span>}
    </div>
  );
}

// ---- Sidebar project list ----
function Sidebar({ projects, filter, onFilterChange, selectedId, onSelect }) {
  const pinned   = projects.filter(p => p.lat && p.lng);
  const unpinned = projects.filter(p => !p.lat || !p.lng);

  return (
    <div className="w-72 flex-shrink-0 bg-white border-r border-forest-100 flex flex-col overflow-hidden">
      {/* Filters */}
      <div className="px-3 py-3 border-b border-forest-100 space-y-2">
        <div className="text-xs font-semibold text-forest-600 uppercase tracking-wide">Filter</div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: '',                label: 'All' },
            { key: 'in_ground',       label: 'In Ground' },
            { key: 'landscaping_job', label: 'Jobs' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => onFilterChange({ ...filter, type: f.key })}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter.type === f.key
                  ? 'bg-forest-700 text-white border-forest-700'
                  : 'border-forest-200 text-forest-600 hover:border-forest-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: '',          label: 'Any status' },
            { key: 'active',    label: 'Active' },
            { key: 'planned',   label: 'Planned' },
            { key: 'completed', label: 'Completed' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => onFilterChange({ ...filter, status: f.key })}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter.status === f.key
                  ? 'bg-forest-700 text-white border-forest-700'
                  : 'border-forest-200 text-forest-600 hover:border-forest-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {pinned.length > 0 && (
          <div>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-forest-400 bg-forest-50">
              On map · {pinned.length}
            </div>
            {pinned.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={`w-full text-left px-3 py-2.5 border-b border-forest-50 hover:bg-forest-50 transition-colors ${selectedId === p.id ? 'bg-forest-50 border-l-2 border-l-forest-600' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${p.type === 'in_ground' ? 'bg-green-600' : 'bg-blue-600'}`} />
                  <span className="font-medium text-sm text-forest-900 truncate">{p.name}</span>
                </div>
                {p.location && (
                  <div className="text-xs text-forest-400 mt-0.5 truncate pl-4">{p.location}</div>
                )}
                <div className="pl-4 mt-0.5">
                  <span className={`inline-flex text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || ''}`}>
                    {p.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {unpinned.length > 0 && (
          <div>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-forest-400 bg-forest-50 flex items-center gap-1.5">
              <AlertCircle size={11} className="text-amber-500" />
              No map pin · {unpinned.length}
            </div>
            {unpinned.map(p => (
              <div
                key={p.id}
                className="px-3 py-2.5 border-b border-forest-50 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 opacity-40 ${p.type === 'in_ground' ? 'bg-green-600' : 'bg-blue-600'}`} />
                    <span className="font-medium text-sm text-forest-700 truncate">{p.name}</span>
                  </div>
                  <GeocodeButton project={p} />
                </div>
                {p.location ? (
                  <div className="text-xs text-forest-400 mt-0.5 truncate pl-4">{p.location}</div>
                ) : (
                  <div className="text-xs text-amber-600 mt-0.5 pl-4">No address set</div>
                )}
              </div>
            ))}
          </div>
        )}

        {projects.length === 0 && (
          <div className="px-4 py-10 text-center text-forest-400 text-sm">
            No projects match this filter.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-3 py-3 border-t border-forest-100 space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-forest-400 mb-1">Legend</div>
        <div className="flex items-center gap-2 text-xs text-forest-600">
          <span className="w-3 h-3 rounded-full bg-green-600 flex-shrink-0" /> In Ground Location
        </div>
        <div className="flex items-center gap-2 text-xs text-forest-600">
          <span className="w-3 h-3 rounded-full bg-blue-700 flex-shrink-0" /> Landscaping Job
        </div>
        <div className="flex items-center gap-2 text-xs text-forest-400">
          <span className="w-3 h-3 rounded-full bg-slate-300 flex-shrink-0" /> Completed / Cancelled
        </div>
      </div>
    </div>
  );
}

// ---- Main page ----
export default function AdminJobMap() {
  const [filter, setFilter] = useState({ type: '', status: '' });
  const [selectedProject, setSelectedProject] = useState(null);
  const [photoProject, setPhotoProject] = useState(null);

  const { data: rawProjects = [], isLoading } = useQuery({
    queryKey: ['landscaping-map-projects'],
    queryFn: () => Promise.all([
      landscaping.listProjects({ type: 'in_ground'       }).then(r => r.data.projects),
      landscaping.listProjects({ type: 'landscaping_job' }).then(r => r.data.projects),
    ]).then(([a, b]) => [...a, ...b]),
    staleTime: 60_000,
  });

  const projects = useMemo(() => {
    return rawProjects.filter(p => {
      if (filter.type   && p.type   !== filter.type)   return false;
      if (filter.status && p.status !== filter.status) return false;
      return true;
    });
  }, [rawProjects, filter]);

  const mappable = projects.filter(p => p.lat && p.lng);
  const bounds   = mappable.map(p => [p.lat, p.lng]);

  // Default center — continental USA fallback
  const defaultCenter = [39.5, -98.35];
  const defaultZoom   = 4;

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        filter={filter}
        onFilterChange={setFilter}
        selectedId={selectedProject?.id}
        onSelect={setSelectedProject}
      />

      {/* Map */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-[1000]">
            <div className="text-forest-500 text-sm animate-pulse">Loading projects…</div>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {bounds.length > 0 && <FitBounds points={bounds} />}

          {mappable.map(project => (
            <ProjectMarker key={project.id} project={project} onSeePhotos={setPhotoProject} />
          ))}
        </MapContainer>

        {/* Empty state overlay */}
        {!isLoading && mappable.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-6 py-5 text-center max-w-xs">
              <MapPin size={32} className="mx-auto mb-2 text-forest-300" />
              <p className="text-forest-700 font-medium text-sm">No pins to show</p>
              <p className="text-forest-400 text-xs mt-1">
                {rawProjects.length === 0
                  ? 'Create an in-ground location or landscaping job with an address first.'
                  : 'Add an address to your projects — the pin will appear automatically.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Full gallery modal — opened from popup "See all" */}
      {photoProject && (
        <Modal
          title={`Photos — ${photoProject.name}`}
          onClose={() => setPhotoProject(null)}
          size="lg"
        >
          <PhotoGallery projectId={photoProject.id} />
        </Modal>
      )}
    </div>
  );
}
