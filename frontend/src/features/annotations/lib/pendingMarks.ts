/**
 * @file pendingMarks.ts
 * @description The half of the markup that the server has not seen yet.
 *
 * A mark made without signal cannot live in the query cache alone: the cache is
 * the server's answer, and the next refetch overwrites it. So the offline queue
 * is the durable record, and this module is the lens that puts it back on the
 * page — every render composes `server rows ⊕ pending ops`, which makes a
 * refetch (or a reload, or a tab death on the train) harmless.
 *
 * Two rules make that composition sound:
 *   · ids come from the CLIENT (`crypto.randomUUID`), so an offline-born mark
 *     can be edited and erased offline too, and its replayed POST is idempotent
 *     (see `AnnotationViewSet.perform_create`);
 *   · repeated writes to one mark COLLAPSE rather than stack — the queue must
 *     carry the reader's intent, not their keystrokes, and a naive PATCH queued
 *     behind an unsent POST would replay against a row the server never got.
 *
 * @module features/annotations/lib
 */

import type { QueuedWrite } from "@/app/store/useOfflineStore";
import { ANNOTATIONS_PATH } from "@/shared/offline/swProtocol";

import type {
  AnnotationPatch,
  NewAnnotation,
  ScoreAnnotation,
} from "../types/annotations.dto";

/**
 * The literal lives in the worker's protocol module because the service worker
 * routes the offline copy of the markings on the same path and cannot import
 * feature code. One string, so a queued write and the route that keeps its
 * answer readable offline can never describe different endpoints.
 */
export const ANNOTATIONS_ENDPOINT = ANNOTATIONS_PATH;

/** Every queued markup write, in the shape the page needs to draw it. */
export type PendingMarkOp =
  | { op: "create"; editionId: string; annotationId: string; annotation: ScoreAnnotation }
  | { op: "update"; editionId: string; annotationId: string; patch: AnnotationPatch }
  | { op: "delete"; editionId: string; annotationId: string }
  | { op: "clear"; editionId: string };

/** One queued write's domain echo, plus the queue bookkeeping the merge needs. */
interface PendingEntry {
  /** Queue row id, so a superseded write can be dropped from the store. */
  queueId: string;
  createdAt: number;
  meta: PendingMarkOp;
}

const isMarkOp = (value: unknown): value is PendingMarkOp => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { op?: unknown; editionId?: unknown };
  return (
    typeof candidate.editionId === "string" &&
    (candidate.op === "create" ||
      candidate.op === "update" ||
      candidate.op === "delete" ||
      candidate.op === "clear")
  );
};

/**
 * The queue's markup writes for one edition, oldest first. Order is the whole
 * point: a clear only wipes what was drawn before it.
 */
