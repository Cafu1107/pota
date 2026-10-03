import { useSyncExternalStore } from 'react';

/**
 * Tiny persisted store: per-viewer preferences live in localStorage, which can
 * be missing or throw (private mode, blocked storage), so every access is guarded.
 */
export function createStore<T extends object>(key: string, initial: T) {
  let state: T = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable: keep defaults */
  }
  const listeners = new Set<() => void>();

  const get = () => state;
  const set = (patch: Partial<T> | ((s: T) => Partial<T>)) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  function useStore(): T;
  function useStore<S>(selector: (s: T) => S): S;
  function useStore<S>(selector?: (s: T) => S) {
    return useSyncExternalStore(subscribe, () => (selector ? selector(state) : state));
  }
  return { get, set, subscribe, useStore };
}
