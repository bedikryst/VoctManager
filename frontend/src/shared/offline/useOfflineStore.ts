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
 *  2. The write queue — readiness taps, attendance RSVPs, feedback reports and
 *     score markings made while offline, replayed in order once the network
 *     returns. Each entry carries its own retry bookkeeping, so a write the
 *     server keeps failing backs off instead of being dropped on the first 502.
 *
 * Domain-free: the kinds name the features that queue writes, but what a write
 * means — and which caches to re-read once it lands — stays with that feature.
 *
 * @module shared/offline/useOfflineStore
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

export type OfflineWriteKind =
  | "readiness"
  | "attendance"
  | "feedback"
  | "annotation"
  | "annotation_seen"
  | "note";

/** A deferred mutation captured while offline, replayed verbatim on reconnect. */
export interface QueuedWrite {
  id: string;
  kind: OfflineWriteKind;
  method: "PUT" | "PATCH" | "POST" | "DELETE";
  url: string;
  body: unknown;
  /** Repeated writes to the same target collapse to the latest intent. */
  dedupeKey: string;
  /**
   * Human label for the write ("Gotowość: Ave Maria").
   *
   * NOTHING RENDERS THIS TODAY. The shell surfaces `pendingCount` — a number —
   * and `useOfflineSync` toasts two fixed sentences, one for "synced", one for
   * "the server rejected some of it". Score marks pass a translated label; the
   * other features still write a hardcoded Polish string, and no reader has
   * ever seen one.
   *
   * It is kept rather than deleted because the rejection toast is the obvious
   * place for it: "the server rejected some of it" is a sentence that cannot be
   * acted on, and the labels are exactly what would make it name the losses. If
   * that is ever built, the labels have to go through i18next first.
   */
  label: string;
  createdAt: number;
  /**
   * Replays started for this write. Counted when the request LEAVES, not when
   * it fails: a write whose replay is in the air may already be on the server,
   * and a feature deciding whether it can quietly withdraw the write has to
   * know that.
   */
  attempts: number;
  /** Earliest moment the replay loop may try this write again (epoch ms). */
  nextAttemptAt: number;
  /**
   * When the server first answered this write with a retryable error (5xx,
   * 408, 429), or null while only the network has failed it. A network error
   * says nothing about the write, so it never starts the clock that ends in
   * the write being dropped.
   */
  failingSince: number | null;
  /**
   * Bookkeeping the reader never made as a change — how far they have read a
   * score. Replayed like any write, but not counted as waiting, and neither
   * its landing nor its loss is announced: "your offline changes were synced"
   * after merely closing a score would be a sentence about nothing.
   */
  background?: boolean;
  /**
   * Domain-shaped echo of the write, for a feature that must SHOW the queue's
   * effect before the server has seen it. A readiness tap can wait — the score
   * markings cannot: a pencil line drawn with no signal has to stay on the page,
   * and the page is redrawn from the server's answer. Opaque to the store; each
   * feature owns the shape it writes here and the code that reads it back.
   */
  meta?: unknown;
}

/** What a feature hands the queue; the store owns identity and retry state. */
export type NewQueuedWrite = Omit<
  QueuedWrite,
  "id" | "createdAt" | "attempts" | "nextAttemptAt" | "failingSince"
>;

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
  enqueueWrite: (write: NewQueuedWrite) => void;
  dequeueWrite: (id: string) => void;
  /** A replay of this write is about to leave the device. */
  startAttempt: (id: string) => void;
  /** The replay failed retryably: try again no sooner than `nextAttemptAt`. */
  deferWrite: (
    id: string,
    retry: { nextAttemptAt: number; failingSince: number | null },
  ) => void;
  clearQueue: () => void;

  /** Wipe everything (logout) — caches are cleared separately by the SW. */
  reset: () => void;
}

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const WRITE_METHODS: ReadonlySet<unknown> = new Set(["PUT", "PATCH", "POST", "DELETE"]);
const WRITE_KINDS: ReadonlySet<unknown> = new Set([
  "readiness",
  "attendance",
  "feedback",
  "annotation",
  "annotation_seen",
  "note",
]);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * The queue as read back from storage, keeping only entries that can still be
 * replayed. localStorage is the one input here that no code of ours wrote in
 * this session: an older build's shape, a half-written save, a hand edit. An
 * entry without a method or URL cannot be sent and would sit at the head of
 * the queue forever, holding every write behind it. Entries written before the
 * retry bookkeeping existed get a fresh slate.
 */
export const readQueuedWrites = (value: unknown): QueuedWrite[] => {
  if (!Array.isArray(value)) return [];
  const writes: QueuedWrite[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      !WRITE_KINDS.has(entry.kind) ||
      !WRITE_METHODS.has(entry.method) ||
      typeof entry.url !== "string" ||
      typeof entry.dedupeKey !== "string" ||
      !isFiniteNumber(entry.createdAt)
    ) {
      continue;
    }
    writes.push({
      id: entry.id,
      kind: entry.kind as OfflineWriteKind,
      method: entry.method as QueuedWrite["method"],
      url: entry.url,
      body: entry.body,
      dedupeKey: entry.dedupeKey,
      label: typeof entry.label === "string" ? entry.label : "",
      createdAt: entry.createdAt,
      attempts: isFiniteNumber(entry.attempts) ? entry.attempts : 0,
      nextAttemptAt: isFiniteNumber(entry.nextAttemptAt) ? entry.nextAttemptAt : 0,
      failingSince: isFiniteNumber(entry.failingSince) ? entry.failingSince : null,
      ...(entry.background === true ? { background: true } : {}),
      meta: entry.meta,
    });
  }
  return writes;
};

interface PersistedOfflineState {
  manifests: Record<string, OfflineProjectManifest>;
  queue: QueuedWrite[];
}

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
            {
              ...write,
              id: newId(),
              createdAt: Date.now(),
              attempts: 0,
              nextAttemptAt: 0,
              failingSince: null,
            },
          ],
        })),

      dequeueWrite: (id) =>
        set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),

      startAttempt: (id) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, attempts: item.attempts + 1 } : item,
          ),
        })),

      deferWrite: (id, { nextAttemptAt, failingSince }) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, nextAttemptAt, failingSince } : item,
          ),
        })),

      clearQueue: () => set({ queue: [] }),

      reset: () => set({ manifests: {}, queue: [], progress: {} }),
    }),
    {
      name: "voctmanager-offline",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Progress is live download telemetry — never restore a stale "downloading".
      partialize: (state): PersistedOfflineState => ({
        manifests: state.manifests,
        queue: state.queue,
      }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<Record<keyof PersistedOfflineState, unknown>>;
        const manifests =
          typeof stored.manifests === "object" && stored.manifests !== null
            ? (stored.manifests as Record<string, OfflineProjectManifest>)
            : current.manifests;
        return { ...current, manifests, queue: readQueuedWrites(stored.queue) };
      },
    },
  ),
);
