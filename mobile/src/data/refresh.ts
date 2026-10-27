import { createContext, useContext } from 'react';

// A version number shared by the whole app. Saving anything calls refresh(), the version goes
// up, and every useData on screen loads again, so a payment made on one page updates the
// totals everywhere without each page having to know about the others.
export interface RefreshState {
  version: number;
  refresh: () => void;
}

export const RefreshContext = createContext<RefreshState>({ version: 0, refresh: () => {} });

export const useRefresh = () => useContext(RefreshContext);
