import { ChevronDown, ChevronRight, ChevronsUpDown, ArrowUpDown } from 'lucide-react';

export function SortHeader({ label, col, sortCol, sortDir, onSort, className = '' }) {
  const active = sortCol === col;
  return (
    <th
      className={`px-4 py-3 font-medium text-forest-600 cursor-pointer select-none hover:text-forest-900 transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'asc'
            ? <ChevronDown size={13} className="text-forest-500" />
            : <ChevronRight size={13} className="text-forest-500 -rotate-90" />
          : <ChevronsUpDown size={12} className="text-forest-300" />}
      </span>
    </th>
  );
}

export function MultiSortBar({ columns, sortCol, sort2Col, setSort2Col, sort2Dir, setSort2Dir }) {
  const opts = columns.filter(c => c.value !== sortCol);
  return (
    <div className="flex items-center gap-2">
      <span className="text-forest-500 text-xs shrink-0">Then by:</span>
      <select
        value={sort2Col}
        onChange={e => { setSort2Col(e.target.value); }}
        className="select text-xs py-1 h-8 min-w-[130px]"
      >
        <option value="">— none —</option>
        {opts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      {sort2Col && (
        <button
          onClick={() => setSort2Dir(d => d === 'asc' ? 'desc' : 'asc')}
          className="btn-ghost px-2 py-1 h-8 text-xs flex items-center gap-1 text-forest-600"
          title="Toggle secondary sort direction"
        >
          <ArrowUpDown size={12} />
          {sort2Dir === 'asc' ? 'A→Z' : 'Z→A'}
        </button>
      )}
    </div>
  );
}
