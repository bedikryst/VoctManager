/**
 * @file queryPersistence.ts
 * @description Offline-first query cache persistence. Choristers open the
 * panel on the way to rehearsal — trains, church basements, no signal. The
 * last successful snapshot of every query is restored instantly from
 * localStorage instead of greeting them with a spinner.
 */
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const QUERY_CACHE_STORAGE_KEY = "voctmanager-query-cache";

/**
 * Bump to invalidate persisted snapshots after breaking cache-shape changes.
 *
 * 2026-06-infinite-notifications: the notifications inbox (`["notifications",
 * "list"]`) changed from a plain `useQuery` array to a `useInfiniteQuery`
 * (`{ pages, pageParams }`). Returning users had the old array persisted under
 * the same key; restoring it into the new InfiniteQueryObserver crashed the
 * whole app inside TanStack's `getNextPageParam` (`data.pages.length` on an
 * array with no `.pages`). Bumping the buster evicts those stale snapshots.
 */
export const QUERY_CACHE_BUSTER = "2026-06-infinite-notifications";

export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const createQueryPersister = () =>
  createSyncStoragePersister({
    storage: window.localStorage,
    key: QUERY_CACHE_STORAGE_KEY,
    throttleTime: 2000,
  });

export const clearPersistedQueryCache = (): void => {
  window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
};
