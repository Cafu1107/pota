import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';
import { del, get, set } from 'idb-keyval';

// Last-known data lives in IndexedDB so a return visit paints instantly and
// refreshes in the background. Live game detail is never persisted.
const PERSISTED = new Set(['games', 'standings', 'teams', 'leaders', 'schedule', 'team', 'player', 'news']);

export const CACHE_BUSTER = 'pota-v2';
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const persister = createAsyncStoragePersister({
  key: 'pota-query-cache',
  throttleTime: 2000,
  storage: {
    getItem: async (k: string) => {
      try {
        return ((await get(k)) as string | undefined) ?? null;
      } catch {
        return null;
      }
    },
    setItem: async (k: string, v: string) => {
      try {
        await set(k, v);
      } catch {
        /* storage unavailable or full: run without persistence */
      }
    },
    removeItem: async (k: string) => {
      try {
        await del(k);
      } catch {
        /* ignore */
      }
    },
  },
});

export function shouldPersist(q: Query): boolean {
  return q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0]));
}
