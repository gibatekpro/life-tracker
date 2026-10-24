import { useState } from 'react';

const storageKey = (page: string) => `lifetracker.expanded.${page}`;

// Storage can be missing or throw (private browsing, blocked storage), so every access is guarded
// and the page works the same without it: rows just start closed.
function load(page: string): Set<number> {
  try {
    const saved = window.localStorage.getItem(storageKey(page));
    return new Set(saved ? (JSON.parse(saved) as number[]) : []);
  } catch {
    return new Set();
  }
}

function save(page: string, open: Set<number>) {
  try {
    window.localStorage.setItem(storageKey(page), JSON.stringify([...open]));
  } catch {
    // Not saved this time; it still works for this visit.
  }
}

// Which rows of a collapsible tree are open on a page, remembered between visits.
export function useExpanded(page: string) {
  const [open, setOpen] = useState(() => load(page));

  function toggle(id: number) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpen(next);
    save(page, next);
  }

  return { isOpen: (id: number) => open.has(id), toggle };
}
