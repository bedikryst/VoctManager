/**
 * @file main.tsx
 * @description Application entry point. Bootstraps React, Context Providers, Data Query Client, and routing.
 * @architecture Enterprise 2026 Standards
 * @module core/main
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { AuthProvider } from "./app/providers/AuthProvider";
import {
  createQueryPersister,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE_MS,
} from "./shared/api/queryPersistence";
import { registerOfflineServiceWorker } from "./shared/offline/offlineClient";
import { i18nReady } from "./shared/config/i18n";
import { router } from "./app/App";
import "./app/styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reconcile after the user comes back to the tab or regains signal. This
      // is how a server-side change made in another session (an AI-created
      // composer, a new divisi assignment) propagates without a logout — the
      // persisted snapshot still paints instantly; the refetch happens in the
      // background. Static dictionaries opt out via their 24h staleTime (a
      // non-stale query is not refetched on focus). Volatile read-models add
      // `refetchOnMount: "always"` (see shared/api/queryPolicy) so a reload —
      // which restores the snapshot's original `dataUpdatedAt` — reconciles too.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Must be >= the persister's maxAge so restored snapshots aren't
      // immediately garbage-collected (offline-first requirement).
      gcTime: QUERY_CACHE_MAX_AGE_MS,
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

const persister = createQueryPersister();

const rootElement = document.getElementById("root")!;

const renderApp = (): void => {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: QUERY_CACHE_MAX_AGE_MS,
        buster: QUERY_CACHE_BUSTER,
        dehydrateOptions: {
          // Binary payloads (PDF/score blobs from the in-app viewer) do NOT
          // survive JSON serialization — they rehydrate from localStorage as
          // `{}` and detonate consumers like URL.createObjectURL ("Overload
          // resolution failed"). Never persist them; the viewer refetches the
          // blob on demand anyway (and they'd blow the localStorage quota).
          shouldDehydrateQuery: (query) => {
            // Explicit opt-out for heavy, immutable-per-fetch payloads that have
            // no offline value and would blow the localStorage quota — e.g. the
            // build-cockpit page thumbnails (base64 WebP strips, refetched on
            // demand and server-cached by content hash anyway).
            if (query.meta?.persist === false) {
              return false;
            }
            const data = query.state.data;
            if (data instanceof Blob || data instanceof ArrayBuffer) {
              return false;
            }
            // Never persist infinite-query caches. Their `{ pages, pageParams }`
            // shape is read by TanStack internals (`getNextPageParam` does
            // `data.pages.length`) the moment the observer mounts — before any
            // `select` guard runs — so restoring a snapshot whose shape no
            // longer matches the current query detonates the whole app. The
            // only infinite query here is the polled notifications inbox, which
            // has negligible offline value; let it refetch fresh instead.
            if (
              data !== null &&
              typeof data === "object" &&
              Array.isArray((data as { pages?: unknown }).pages) &&
              Array.isArray((data as { pageParams?: unknown }).pageParams)
            ) {
              return false;
            }
            return defaultShouldDehydrateQuery(query);
          },
        },
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
  );
};

// Hold first paint until the active locale bundle is registered, so the opening
// render already has its translations (no missing-key flash). A locale load
// failure must never block boot — render regardless.
void i18nReady.then(renderApp, renderApp);

// Register the offline service worker for everyone after first paint, so the
// PWA can boot and practice offline regardless of push-notification consent.
void registerOfflineServiceWorker();
