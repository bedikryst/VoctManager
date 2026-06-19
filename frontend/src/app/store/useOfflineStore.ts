/**
 * @file useOfflineStore.ts
 * @description Durable offline state for the chorister, persisted to localStorage
 * so it survives reloads, tab death and — the whole point — being closed on the
 * train with no signal.
 *
 * Holds two things:
 *  1. Download manifests — which concerts the chorister explicitly pulled down
 *     for offline practice, and exactly which asset URLs back them (for precise
 *     eviction). Live download progress is kept here too, but ephemerally.
 *  2. The write queue — readiness/attendance taps made while offline, replayed
 *     in order once the network returns ([[reference_backend_test_db_workflow]]
 *     is server-side; this is the client mirror).
 *
 * @architecture Enterprise SaaS 2026
 * @module store/useOfflineStore
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type OfflineDownloadStatus =
  | "idle"
  | "downloading"
  | "ready"
  | "partial"
  | "error";

/** A concert the chorister pulled down for offline practice. */
export interface OfflineProjectManifest {
  projectId: string;
  title: string;
  /** Every cached asset URL, so eviction can be surgical. */
  assetUrls: string[];
  assetCount: number;
  failed: number;
  cachedAt: number;
}

export interface OfflineDownloadProgress {
  status: OfflineDownloadStatus;
  done: number;
  total: number;
  failed: number;
}

export type OfflineWriteKind = "readiness" | "attendance";

/** A deferred mutation captured while offline, replayed verbatim on reconnect. */
export interface QueuedWrite {
  id: string;
  kind: OfflineWriteKind;
  method: "PUT" | "PATCH" | "POST";
  url: string;
  body: unknown;
  /** Repeated writes to the same target collapse to the latest intent. */
  dedupeKey: string;
  /** Human label for the sync indicator ("Gotowość: Ave Maria"). */
  label: string;
  createdAt: number;
}

interface OfflineState {
  // ── persisted ──────────────────────────────────────────────────────────────
  manifests: Record<string, OfflineProjectManifest>;
  queue: QueuedWrite[];

  // ── ephemeral (reset every load) ────────────────────────────────────────────
  progress: Record<string, OfflineDownloadProgress>;

  setProgress: (projectId: string, progress: OfflineDownloadProgress) => void;
  clearProgress: (projectId: string) => void;

  saveManifest: (manifest: OfflineProjectManifest) => void;
  removeManifest: (projectId: string) => void;

  /** Enqueue a write, superseding any pending write to the same target. */
  enqueueWrite: (write: Omit<QueuedWrite, "id" | "createdAt">) => void;
  dequeueWrite: (id: string) => void;
  clearQueue: () => void;

  /** Wipe everything (logout) — caches are cleared separately by the SW. */
  reset: () => void;
}

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      manifests: {},
      queue: [],
      progress: {},

      setProgress: (projectId, progress) =>
        set((state) => ({
          progress: { ...state.progress, [projectId]: progress },
        })),

      clearProgress: (projectId) =>
        set((state) => {
          const next = { ...state.progress };
          delete next[projectId];
          return { progress: next };
        }),

      saveManifest: (manifest) =>
        set((state) => ({
          manifests: { ...state.manifests, [manifest.projectId]: manifest },
        })),

      removeManifest: (projectId) =>
        set((state) => {
          const next = { ...state.manifests };
          delete next[projectId];
          return { manifests: next };
        }),

      enqueueWrite: (write) =>
        set((state) => ({
          queue: [
            ...state.queue.filter((item) => item.dedupeKey !== write.dedupeKey),
            { ...write, id: newId(), createdAt: Date.now() },
          ],
        })),

      dequeueWrite: (id) =>
        set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),

      clearQueue: () => set({ queue: [] }),

      reset: () => set({ manifests: {}, queue: [], progress: {} }),
    }),
    {
      name: "voctmanager-offline",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Progress is live download telemetry — never restore a stale "downloading".
      partialize: (state) => ({ manifests: state.manifests, queue: state.queue }),
    },
  ),
);
