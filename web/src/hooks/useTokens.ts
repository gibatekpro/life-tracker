import { useSyncExternalStore } from 'react';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const subscribe = (onChange: () => void) => {
  darkQuery.addEventListener('change', onChange);
  return () => darkQuery.removeEventListener('change', onChange);
};

// The current values of design tokens from index.css (e.g. 'chart-1' -> '#0f766e'), for charts:
// SVG fill attributes can't reliably use CSS variables. Re-renders when the system switches
// between light and dark mode, so charts follow the theme like everything else.
export function useTokens<K extends string>(names: readonly K[]): Record<K, string> {
  useSyncExternalStore(subscribe, () => darkQuery.matches);
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--color-${n}`).trim()])) as Record<K, string>;
}