export const pendingMarkEntries = (
  queue: readonly QueuedWrite[],
  editionId: string | null,
): PendingEntry[] => {
  if (!editionId) return [];
  return queue
    .filter(
      (write): write is QueuedWrite & { meta: PendingMarkOp } =>
        write.kind === "annotation" &&
        isMarkOp(write.meta) &&
        write.meta.editionId === editionId,
    )
    .map((write) => ({
      queueId: write.id,
      createdAt: write.createdAt,
      meta: write.meta,
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
};

/**
 * Redraw the server's rows through everything still waiting in the queue.
 *
 * `isCleared` mirrors the server's role-aware clear scope (managers wipe
 * shared+conductor, readers their own personal marks) — the same predicate the
 * optimistic cache patch uses, so a pending clear and a landed one look the same
 * on the page.
 */
export const applyPendingMarks = (
  rows: readonly ScoreAnnotation[],
  entries: readonly PendingEntry[],
  isCleared: (annotation: ScoreAnnotation) => boolean,
): ScoreAnnotation[] => {
  if (entries.length === 0) return rows as ScoreAnnotation[];
  let next = [...rows];
  for (const { meta } of entries) {
    switch (meta.op) {
      case "create":
        // The server may already hold it (the reply died, not the write) —
        // never let the replay double the line.
        if (!next.some((row) => row.id === meta.annotationId)) {
          next.push(meta.annotation);
        }
        break;
      case "update":
        next = next.map((row) =>
          row.id === meta.annotationId ? { ...row, ...meta.patch } : row,
        );
        break;
      case "delete":
        next = next.filter((row) => row.id !== meta.annotationId);
        break;
      case "clear":
        next = next.filter((row) => !isCleared(row));
        break;
    }
  }
  return next;
};

/**
 * How a new write collapses against what is already queued for the same mark.
 * `replace` carries the write to enqueue; `drop` names queue rows to delete
 * outright (an erase of a mark the server never heard of sends nothing at all).
 */
export interface CollapsedWrite {
  drop: string[];
  replace: {
    method: QueuedWrite["method"];
    url: string;
    body: unknown;
    dedupeKey: string;
    meta: PendingMarkOp;
  } | null;
}

const markKey = (annotationId: string): string => `annotation:${annotationId}`;
const clearKey = (editionId: string): string => `annotation-clear:${editionId}`;

/** Queue a freshly drawn mark. */
export const collapseCreate = (
  annotation: ScoreAnnotation,
): CollapsedWrite => ({
  drop: [],
  replace: {
    method: "POST",
    url: ANNOTATIONS_ENDPOINT,
    body: toCreateBody(annotation),
    dedupeKey: markKey(annotation.id),
    meta: {
      op: "create",
      editionId: annotation.edition,
      annotationId: annotation.id,
      annotation,
    },
  },
});

/**
 * Queue an edit. Against an unsent create it folds INTO that create — the
 * server must receive one finished mark, not a POST followed by a PATCH to a
 * row it never had.
 */
export const collapseUpdate = (
  entries: readonly PendingEntry[],
  editionId: string,
  annotationId: string,
  patch: AnnotationPatch,
): CollapsedWrite => {
  const create = entries.find(
    (entry) =>
      entry.meta.op === "create" && entry.meta.annotationId === annotationId,
  );
  if (create && create.meta.op === "create") {
    const merged: ScoreAnnotation = { ...create.meta.annotation, ...patch };
    return {
      drop: [],
      replace: {
        method: "POST",
        url: ANNOTATIONS_ENDPOINT,
        body: toCreateBody(merged),
        dedupeKey: markKey(annotationId),
        meta: { op: "create", editionId, annotationId, annotation: merged },
      },
    };
  }
  const pendingPatch = entries.reduce<AnnotationPatch>((acc, entry) => {
    if (entry.meta.op === "update" && entry.meta.annotationId === annotationId) {
      return { ...acc, ...entry.meta.patch };
    }
    return acc;
  }, {});
  return {
    drop: [],
    replace: {
      method: "PATCH",
      url: `${ANNOTATIONS_ENDPOINT}${annotationId}/`,
      body: { ...pendingPatch, ...patch },
      dedupeKey: markKey(annotationId),
      meta: { op: "update", editionId, annotationId, patch: { ...pendingPatch, ...patch } },
    },
  };
};

/**
 * Queue an erase. A mark the server never received simply leaves the queue —
 * drawn and rubbed out between two tunnels, it never happened.
 */
export const collapseDelete = (
  entries: readonly PendingEntry[],
  editionId: string,
  annotationId: string,
): CollapsedWrite => {
  const create = entries.find(
    (entry) =>
      entry.meta.op === "create" && entry.meta.annotationId === annotationId,
  );
  if (create) {
    return { drop: [create.queueId], replace: null };
  }
  return {
    drop: [],
    replace: {
      method: "DELETE",
      url: `${ANNOTATIONS_ENDPOINT}${annotationId}/`,
      body: undefined,
      dedupeKey: markKey(annotationId),
      meta: { op: "delete", editionId, annotationId },
    },
  };
};

/**
 * Queue a wipe. Earlier queued writes stay put: the replay is ordered, so a
 * mark created before the clear is created and then wiped, exactly as it would
 * have been with signal — and `applyPendingMarks` shows the same on the page.
 */
export const collapseClear = (editionId: string): CollapsedWrite => ({
  drop: [],
  replace: {
    method: "POST",
    url: `${ANNOTATIONS_ENDPOINT}clear/`,
    body: { edition: editionId },
    dedupeKey: clearKey(editionId),
    meta: { op: "clear", editionId },
  },
});

/** The wire shape of a create — the id travels, `created_by` never does. */
const toCreateBody = (annotation: ScoreAnnotation): NewAnnotation & { id: string } => ({
  id: annotation.id,
  edition: annotation.edition,
  page_number: annotation.page_number,
  annotation_type: annotation.annotation_type,
  payload: annotation.payload,
  color: annotation.color,
  layer_name: annotation.layer_name,
});
