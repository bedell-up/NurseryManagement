import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobPhotos, photoUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Upload, Trash2, ChevronLeft, ChevronRight, X, Pencil, Check, ImageIcon, Images } from 'lucide-react';

// ---- Lightbox ----
function Lightbox({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const photo = photos[idx];

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(photos.length - 1, i + 1)), [photos.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft')   prev();
      if (e.key === 'ArrowRight')  next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Nav prev */}
      {idx > 0 && (
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-10"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Photo */}
      <div className="flex flex-col items-center max-w-5xl max-h-screen p-4 pointer-events-none">
        <img
          src={photoUrl(photo.id)}
          alt={photo.caption || photo.original_name || ''}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl pointer-events-auto"
          onClick={e => e.stopPropagation()}
        />
        {photo.caption && (
          <p className="mt-3 text-white/80 text-sm text-center max-w-lg">{photo.caption}</p>
        )}
        <p className="mt-1 text-white/40 text-xs">{idx + 1} / {photos.length}</p>
      </div>

      {/* Nav next */}
      {idx < photos.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-10"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
      >
        <X size={20} />
      </button>
    </div>
  );
}

// ---- Main component ----
// compact=true  → shows first 3 thumbnails + "See all" button (no upload/delete, view only)
// compact=false → full grid with upload, delete, caption editing

export default function PhotoGallery({
  projectId,
  compact    = false,
  onSeeAll   = null,   // compact mode: called when "See all" clicked
  enabled    = true,   // control when to fetch (use false when popup is closed)
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isManager = ['admin', 'manager'].includes(user?.role);

  const fileInputRef = useRef(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null); // 0–100 or null
  const [uploadError, setUploadError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['job-photos', projectId],
    queryFn: () => jobPhotos.list(projectId).then(r => r.data.photos),
    enabled: enabled && !!projectId,
    staleTime: 60_000,
  });

  const photos       = data ?? [];
  const displayPhotos = compact ? photos.slice(0, 3) : photos;

  // ---- Upload ----
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadError('');
    setUploadProgress(0);
    try {
      await jobPhotos.upload(projectId, files, (ev) => {
        if (ev.total) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      });
      qc.invalidateQueries({ queryKey: ['job-photos', projectId] });
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  // ---- Delete ----
  const deleteMutation = useMutation({
    mutationFn: (id) => jobPhotos.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-photos', projectId] }),
  });

  // ---- Caption ----
  const captionMutation = useMutation({
    mutationFn: ({ id, caption }) => jobPhotos.updateCaption(id, caption),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-photos', projectId] });
      setEditingId(null);
    },
  });

  const startEditCaption = (photo) => {
    setEditingId(photo.id);
    setCaptionDraft(photo.caption || '');
  };

  const saveCaption = (id) => {
    captionMutation.mutate({ id, caption: captionDraft.trim() || null });
  };

  // ---- Compact mode ----
  if (compact) {
    if (isLoading) return <div className="text-xs text-gray-400 animate-pulse py-1">Loading photos…</div>;
    if (photos.length === 0) return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 py-1">
        <ImageIcon size={12} /> No photos yet
      </div>
    );

    return (
      <div>
        <div className="flex gap-1.5 mt-1">
          {displayPhotos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setLightboxIndex(i)}
              className="w-[70px] h-[70px] rounded overflow-hidden flex-shrink-0 border border-gray-200 hover:opacity-90 transition-opacity"
            >
              <img
                src={photoUrl(photo.id)}
                alt={photo.caption || ''}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
          {photos.length > 3 && (
            <div className="w-[70px] h-[70px] rounded bg-gray-100 flex flex-col items-center justify-center flex-shrink-0 border border-gray-200">
              <span className="text-gray-500 font-semibold text-sm">+{photos.length - 3}</span>
            </div>
          )}
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="mt-2 text-xs text-forest-600 hover:text-forest-800 font-medium flex items-center gap-1 transition-colors"
          >
            <Images size={12} />
            {photos.length === 1 ? 'See 1 photo' : `See all ${photos.length} photos`}
          </button>
        )}

        {lightboxIndex !== null && (
          <Lightbox photos={photos} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
        )}
      </div>
    );
  }

  // ---- Full mode ----
  return (
    <div>
      {/* Upload bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadProgress !== null}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <Upload size={14} />
          {uploadProgress !== null ? `Uploading ${uploadProgress}%…` : 'Add Photos'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        {uploadProgress !== null && (
          <div className="flex-1 h-1.5 bg-forest-100 rounded-full overflow-hidden max-w-[160px]">
            <div
              className="h-full bg-forest-600 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
        {uploadError && <p className="text-red-600 text-xs">{uploadError}</p>}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded bg-forest-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && photos.length === 0 && (
        <div className="py-10 text-center border-2 border-dashed border-forest-200 rounded-lg">
          <ImageIcon size={28} className="mx-auto mb-2 text-forest-300" />
          <p className="text-forest-400 text-sm">No photos yet</p>
          <p className="text-forest-300 text-xs mt-1">Click "Add Photos" to upload images</p>
        </div>
      )}

      {/* Photo grid */}
      {!isLoading && photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.map((photo, i) => (
            <div key={photo.id} className="group relative">
              {/* Thumbnail */}
              <button
                onClick={() => setLightboxIndex(i)}
                className="block w-full aspect-square rounded-lg overflow-hidden border border-forest-100 hover:border-forest-300 transition-colors"
              >
                <img
                  src={photoUrl(photo.id)}
                  alt={photo.caption || photo.original_name || ''}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </button>

              {/* Delete button (managers+) */}
              {isManager && (
                <button
                  onClick={() => deleteMutation.mutate(photo.id)}
                  disabled={deleteMutation.isPending}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Delete photo"
                >
                  <Trash2 size={12} />
                </button>
              )}

              {/* Caption */}
              <div className="mt-1 px-0.5">
                {editingId === photo.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      className="flex-1 text-xs border border-forest-300 rounded px-1.5 py-0.5 min-w-0"
                      value={captionDraft}
                      onChange={e => setCaptionDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  saveCaption(photo.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      placeholder="Add caption…"
                      maxLength={200}
                    />
                    <button
                      onClick={() => saveCaption(photo.id)}
                      disabled={captionMutation.isPending}
                      className="text-forest-600 hover:text-forest-800 flex-shrink-0"
                    >
                      <Check size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditCaption(photo)}
                    className="flex items-center gap-1 text-left w-full group/cap"
                    title="Click to add/edit caption"
                  >
                    <span className={`text-xs truncate ${photo.caption ? 'text-forest-600' : 'text-forest-300 italic'}`}>
                      {photo.caption || 'Add caption…'}
                    </span>
                    <Pencil size={10} className="flex-shrink-0 text-forest-300 opacity-0 group-hover/cap:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox photos={photos} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
