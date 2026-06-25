/**
 * @file queryPolicy.ts
 * @description Single source of truth for cache-freshness policy and the
 * cross-feature "personal read-model" keys.
 *
 * The panel persists its entire query cache to localStorage for 24h
 * (see `queryPersistence.ts`) so choristers get an instant, spinner-free paint
 * on the way to rehearsal — train, church basement, no signal. The catch: a
 * restored snapshot keeps its original `dataUpdatedAt`, so with a positive
 * `staleTime` the cache still considers it "fresh" after a reload and never
 * reconciles. That is why a server-side change (an AI-created composer, a new
 * divisi assignment) used to surface only after the persisted cache aged out or
 * a logout wiped it.
 *
 * Resolution — stale-while-revalidate. Offline-first paint and freshness are
 * NOT in conflict: keep persisting (instant paint from the snapshot) AND, for
 * any data that can change server-side, always kick a background refetch on
 * mount plus on window-focus / reconnect. The snapshot is shown immediately and
 * silently replaced when the network answers. Static dictionaries opt out — a
 * 24h cache is the whole point there, and their writers invalidate explicitly.
 *
 * @architecture Enterprise SaaS 2026
 * @module shared/api/queryPolicy
 */

import type { QueryClient } from "@tanstack/react-query";

/**
 * Freshness tier for any read-model that can change server-side (including by
 * another user). Spread into the query options; each query keeps its own tuned
 * `staleTime` (which still governs focus-refetch frequency), while
 * `refetchOnMount: "always"` guarantees a reload reconciles from the persisted
 * snapshot regardless of how fresh the cache believes it to be.
 *
 * Do NOT spread this into binary/blob queries (e.g. the PDF viewer) — those set
 * `staleTime: Infinity` deliberately, and `refetchOnMount: "always"` would
 * re-download the blob on every mount.
 */
export const RECONCILING_REFETCH = {
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;

/**
 * Personal, server-joined read-models that several features write into
 * indirectly. They live in their own feature namespaces (materials / schedule),
 * but project-side mutations (casting, participation, rehearsals) change what
 * they return — so those mutations must be able to invalidate them without an
 * illegal feature↔feature import. This shared registry is the seam: both the
 * owning feature and the writing feature point here.
 *
 * Note: invalidating these only reconciles caches in the *current* session. The
 * common case — a manager casting a chorister who is looking at their own
 * device — is carried across sessions by `RECONCILING_REFETCH` on the dashboards
 * themselves (refetch on the chorister's next mount / focus).
 */
export const PERSONAL_READMODEL_KEYS = {
  materialsDashboard: ["materials", "dashboard"] as const,
  scheduleDashboard: ["schedule", "dashboard"] as const,
};

/**
 * Mark the chorister's personal read-models (their Materials program and their
 * Schedule) stale after a project-side change that alters their membership or
 * casting. A no-op for queries not currently mounted; the dashboards' own
 * `RECONCILING_REFETCH` carries the change to other sessions on next focus.
 */
export const invalidatePersonalReadModels = (
  queryClient: QueryClient,
): void => {
  void queryClient.invalidateQueries({
    queryKey: PERSONAL_READMODEL_KEYS.materialsDashboard,
  });
  void queryClient.invalidateQueries({
    queryKey: PERSONAL_READMODEL_KEYS.scheduleDashboard,
  });
};
