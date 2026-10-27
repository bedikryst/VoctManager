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
 * Three rules make that composition sound:
 *   · ids come from the CLIENT (`crypto.randomUUID`), so an offline-born mark
 *     can be edited and erased offline too, and its replayed POST is idempotent
 *     (see `AnnotationViewSet.perform_create`);
 *   · repeated writes to one mark COLLAPSE rather than stack — the queue must
 *     carry the reader's intent, not their keystrokes, and a naive PATCH queued
 *     behind an unsent POST would replay against a row the server never got;
 *   · a write that has ever left the device may be on the server, whatever its
 *     reply said. Such a write is never quietly withdrawn: a create that was
 *     sent keeps a DELETE behind it when erased, and an erase or clear that was
 *     sent is undone by a restore, not by taking it out of the queue.
 *
 * @module features/annotations/lib
 */

import type { QueuedWrite } from "@/shared/offline/useOfflineStore";
import { ANNOTATIONS_PATH } from "@/shared/offline/swProtocol";

import { insertMarks } from "./markRows";
import {
  markContent,
  withPatch,
  type AnnotationPatch,
  type NewAnnotation,
  type ScoreAnnotation,
} from "../types/annotations.dto";

/**
 * The literal lives in the worker's protocol module because the service worker
 * routes the offline copy of the markings on the same path and cannot import
 * feature code. One string, so a queued write and the route that keeps its
 * answer readable offline can never describe different endpoints.
 */
export const ANNOTATIONS_ENDPOINT = ANNOTATIONS_PATH;

/** Every queued markup write, in the shape the page needs to draw it. */
export type PendingMarkOp = (
  | { op: "create"; editionId: string; annotationId: string; annotation: ScoreAnnotation }
  | { op: "update"; editionId: string; annotationId: string; patch: AnnotationPatch }
  | { op: "delete"; editionId: string; annotationId: string }
  | {
      op: "clear";
      editionId: string;
      /** Names this gesture, so its undo can find it in the queue. */
      clearId?: string;
      /** The marks the page showed as clearable. Absent on clears queued by older builds. */
      ids?: string[];
    }
  | { op: "restore"; editionId: string; annotations: ScoreAnnotation[] }
) & {
  /**
   * A live request carrying this write already left the device before it was
   * queued — the reply died, not necessarily the write.
   */
  sent?: boolean;
};

/** One queued write's domain echo, plus the queue bookkeeping the merge needs. */
export interface PendingEntry {
  /** Queue row id, so a superseded write can be dropped from the store. */
  queueId: string;
  createdAt: number;
  /** Replays the queue has started for it. */
  attempts: number;
  meta: PendingMarkOp;
}

const isString = (value: unknown): value is string => typeof value === "string";

/** A whole mark row, as the server answers one and the queue stores one. */
export const isMarkRow = (value: unknown): value is ScoreAnnotation => {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    isString(row.id) &&
    isString(row.edition) &&
    typeof row.page_number === "number" &&
    isString(row.annotation_type) &&
    typeof row.payload === "object" &&
    row.payload !== null &&
    isString(row.color) &&
    isString(row.layer_name) &&
    (row.created_by === null || isString(row.created_by)) &&
    isString(row.created_at) &&
    isString(row.updated_at)
  );
};

/**
 * Whether a queue entry's echo can be drawn. It is read back from storage, so
 * an older build's shape or a damaged save must fail here rather than throw
 * mid-render on a page that will then never open.
 */
export const isMarkOp = (value: unknown): value is PendingMarkOp => {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  if (!isString(meta.editionId)) return false;
  if (meta.sent !== undefined && typeof meta.sent !== "boolean") return false;
  switch (meta.op) {
    case "create":
      return isString(meta.annotationId) && isMarkRow(meta.annotation);
    case "update":
      return (
        isString(meta.annotationId) &&
        typeof meta.patch === "object" &&
        meta.patch !== null
      );
    case "delete":
      return isString(meta.annotationId);
    case "clear":
      return (
        (meta.clearId === undefined || isString(meta.clearId)) &&
        (meta.ids === undefined ||
          (Array.isArray(meta.ids) && meta.ids.every(isString)))
      );
    case "restore":
      return Array.isArray(meta.annotations) && meta.annotations.every(isMarkRow);
    default:
      return false;
  }
};

/** Whether this write may already be on the server. */
export const wasSent = (entry: PendingEntry): boolean =>
  entry.attempts > 0 || entry.meta.sent === true;

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
      attempts: write.attempts,
      meta: write.meta,
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
};

/**
 * Whether a queued write concerns any of these marks. A write to such a mark
 * must join the queue behind it: sent live, it could land first and be undone
 * by the replay.
 */
export const touchesMarks = (
  meta: PendingMarkOp,
  ids: ReadonlySet<string>,
): boolean => {
  switch (meta.op) {
    case "create":
    case "update":
    case "delete":
      return ids.has(meta.annotationId);
    case "clear":
      // A clear from an older build named nothing, so it reaches every mark.
      return meta.ids ? meta.ids.some((id) => ids.has(id)) : true;
    case "restore":
      return meta.annotations.some((row) => ids.has(row.id));
  }
};

