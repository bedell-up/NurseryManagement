import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plants as plantsApi } from '../../api/client';
import { GitMerge, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Confirm from '../../components/ui/Confirm';

function GroupCard({ group, onMerged }) {
  const qc = useQueryClient();
  const [keepIdx, setKeepIdx] = useState(() => {
    // Default: keep the one with more variants/inventory
    let best = 0;
    for (let i = 1; i < group.ids.length; i++) {
      const aVar = parseInt(group.variant_counts[i], 10);
      const bVar = parseInt(group.variant_counts[best], 10);
      if (aVar > bVar) best = i;
    }
    return best;
  });
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: ({ keep_id, drop_ids }) =>
      Promise.all(drop_ids.map(drop_id => plantsApi.merge({ keep_id, drop_id }).then(r => r.data))),
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ['plant-duplicates'] });
      onMerged?.();
    },
  });

  if (done) return null;

  const keepId   = group.ids[keepIdx];
  const dropIds  = group.ids.filter((_, i) => i !== keepIdx);

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <span className="text-xs font-semibold text-forest-500 uppercase tracking-wide">
            {group.genus} {group.species}
          </span>
          <p className="text-sm text-forest-400 mt-0.5">
            {group.ids.length} duplicate entries · select which to keep
          </p>
        </div>
        <button
          onClick={() => setConfirm(true)}
          disabled={mutation.isPending}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <GitMerge size={14} />
          {mutation.isPending ? 'Merging…' : 'Merge'}
        </button>
      </div>

      <div className="space-y-2">
        {group.ids.map((id, i) => {
          const isKeep = i === keepIdx;
          const variantCount = parseInt(group.variant_counts[i], 10);
          const invTotal = parseInt(group.inv_totals[i], 10);
          return (
            <label
              key={id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isKeep
                  ? 'border-forest-500 bg-forest-50'
                  : 'border-forest-100 hover:border-forest-300'
              }`}
            >
              <input
                type="radio"
                name={`keep-${group.genus}-${group.species}`}
                checked={isKeep}
                onChange={() => setKeepIdx(i)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-forest-900">{group.names[i]}</p>
                {group.scientific_names[i] && group.scientific_names[i] !== `${group.genus} ${group.species}` && (
                  <p className="text-xs italic text-forest-400">{group.scientific_names[i]}</p>
                )}
                <div className="flex gap-4 mt-1 text-xs text-forest-500">
                  <span>{variantCount} variant{variantCount !== 1 ? 's' : ''}</span>
                  <span>{invTotal} on hand</span>
                  {isKeep && <span className="font-semibold text-forest-600">← keep this one</span>}
                  {!isKeep && <span className="text-forest-400">← merge into kept entry</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {mutation.isError && (
        <p className="text-red-500 text-xs mt-2">{mutation.error?.response?.data?.error || 'Merge failed'}</p>
      )}

      {confirm && (
        <Confirm
          title="Merge Plant Entries"
          message={`Merge all variants and data from "${group.names.filter((_, i) => i !== keepIdx).join(', ')}" into "${group.names[keepIdx]}"? The other ${dropIds.length > 1 ? 'entries' : 'entry'} will be deactivated.`}
          onConfirm={() => { setConfirm(false); mutation.mutate({ keep_id: keepId, drop_ids: dropIds }); }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

export default function AdminPlantMerge() {
  const { data, isLoading } = useQuery({
    queryKey: ['plant-duplicates'],
    queryFn:  () => plantsApi.duplicates().then(r => r.data),
    staleTime: 0,
  });

  const groups = data?.groups ?? [];

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-forest-900">Merge Duplicate Plants</h1>
        <p className="text-forest-500 text-sm mt-0.5">
          These plant entries share the same genus and species. Select which listing to keep — all variants, inventory, and history from the others will be moved into it.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="card p-5 h-32 animate-pulse bg-forest-50" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={32} className="mx-auto mb-3 text-green-500" />
          <p className="font-medium text-forest-700">No duplicate plant entries found.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-forest-500 mb-4">{groups.length} group{groups.length !== 1 ? 's' : ''} to review</p>
          {groups.map(g => (
            <GroupCard key={`${g.genus}-${g.species}-${g.cultivar ?? ''}`} group={g} />
          ))}
        </>
      )}
    </div>
  );
}
