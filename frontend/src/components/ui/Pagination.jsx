import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, total, limit, onPage }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-forest-600 mt-4">
      <span>{total} total &bull; page {page} of {totalPages}</span>
      <div className="flex gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="btn-secondary px-2 py-1 text-xs">
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
          return (
            <button key={p} onClick={() => onPage(p)}
              className={`btn px-3 py-1 text-xs ${p === page ? 'bg-forest-600 text-white' : 'bg-white border border-forest-200 text-forest-700 hover:bg-forest-50'}`}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="btn-secondary px-2 py-1 text-xs">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
