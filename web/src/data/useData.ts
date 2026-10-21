import { useEffect, useRef, useState } from 'react';
import { useRefresh } from './refresh';

interface Loaded<T> {
  key: string;
  data?: T;
  error?: string;
}

// Loads data for a screen and loads it again whenever `key` changes (e.g. a different month)
// or anything in the app is saved (see refresh.ts).
//
// While it reloads, the previous data stays on screen and `loading` is true, so pages
// don't flash empty. A response that arrives after the key has moved on is ignored.
export function useData<T>(key: string, load: () => Promise<T>) {
  const { version } = useRefresh();
  const fullKey = `${key}#${version}`;

  // Always call the latest `load` without making it a dependency (it's a new function every render).
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [state, setState] = useState<Loaded<T> | null>(null);

  useEffect(() => {
    let current = true;
    loadRef.current().then(
      (data) => { if (current) setState({ key: fullKey, data }); },
      (e: Error) => { if (current) setState((s) => ({ key: fullKey, data: s?.data, error: e.message })); },
    );
    return () => { current = false; };
  }, [fullKey]);

  return {
    data: state?.data,
    error: state?.key === fullKey ? state.error : undefined,
    loading: state?.key !== fullKey,
  };
}
