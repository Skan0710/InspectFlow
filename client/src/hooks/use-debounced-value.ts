import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has stopped changing for `delayMs`.
 * Used so search boxes do not fire one network request per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
