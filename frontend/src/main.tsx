/**
 * @file main.tsx
 * @description Application entry point. Bootstraps React, Context Providers, Data Query Client, and routing.
 * @architecture Enterprise 2026 Standards
 * @module core/main
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { CursorProvider } from "./app/providers/CursorProvider";
import { AuthProvider } from "./app/providers/AuthProvider";
import {
  createQueryPersister,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE_MS,
} from "./shared/api/queryPersistence";
import "./shared/config/i18n";
import { router } from "./app/App";
import "./app/styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
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

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: QUERY_CACHE_MAX_AGE_MS,
        buster: QUERY_CACHE_BUSTER,
      }}
    >
      <CursorProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </CursorProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
