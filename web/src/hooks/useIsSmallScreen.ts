import { useSyncExternalStore } from 'react';

// Below Tailwind's `lg` breakpoint: where the layout switches to the bottom navbar.
const query = window.matchMedia('(max-width: 1023.98px)');
const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

// True on phones and narrow windows; re-renders when the window crosses the breakpoint.
export const useIsSmallScreen = () => useSyncExternalStore(subscribe, () => query.matches);
