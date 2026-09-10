import { useCallback, useEffect, useState } from 'react';

/**
 * State that survives a reload.
 *
 * Layout choices - how tall the timeline is, whether a side panel is open -
 * are decisions the user makes once and expects to keep. Resetting them on
 * every reload turns a preference into a chore.
 *
 * Reads and writes are wrapped: localStorage throws outright in a few real
 * situations (Safari private browsing, storage disabled by policy, quota
 * exhausted), and a layout preference is never worth taking the editor down
 * for. On failure this behaves exactly like ordinary useState.
 */
export function usePersisted<T>(key: string, fallback: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw) as unknown;
      // A stored value of the wrong shape - an older build, or hand-editing -
      // must not poison the layout. typeof is enough here: every caller stores
      // a number or a boolean.
      return typeof parsed === typeof fallback ? (parsed as T) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* not worth surfacing - the session still works, it just will not persist */
    }
  }, [key, value]);

  const set = useCallback((next: T) => setValue(next), []);
  return [value, set];
}
