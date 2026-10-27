import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api';
import { useRefresh } from './refresh';

interface Loaded<T> {
  key: string;
  data?: T;
  error?: string;
  errorStatus?: number;
}

// As web/src/data/useData.ts: loads data for a screen and loads it again whenever `key` changes
// or anything calls refresh() (a save, pull-to-refresh, "Try again", a new API key).
//
// While it reloads, the previous data stays on screen and `loading` is true. A response that
// arrives after the key has moved on is ignored. errorStatus is the HTTP status when the API
// answered (401 = the API key is missing or wrong).
export function useData<T>(key: string, load: () => Promise<T>, enabled = true) {
  const { version } = useRefresh();
  const fullKey = `${key}#${version}`;

  // Always call the latest `load` without making it a dependency (it's a new function every render).
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [state, setState] = useState<Loaded<T> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    loadRef.current().then(
      (data) => { if (current) setState({ key: fullKey, data }); },
      (e: Error) => {
        if (current) {
          const errorStatus = e instanceof ApiError ? e.status : undefined;
          setState((s) => ({ key: fullKey, data: s?.data, error: e.message, errorStatus }));
        }
      },
    );
    return () => { current = false; };
  }, [fullKey, enabled]);

  const isCurrent = state?.key === fullKey;
  return {
    data: state?.data,
    error: isCurrent ? state.error : undefined,
    errorStatus: isCurrent ? state.errorStatus : undefined,
    loading: !isCurrent,
  };
}
