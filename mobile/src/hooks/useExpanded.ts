import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const storageKey = (page: string) => `lifetracker.expanded.${page}`;

// Which rows of a collapsible tree are open on a screen, remembered between visits (web: useExpanded,
// in localStorage). AsyncStorage is React Native's key-value store; it's asynchronous, so rows start
// closed until the saved ones load. Failures are ignored: the tree works the same without them.
export function useExpanded(page: string) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    let current = true;
    AsyncStorage.getItem(storageKey(page)).then(
      (saved) => { if (current && saved) setOpen(new Set(JSON.parse(saved) as number[])); },
      () => {},
    );
    return () => { current = false; };
  }, [page]);

  function toggle(id: number) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpen(next);
    AsyncStorage.setItem(storageKey(page), JSON.stringify([...next])).catch(() => {});
  }

  return { isOpen: (id: number) => open.has(id), toggle };
}
