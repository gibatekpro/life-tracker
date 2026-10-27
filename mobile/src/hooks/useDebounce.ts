import { useEffect, useState } from 'react';

// The value, once it has stopped changing for `delay` ms (as the web's useDebounce): typing a what-if
// payment asks the API once, not on every keystroke.
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id); // a new keystroke cancels the pending update
  }, [value, delay]);
  return debounced;
}
