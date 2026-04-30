import { useState } from 'react';

export function useMultiSort(initialCol, initialDir = 'asc') {
  const [sortCol, setSortCol] = useState(initialCol);
  const [sortDir, setSortDir] = useState(initialDir);
  const [sort2Col, setSort2Col] = useState('');
  const [sort2Dir, setSort2Dir] = useState('asc');

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  return { sortCol, sortDir, sort2Col, setSort2Col, sort2Dir, setSort2Dir, handleSort };
}

export function applyMultiSort(rows, sortCol, sortDir, sort2Col, sort2Dir, getVal) {
  return [...rows].sort((a, b) => {
    const c1 = cmpVals(getVal(a, sortCol), getVal(b, sortCol), sortDir);
    if (c1 !== 0 || !sort2Col) return c1;
    return cmpVals(getVal(a, sort2Col), getVal(b, sort2Col), sort2Dir);
  });
}

function cmpVals(va, vb, dir) {
  if (va == null && vb == null) return 0;
  if (va == null) return 1;   // nulls sort last
  if (vb == null) return -1;
  const c = typeof va === 'number' && typeof vb === 'number'
    ? va - vb
    : String(va).localeCompare(String(vb));
  return dir === 'asc' ? c : -c;
}
