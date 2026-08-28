/**
 * @file queryPersistence.ts
 * @description Offline-first query cache persistence. Choristers open the
 * panel on the way to rehearsal — trains, church basements, no signal. The
 * last successful snapshot of every query is restored instantly from storage
 * instead of greeting them with a spinner.
 *
 * The store is IndexedDB, not localStorage, because the WRITE is the cost here
 * and the read is not. A manager's dehydrated cache measures ~320 KB, and
 * `localStorage.setItem` of a string that size is synchronous disk I/O on the
 * main thread — repeated every `throttleTime` for as long as the cache stays
 * dirty, i.e. through the whole of an active session. An IndexedDB write
 * resolves off-thread; only the `JSON.stringify` remains, and that is single
 * -digit milliseconds at this size.
 *
 * Serialization stays JSON rather than letting structured clone carry the
 * object: the restored shape is then byte-identical to what the sync persister
 * produced, so nothing downstream has to learn that a `Date` can now survive a
 * reload as a `Date`.
 */
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

/**
 * Legacy localStorage key. Still read once (see `readLegacySnapshot`) and
 * cleared on the first successful IndexedDB write, so the deploy that moved
 * the store does not strand a user who opens the updated shell with no signal.
 */
export const QUERY_CACHE_STORAGE_KEY = "voctmanager-query-cache";

const IDB_NAME = "voctmanager-query-cache";
const IDB_STORE = "snapshots";
const IDB_KEY = "client";

/**
 * Bump to invalidate persisted snapshots after breaking cache-shape changes.
 *
 * 2026-06-infinite-notifications: the notifications inbox (`["notifications",
 * "list"]`) changed from a plain `useQuery` array to a `useInfiniteQuery`
 * (`{ pages, pageParams }`). Returning users had the old array persisted under
 * the same key; restoring it into the new InfiniteQueryObserver crashed the
 * whole app inside TanStack's `getNextPageParam` (`data.pages.length` on an
 * array with no `.pages`). Bumping the buster evicts those stale snapshots.
 *
 * NOT bumped for the 2026-08 move to IndexedDB: the payload's shape is
 * unchanged, and a bump would discard the legacy snapshot this store migrates.
 */
export const QUERY_CACHE_BUSTER = "2026-06-infinite-notifications";

export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Structural mirror of TanStack's `AsyncStorage<string>`. Declared here rather
 * than imported: the type lives in `@tanstack/query-persist-client-core`, which
 * this package depends on transitively and `package.json` does not name.
 */
interface AsyncStringStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const openDatabase = (): Promise<IDBDatabase> => {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // A concurrent tab holding an older version open. Nothing to recover from
    // — the caller degrades to localStorage for this session.
    request.onblocked = () => reject(request.error);
  });
  return dbPromise;
};

/**
 * Resolves on transaction completion, not on request success: an IndexedDB
 * write is only durable once its transaction commits, and a logout that clears
 * the store has to be able to await exactly that.
 */
const runInStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, mode);
    const request = operation(transaction.objectStore(IDB_STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
};

const hasIndexedDb = (): boolean =>
  typeof window !== "undefined" && !!window.indexedDB;

/**
 * The one-time bridge off localStorage. A PWA can boot its updated shell from
 * the service worker with no signal at all, so the release that moves the store
 * must not be the release that hands a chorister an empty panel: if IndexedDB
 * has nothing yet, the old snapshot still answers the restore.
 */
const readLegacySnapshot = (): string | null => {
  try {
    return window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const dropLegacySnapshot = (): void => {
  try {
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    /* storage disabled — nothing to drop */
  }
};

/**
 * IndexedDB with localStorage as the floor. Every failure path degrades to the
 * behaviour this file had before the move rather than to no persistence at all:
 * a browser that refuses IndexedDB (private windows in some engines, storage
 * switched off) still gets its offline snapshot, just at the old cost.
 */
const snapshotStorage: AsyncStringStorage = {
  getItem: async (key) => {
    if (hasIndexedDb()) {
      try {
        const stored = await runInStore<string | undefined>(
          "readonly",
          (store) => store.get(key),
        );
        if (typeof stored === "string") return stored;
      } catch {
        /* fall through to the legacy read */
      }
    }
    return readLegacySnapshot();
  },

  setItem: async (key, value) => {
    if (hasIndexedDb()) {
      try {
        await runInStore("readwrite", (store) => store.put(value, key));
        dropLegacySnapshot();
        return;
      } catch {
        /* fall through to the synchronous write */
      }
    }
    try {
      window.localStorage.setItem(QUERY_CACHE_STORAGE_KEY, value);
    } catch {
      /* quota or disabled storage — the cache simply does not survive reload */
    }
  },

  removeItem: async (key) => {
    dropLegacySnapshot();
    if (!hasIndexedDb()) return;
    try {
      await runInStore("readwrite", (store) => store.delete(key));
    } catch {
      /* nothing readable to clear */
    }
  },
};

export const createQueryPersister = () =>
  createAsyncStoragePersister({
    storage: snapshotStorage,
    key: IDB_KEY,
    throttleTime: 2000,
  });

/**
 * Awaited by logout before it navigates: on a shared device the next person
 * must not find the previous one's snapshot, and an IndexedDB delete that is
 * merely started is a delete that a hard navigation can still abort.
 */
export const clearPersistedQueryCache = async (): Promise<void> => {
  await snapshotStorage.removeItem(IDB_KEY);
};