/**
 * Redraw the server's rows through everything still waiting in the queue.
 *
 * A clear wipes the marks it names. `isCleared` is only for a clear queued by
 * an older build, which named none: it mirrors the server's role-aware clear
 * scope — the same predicate the toolbar counts with — so a pending clear and
 * a landed one look the same on the page.
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
          row.id === meta.annotationId ? withPatch(row, meta.patch) : row,
        );
        break;
      case "delete":
        next = next.filter((row) => row.id !== meta.annotationId);
        break;
      case "clear": {
        const named = meta.ids ? new Set(meta.ids) : null;
        next = next.filter((row) => (named ? !named.has(row.id) : !isCleared(row)));
        break;
      }
      case "restore":
        next = insertMarks(next, meta.annotations);
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
/**
 * An erase never supersedes what is queued for its mark: the writes ahead of
 * it replay first and do no harm, and if the erase is undone they are still
 * there to draw — an edit made before the erase comes back with the mark.
 */
const eraseKey = (annotationId: string): string => `annotation-erase:${annotationId}`;

const findCreate = (
  entries: readonly PendingEntry[],
  annotationId: string,
): (PendingEntry & { meta: Extract<PendingMarkOp, { op: "create" }> }) | null => {
  const entry = entries.find(
    (candidate) =>
      candidate.meta.op === "create" && candidate.meta.annotationId === annotationId,
  );
  return entry && entry.meta.op === "create"
    ? { ...entry, meta: entry.meta }
    : null;
};

/** Queue a freshly drawn mark, or one brought back after its create was withdrawn. */
export const collapseCreate = (
  annotation: ScoreAnnotation,
  { sent = false }: { sent?: boolean } = {},
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
      sent,
    },
  },
});

/**
 * Queue an edit. Against an unsent create it folds INTO that create — the
 * server must receive one finished mark, not a POST followed by a PATCH to a
 * row it never had. The folded create keeps knowing whether it was ever sent.
 */
export const collapseUpdate = (
  entries: readonly PendingEntry[],
  editionId: string,
  annotationId: string,
  patch: AnnotationPatch,
): CollapsedWrite => {
  const create = findCreate(entries, annotationId);
  if (create) {
    return collapseCreate(
      withPatch(create.meta.annotation, patch),
      { sent: wasSent(create) },
    );
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
 * Queue an erase. A mark whose create never left the device simply leaves the
 * queue — drawn and rubbed out between two tunnels, it never happened. A create
 * that did leave may have landed, so it keeps a DELETE behind it; replayed, the
 * pair ends in nothing either way, and the DELETE's 404 counts as done.
 */
export const collapseDelete = (
  entries: readonly PendingEntry[],
  editionId: string,
  annotationId: string,
  { sent = false }: { sent?: boolean } = {},
): CollapsedWrite => {
  const create = findCreate(entries, annotationId);
  if (create && !wasSent(create)) {
    return { drop: [create.queueId], replace: null };
  }
  return {
    drop: [],
    replace: {
      method: "DELETE",
      url: `${ANNOTATIONS_ENDPOINT}${annotationId}/`,
      body: undefined,
      dedupeKey: eraseKey(annotationId),
      meta: { op: "delete", editionId, annotationId, sent },
    },
  };
};

/**
 * Queue a wipe of the marks the page showed as clearable. Earlier queued writes
 * stay put: the replay is ordered, so a mark created before the clear is created
 * and then wiped, exactly as it would have been with signal — and
 * `applyPendingMarks` shows the same on the page. Naming the marks is what keeps
 * a clear replayed late from taking a mark drawn after it.
 */
export const collapseClear = (
  editionId: string,
  clearId: string,
  ids: readonly string[],
  { sent = false }: { sent?: boolean } = {},
): CollapsedWrite => ({
  drop: [],
  replace: {
    method: "POST",
    url: `${ANNOTATIONS_ENDPOINT}clear/`,
    body: { edition: editionId, ids: [...ids] },
    dedupeKey: `annotation-clear:${clearId}`,
    meta: { op: "clear", editionId, clearId, ids: [...ids], sent },
  },
});

/** Queue the undo of an erase or clear that may already have reached the server. */
export const collapseRestore = (
  editionId: string,
  restoreId: string,
  annotations: readonly ScoreAnnotation[],
  { sent = false }: { sent?: boolean } = {},
): CollapsedWrite => ({
  drop: [],
  replace: {
    method: "POST",
    url: `${ANNOTATIONS_ENDPOINT}restore/`,
    body: { ids: annotations.map((row) => row.id) },
    dedupeKey: `annotation-restore:${restoreId}`,
    meta: { op: "restore", editionId, annotations: [...annotations], sent },
  },
});

/** The wire shape of a create — the id travels, `created_by` never does. */
export const toCreateBody = (
  annotation: ScoreAnnotation,
): NewAnnotation & { id: string } => ({
  id: annotation.id,
  edition: annotation.edition,
  page_number: annotation.page_number,
  ...markContent(annotation),
  color: annotation.color,
  layer_name: annotation.layer_name,
  ...(annotation.voices?.length ? { voices: [...annotation.voices] } : {}),
});
