/**
 * @file annotations.queries.ts
 * @description React Query hooks for score annotations, and the two things that
 * keep a score stand honest in the room it is actually used in.
 *
 * **Nothing is lost without signal.** Every write that dies on the network, or
 * meets a server error, is queued (`shared/offline`) instead of rolled back into
 * thin air, and the page is composed as `server rows ⊕ pending queue` — so a
 * mark drawn in a basement survives a refetch, a reload, and being closed on the
 * train. Ids are minted client-side, which is what lets an unsent mark still be
 * edited and erased, and what makes the replayed POST idempotent. A mark that
 * DID reach the server is read back once as the reader leaves the score, so the
 * copy the service worker keeps — the one still on the device after the
 * persisted snapshot has aged out — carries their own hand and not just the
 * conductor's.
 *
 * **An open stand keeps up with the rehearsal.** While the viewer is open the
 * cheap fingerprint endpoint is polled, and the full list is refetched whenever
 * the list on hand does not match it — paused while this reader's own writes are
 * in flight, so a background answer never wipes the stroke under their hand.
 * @module features/annotations/api
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";
import { classifyWriteFailure, statusOf } from "@/shared/offline/replayPolicy";
import {
  useOfflineStore,
  type QueuedWrite,
} from "@/shared/offline/useOfflineStore";

import { AnnotationsService } from "./annotations.service";
import { choirMarkKeys } from "./choirMarkKeys";
import { insertMarks, upsertMark, withoutMarks } from "../lib/markRows";
import { queuedSeen, timeOf } from "../lib/markSeen";
import { isReservedInk } from "../lib/palette";
import {
  applyPendingMarks,
  collapseClear,
  collapseCreate,
  collapseDelete,
  collapseRestore,
  collapseUpdate,
  isMarkOp,
  isMarkRow,
  pendingMarkEntries,
  toCreateBody,
  touchesMarks,
  wasSent,
  type CollapsedWrite,
} from "../lib/pendingMarks";
import type {
  AnnotationPatch,
  MarkFingerprint,
  NewAnnotation,
  ScoreAnnotation,
} from "../types/annotations.dto";

export const annotationKeys = {
  all: ["annotations"] as const,
  byEdition: (editionId: string) => [...annotationKeys.all, editionId] as const,
  fingerprint: (editionId: string) =>
    [...annotationKeys.all, "fingerprint", editionId] as const,
};

/**
 * How often an open stand asks whether anything changed. Twenty seconds is the
 * span of a conductor saying "zapiszcie sobie" and the singers looking down —
 * short enough to feel like the room, long enough that a phone on a church
 * basement's signal is not paying for it.
 */
const LIVE_POLL_MS = 20_000;

interface AnnotationsOptions {
  /**
   * Which marks a clear queued by an older build wipes — it named none. Must
   * mirror the server's role-aware clear scope (managers: shared+conductor;
   * readers: their own personal layer) or the pending-queue view would drop
   * marks that actually survive.
   */
  isCleared?: (annotation: ScoreAnnotation) => boolean;
  /**
   * True while the score is on screen — turns on the fingerprint poll. Off
   * everywhere else, so a songbook of forty closed rows costs nothing.
   */
  live?: boolean;
  /**
   * Who is holding the pencil, stamped on every draft as `created_by`. The
   * server stamps the same id from the request, so this is a faithful
   * prediction, and it matters wherever ownership is decided per row rather
   * than per layer: a leader's mark on the choir's layer is theirs to move
   * only because the row says so — and a draft saying "nobody" would be
   * unmovable from the moment it was drawn until the network answered.
   */
  authorId?: string | null;
}

const ALL_CLEARED = () => true;

/**
 * Only the choir's layer feeds "Powiadom chór" (the server counts `shared`
 * exactly), so only a write touching it re-reads that count. A personal pencil
 * stroke is news to nobody.
 */
const feedsChoirNews = (rows: readonly Pick<ScoreAnnotation, "layer_name">[]): boolean =>
  rows.some((row) => row.layer_name === "shared");

/**
 * Registered with the offline queue at boot. The queue was the page's source of
 * truth while it held these writes; each one's answer is already in the list
 * (`landQueuedMark`), and once the drain is over the lists are re-read for what
 * the answers did not say — another hand's marks, the server's own stamps.
 *
 * `refetchType: "all"`, because the reader is usually nowhere near the score
 * when signal comes back. Marking a closed stand stale only defers the read to
 * its next mount, which may well be the next rehearsal in the same basement —
 * by then the queue is empty and both the snapshot and the worker's copy would
 * predate the marks that just landed. This runs on a connection that has just
 * proved itself, over a handful of small lists. A "Powiadom chór" count on
 * screen is re-read too: the marks it counts have only now reached the server.
 */
export const reconcileQueuedMarks = async (queryClient: QueryClient): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: annotationKeys.all, refetchType: "all" }),
    queryClient.invalidateQueries({ queryKey: choirMarkKeys.news }),
  ]);
};

/**
 * Registered with the offline queue at boot: puts a queued mark write's answer
 * into its edition's list the moment it lands, before the write leaves the
 * queue. Otherwise the mark is off the page from then until the reconcile after
 * the drain — and a clear made in that gap names only the marks it can see, so
 * the mark would survive it.
 *
 * Returns false for a restore the server met only in part (it skips what the
 * reader may no longer write), so the drain reports it as refused.
 */
export const landQueuedMark = (
  queryClient: QueryClient,
  write: QueuedWrite,
  data: unknown,
): boolean => {
  const meta = write.meta;
  if (!isMarkOp(meta)) return true;
  const edit = (change: (rows: ScoreAnnotation[]) => ScoreAnnotation[]): void => {
    queryClient.setQueryData<ScoreAnnotation[]>(
      annotationKeys.byEdition(meta.editionId),
      (rows) => (rows ? change(rows) : rows),
    );
  };
  const row = isMarkRow(data) ? data : null;
  switch (meta.op) {
    case "create":
      if (row) edit((rows) => upsertMark(rows, row));
      // No answer at all: the server said the mark is already gone (erased elsewhere).
      else if (data === undefined) edit((rows) => withoutMarks(rows, new Set([meta.annotationId])));
      return true;
    case "update":
      if (row) edit((rows) => upsertMark(rows, row));
      return true;
    case "delete":
      edit((rows) => withoutMarks(rows, new Set([meta.annotationId])));
      return true;
    case "clear": {
      const ids = meta.ids ?? clearedIds(data);
      edit((rows) => withoutMarks(rows, new Set(ids)));
      return true;
    }
    case "restore": {
      const restored = restoredRows(data);
      edit((rows) => restored.reduce(upsertMark, rows));
      const back = new Set(restored.map((mark) => mark.id));
      return meta.annotations.every((mark) => back.has(mark.id));
    }
  }
};

/** The ids a clear's answer lists, for a clear queued by a build that named none. */
const clearedIds = (data: unknown): string[] => {
  const ids = (data as { ids?: unknown } | null)?.ids;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
};

const restoredRows = (data: unknown): ScoreAnnotation[] => {
  const rows = (data as { restored?: unknown } | null)?.restored;
  return Array.isArray(rows) ? rows.filter(isMarkRow) : [];
};

/**
 * Editions this device has written to since the server last answered a full list
 * for them.
 *
 * The copy of the markings that survives a week without signal is the service
 * worker's, and only a real list GET writes it — an optimistic patch does not,
 * and neither does a POST that succeeds. While the stand is open the fingerprint
 * poll closes that gap on its next tick, but the reader who marks a bar and
 * shuts the score gets no tick: their own pencil would then be missing from the
 * copy on disk, which is the failure this whole layer exists to prevent, and the
 * silent one. So the edition is remembered here and read back once when they
 * leave it. Module-level because the write and the leaving happen in two
 * different hooks over the same edition.
 */
const unsyncedEditions = new Set<string>();

/**
 * Reads one edition's markings back from the network when the reader leaves it,
 * if this device wrote to it. Skipped with no signal — a write that failed is in
 * the durable queue already, and one that succeeded can wait for the next close
 * rather than spend a doomed request here.
 */
const useDurableMarkCatchUp = (editionId: string | null): void => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!editionId) return;
    return () => {
      if (!unsyncedEditions.has(editionId)) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      unsyncedEditions.delete(editionId);
      void queryClient
        .fetchQuery({
          queryKey: annotationKeys.byEdition(editionId),
          queryFn: () => AnnotationsService.list(editionId),
          staleTime: 0,
        })
        .catch(() => {});
    };
  }, [editionId, queryClient]);
};

export interface ScoreMarks {
  /** Server rows redrawn through everything still waiting in the queue. */
  annotations: ScoreAnnotation[];
  /** Markup writes this device is still holding for the network. */
  pendingCount: number;
  /**
   * True once a real list is on hand — fetched, cached or restored. Before it,
   * `annotations` holds only the queue's echo, which is not the score's state.
   */
  isLoaded: boolean;
  /**
   * Loaded, and no newer list on its way. A list restored from the device's
   * snapshot is loaded long before it is settled: summing up what changed
   * since the last visit from it would announce the marks it lacks a second
   * time, as arrivals, the moment the network answers.
   */
  isSettled: boolean;
  /**
   * How far this reader has read the edition (`MarkFingerprint.seen_at`):
   * undefined until an open stand's first fingerprint answers.
   */
  seenAt: string | null | undefined;
}

/**
 * The marks to draw on one edition. Reads the server's answer and the offline
 * queue as one picture, and — while `live` — keeps that picture current.
 */
export const useScoreAnnotations = (
  editionId: string | null,
  options?: AnnotationsOptions,
): ScoreMarks => {
  const isCleared = options?.isCleared ?? ALL_CLEARED;
  const queue = useOfflineStore((state) => state.queue);

  const { data, isSuccess, isFetching } = useQuery({
    queryKey: annotationKeys.byEdition(editionId ?? "none"),
    queryFn: () => AnnotationsService.list(editionId as string),
    enabled: !!editionId,
    // Another hand writes here, so a list restored from the device's snapshot
    // paints at once and is reconciled behind it on every open.
    staleTime: 1000 * 30,
    ...RECONCILING_REFETCH,
  });

  const seenAt = useMarkFingerprintWatch(editionId, options?.live ?? false, data);
  useDurableMarkCatchUp(editionId);

  const pending = useMemo(
    () => pendingMarkEntries(queue, editionId),
    [queue, editionId],
  );

  const annotations = useMemo(
    () => applyPendingMarks(data ?? [], pending, isCleared),
    [data, pending, isCleared],
  );

  const isLoaded = !!editionId && isSuccess;
  return {
    annotations,
    pendingCount: pending.length,
    isLoaded,
    isSettled: isLoaded && !isFetching,
    seenAt,
  };
};

/**
 * Count + newest touch, in one comparable form. Times are compared as instants:
 * the fingerprint and the rows reach the client through different serializers,
 * which spell the same instant differently.
 */
const fingerprintSignature = (fingerprint: MarkFingerprint): string =>
  `${fingerprint.count}:${timeOf(fingerprint.latest) ?? ""}`;

const listSignature = (rows: readonly ScoreAnnotation[]): string => {
  let latest: number | null = null;
  for (const row of rows) {
    const time = timeOf(row.updated_at);
    if (time !== null && (latest === null || time > latest)) latest = time;
  }
  return `${rows.length}:${latest ?? ""}`;
};

/**
 * Polls the fingerprint while the stand is open, and re-reads the list on every
 * tick whose fingerprint the list on hand does not match.
 *
 * Agreement, not movement, is the test. A list answered from a stale copy — a
 * cache somewhere between here and the database — would otherwise take the
 * fingerprint's change with it: the poll would see the pair move once, re-read,
 * be handed the old list, and never ask again until something else changed. So
 * the fingerprint counts as seen only once a list matching it is in hand
 * (count + newest `updated_at`), and until then each tick asks again.
 *
 * Held off whenever this reader has markup writes of their own in flight — a
 * refetch landing between the optimistic patch and the server's reply would take
 * the stroke off the page under their hand. A settled write leaves the cache
 * holding the server's row, so the next tick agrees without a re-read.
 *
 * Returns the reader's `seen_at` from the latest answer, undefined before one.
 */
const useMarkFingerprintWatch = (
  editionId: string | null,
  live: boolean,
  rows: readonly ScoreAnnotation[] | undefined,
): string | null | undefined => {
  const queryClient = useQueryClient();
  const writing = useIsMutating({ mutationKey: annotationKeys.all }) > 0;

  const { data, dataUpdatedAt } = useQuery({
    queryKey: annotationKeys.fingerprint(editionId ?? "none"),
    queryFn: () => AnnotationsService.fingerprint(editionId as string),
    enabled: live && !!editionId,
    // The fingerprint is a question, never an answer worth keeping: a restored
    // snapshot would make the first tick agree with a page that has moved on.
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: writing ? false : LIVE_POLL_MS,
  });

  /** The fingerprint the list on hand is known to match. */
  const agreed = useRef<string | null>(null);
  // Read at tick time only: a list arriving must never itself trigger a re-read,
  // or a list that keeps disagreeing would be fetched in a loop.
  const latest = useRef({ rows, writing });
  latest.current = { rows, writing };

  useEffect(() => {
    agreed.current = null;
  }, [editionId]);

  useEffect(() => {
    if (!data || !rows) return;
    const target = fingerprintSignature(data);
    if (listSignature(rows) === target) agreed.current = target;
  }, [data, rows]);

  useEffect(() => {
    if (!editionId || !data) return;
    const target = fingerprintSignature(data);
    if (agreed.current === target) return;
    const { rows: onHand, writing: busy } = latest.current;
    // The list's own first load is still on its way, or a write is in flight.
    if (!onHand || busy) return;
    if (listSignature(onHand) === target) {
      agreed.current = target;
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: annotationKeys.byEdition(editionId),
    });
  }, [data, dataUpdatedAt, editionId, queryClient]);

  return data?.seen_at;
};

/** A fresh v4 id: for a mark, or for a clear or restore the queue must tell apart. */
export const newMarkId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : // Vanishingly rare fallback (ancient/insecure contexts). Still a v4-shaped
      // id, because the server stores it in a UUID column.
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const rand = (Math.random() * 16) | 0;
        const value = char === "x" ? rand : (rand & 0x3) | 0x8;
        return value.toString(16);
      });

/**
 * What a mark write came to, as far as the reader's undo needs to know.
 *   saved     — the server confirmed it;
 *   queued    — it is in the durable queue and will land on its own;
 *   discarded — nothing had to be sent: an unsent create was withdrawn from the
 *               queue, or an unsent erase or clear was cancelled in it.
 * A genuine rejection is not an outcome: the promise rejects, after the one
 * toast that says why.
 */
export type MarkWrite = "saved" | "queued" | "discarded";

/** One id for every rejection toast, so a refused clear of forty marks says it once. */
const REJECTION_TOAST_ID = "annotation-write-rejected";

/**
 * What a write fails with when its turn comes and the queue already holds a
 * write to one of its marks: an earlier write on the same mark failed into the
 * queue while this one waited. Sent live now, it would land first and be undone
 * by that replay. It carries no response, so the replay policy reads it as
 * retryable and the write joins the queue behind. It never left the device.
 */
class HeldBehindQueue extends Error {}

/**
 * Per mark id: the newest edit drawn on the page and not yet answered, and the
 * row the server last confirmed beneath it. Writes on one edition leave one at
 * a time, but each is drawn at once, so an edit can be drawn over an earlier
 * write still in the air. Neither answer may paint over the newer drawing: a
 * failure puts the confirmed row back only while its own edit is the newest,
 * and a success under a newer edit becomes that edit's confirmed row.
 *
 * Keyed by a token rather than by the row object: the query cache shares
 * structure on every write, so the row it holds is never the object an edit
 * put there.
 */
const drawnEdits = new Map<string, { token: number; confirmed: ScoreAnnotation }>();
let lastEditToken = 0;

const isRetryable = (error: unknown, method: QueuedWrite["method"]): boolean =>
  classifyWriteFailure(error, method) === "retry";

const isOffline = (): boolean =>
  typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * Moves the reader's pointer on an edition they are leaving. Sent live; a
 * failure the queue can carry is queued as background bookkeeping, and any other
 * is let go. A pointer left behind shows a few marks as new once more, which is
 * the safe direction to be wrong in.
 */
export const useMarkSeen = (): ((editionId: string, at: string) => void) => {
  const { t } = useTranslation();
  return useCallback(
    (editionId: string, at: string) => {
      const enqueue = (): void => {
        const store = useOfflineStore.getState();
        store.enqueueWrite(
          queuedSeen(store.queue, editionId, at, t("annotations.queue_seen_label")),
        );
      };
      if (isOffline()) {
        enqueue();
        return;
      }
      AnnotationsService.seen(editionId, at).catch((error: unknown) => {
        if (isRetryable(error, "POST")) enqueue();
      });
    },
    [t],
  );
};

interface ClearVariables {
  clearId: string;
  annotations: readonly ScoreAnnotation[];
}

/** An edit's place in `drawnEdits`, and the row it was drawn over. */
interface DrawnEdit {
  token?: number;
  confirmed?: ScoreAnnotation;
}

/**
 * Create / update / erase / clear / restore, scoped to one edition's cache.
 *
 * Two layers of safety net, and they do different jobs. The optimistic patch
 * answers the hand instantly while the request is in the air. The offline queue
 * is what survives the request failing on the network or on a server error: the
 * write is queued and the one row it touched goes back to the server's truth,
 * and the queue is what `useScoreAnnotations` composes back onto the page. A
 * genuine rejection (403 on reserved ink, 400 on a malformed payload) is NOT
 * queued — the row rolls back, stays rolled back, and a toast says why.
 *
 * A write to a mark that the queue already holds writes for joins the queue
 * behind them instead of going out live, and so does every write while the
 * device knows it is offline. Sent live, it could land before the queued writes
 * and then be undone by their replay — a PATCH against a create the server has
 * not had yet answers 404.
 *
 * Writes on one edition leave the device one at a time (a mutation `scope`),
 * each asking again at its turn whether the queue now holds its marks. So an
 * edit made while the create before it is in the air can never overtake it,
 * and a clear always lands after the strokes it wipes. The optimistic patch is
 * not held back: `onMutate` runs at once, only the request waits its turn.
 */
export const useAnnotationMutations = (
  editionId: string | null,
  options?: Pick<AnnotationsOptions, "authorId">,
) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = useMemo(() => annotationKeys.byEdition(editionId ?? "none"), [editionId]);
  const authorId = options?.authorId ?? null;

  /** Apply a collapsed write to the durable queue. */
  const enqueue = useCallback((collapsed: CollapsedWrite) => {
    const store = useOfflineStore.getState();
    for (const queueId of collapsed.drop) store.dequeueWrite(queueId);
    if (!collapsed.replace) return;
    store.enqueueWrite({
      kind: "annotation",
      method: collapsed.replace.method,
      url: collapsed.replace.url,
      body: collapsed.replace.body,
      dedupeKey: collapsed.replace.dedupeKey,
      label: t("annotations.queue_label"),
      meta: collapsed.replace.meta,
    });
  }, [t]);

  const pendingFor = useCallback(
    () => pendingMarkEntries(useOfflineStore.getState().queue, editionId),
    [editionId],
  );

  const mustQueue = useCallback(
    (ids: readonly string[]): boolean => {
      if (isOffline()) return true;
      const named = new Set(ids);
      return pendingFor().some((entry) => touchesMarks(entry.meta, named));
    },
    [pendingFor],
  );

  /** The request half of every write, run when the write's turn comes. */
  const sendUnlessHeld = useCallback(
    async <T>(ids: readonly string[], send: () => Promise<T>): Promise<T> => {
      if (mustQueue(ids)) throw new HeldBehindQueue();
      return send();
    },
    [mustQueue],
  );

  /**
   * Every write on this edition queues behind the one before it. `always`,
   * because the request half decides for itself what to do without signal —
   * the default would pause it until the network returns, out of the queue's
   * reach.
   */
  const turn = useMemo(
    () => ({
      scope: { id: `annotations:${editionId ?? "none"}` },
      networkMode: "always" as const,
    }),
    [editionId],
  );

  const rowOf = useCallback(
    (id: string): ScoreAnnotation | undefined =>
      queryClient.getQueryData<ScoreAnnotation[]>(key)?.find((row) => row.id === id),
    [key, queryClient],
  );

  /** Patch the cached server list in place. */
  const patchRows = useCallback(
    (edit: (rows: ScoreAnnotation[]) => ScoreAnnotation[]) => {
      queryClient.setQueryData<ScoreAnnotation[]>(key, (current) =>
        edit(current ?? []),
      );
    },
    [key, queryClient],
  );

  const holdStill = useCallback(
    () => queryClient.cancelQueries({ queryKey: key }),
    [key, queryClient],
  );

  /**
   * Puts the server's answer for one mark in the list — unless an edit newer
   * than this write is drawn over it, which then sits on this answer instead
   * (`drawnEdits`). `token` is the answered edit's own, absent for a create.
   * `insert` is false for an edit: a mark erased while its edit was in the air
   * stays erased.
   */
  const settleRow = useCallback(
    (answer: ScoreAnnotation, token: number | undefined, insert: boolean) => {
      const newest = drawnEdits.get(answer.id);
      if (newest && newest.token !== token) {
        newest.confirmed = answer;
        return;
      }
      drawnEdits.delete(answer.id);
      if (!insert && !rowOf(answer.id)) return;
      patchRows((rows) => upsertMark(rows, answer));
    },
    [patchRows, rowOf],
  );

  /**
   * The server's list for this edition has moved, and only this device knows —
   * the cache was patched in place rather than re-read. Owed a read-back before
   * the reader walks away from it (see `useDurableMarkCatchUp`). A "Powiadom
   * chór" count on screen is re-read as well when the write touched the choir's
   * layer, so the conductor sees the piece he has just marked join it.
   */
  const noteWrite = useCallback(
    (rows: readonly Pick<ScoreAnnotation, "layer_name">[]) => {
      if (editionId) unsyncedEditions.add(editionId);
      if (feedsChoirNews(rows)) {
        void queryClient.invalidateQueries({ queryKey: choirMarkKeys.news });
      }
    },
    [editionId, queryClient],
  );

  const reportRejection = useCallback(
    (error: unknown, color?: string) => {
      const status = statusOf(error);
      const message =
        status === 403 && color !== undefined && isReservedInk(color)
          ? t("annotations.rejected.reserved_ink")
          : status === 403 || status === 404 || status === 410
            ? t("annotations.rejected.no_access")
            : t("annotations.rejected.invalid");
      toast.error(message, { id: REJECTION_TOAST_ID });
    },
    [t],
  );

  const { mutateAsync: createAsync } = useMutation({
    mutationKey: annotationKeys.all,
    ...turn,
    mutationFn: (annotation: ScoreAnnotation) =>
      sendUnlessHeld([annotation.id], () =>
        AnnotationsService.create(toCreateBody(annotation)),
      ),
    onMutate: async (annotation) => {
      await holdStill();
      patchRows((rows) => upsertMark(rows, annotation));
    },
    onError: (error, annotation) => {
      // Queue first, then roll back: the page never draws a frame without it.
      const retry = isRetryable(error, "POST");
      if (retry) {
        enqueue(collapseCreate(annotation, { sent: !(error instanceof HeldBehindQueue) }));
      }
      patchRows((rows) => withoutMarks(rows, new Set([annotation.id])));
      if (!retry) reportRejection(error, annotation.color);
    },
    onSuccess: (created) => {
      settleRow(created, undefined, true);
      noteWrite([created]);
    },
  });

  const { mutateAsync: updateAsync } = useMutation({
    mutationKey: annotationKeys.all,
    ...turn,
    mutationFn: ({ id, patch }: { id: string; patch: AnnotationPatch }) =>
      sendUnlessHeld([id], () => AnnotationsService.update(id, patch)),
    onMutate: async ({ id, patch }): Promise<DrawnEdit> => {
      await holdStill();
      const current = rowOf(id);
      if (!current) return {};
      const confirmed = drawnEdits.get(id)?.confirmed ?? current;
      const token = ++lastEditToken;
      drawnEdits.set(id, { token, confirmed });
      patchRows((rows) =>
        rows.map((row) =>
          row.id === id
            ? { ...row, ...patch, updated_at: new Date().toISOString() }
            : row,
        ),
      );
      return { token, confirmed };
    },
    onError: (error, { id, patch }, context) => {
      const retry = isRetryable(error, "PATCH");
      if (retry && editionId) {
        enqueue(collapseUpdate(pendingFor(), editionId, id, patch));
      }
      const newest = drawnEdits.get(id);
      if (newest && newest.token === context?.token) {
        drawnEdits.delete(id);
        patchRows((rows) => rows.map((row) => (row.id === id ? newest.confirmed : row)));
      }
      if (!retry) reportRejection(error, patch.color);
    },
    onSuccess: (updated, _variables, context) => {
      settleRow(updated, context?.token, false);
      noteWrite(context?.confirmed ? [updated, context.confirmed] : [updated]);
    },
  });

  const { mutateAsync: removeAsync } = useMutation({
    mutationKey: annotationKeys.all,
    ...turn,
    mutationFn: (annotation: ScoreAnnotation) =>
      sendUnlessHeld([annotation.id], async () => {
        try {
          await AnnotationsService.remove(annotation.id);
        } catch (error) {
          // Already gone is what an erase asked for.
          if (classifyWriteFailure(error, "DELETE") !== "done") throw error;
        }
      }),
    onMutate: async (annotation) => {
      await holdStill();
      patchRows((rows) => withoutMarks(rows, new Set([annotation.id])));
    },
    onError: (error, annotation) => {
      const retry = isRetryable(error, "DELETE");
      if (retry && editionId) {
        enqueue(
          collapseDelete(pendingFor(), editionId, annotation.id, {
            sent: !(error instanceof HeldBehindQueue),
          }),
        );
      }
      patchRows((rows) => insertMarks(rows, [annotation]));
      if (!retry) reportRejection(error);
    },
    onSuccess: (_answer, annotation) => {
      // Again: a list read while the erase was in the air may have put it back.
      patchRows((rows) => withoutMarks(rows, new Set([annotation.id])));
      noteWrite([annotation]);
    },
  });

  const { mutateAsync: clearAsync } = useMutation({
    mutationKey: annotationKeys.all,
    ...turn,
    mutationFn: ({ annotations }: ClearVariables) => {
      const ids = annotations.map((row) => row.id);
      return sendUnlessHeld(ids, () => AnnotationsService.clear(editionId as string, ids));
    },
    onMutate: async ({ annotations }) => {
      await holdStill();
      patchRows((rows) => withoutMarks(rows, new Set(annotations.map((row) => row.id))));
    },
    onError: (error, { clearId, annotations }) => {
      const retry = isRetryable(error, "POST");
      if (retry && editionId) {
        enqueue(
          collapseClear(
            editionId,
            clearId,
            annotations.map((row) => row.id),
            { sent: !(error instanceof HeldBehindQueue) },
          ),
        );
      }
      patchRows((rows) => insertMarks(rows, annotations));
      if (!retry) reportRejection(error);
    },
    onSuccess: (_answer, { annotations }) => {
      patchRows((rows) => withoutMarks(rows, new Set(annotations.map((row) => row.id))));
      noteWrite(annotations);
    },
  });

  const { mutateAsync: restoreAsync } = useMutation({
    mutationKey: annotationKeys.all,
    ...turn,
    mutationFn: (annotations: readonly ScoreAnnotation[]) => {
      const ids = annotations.map((row) => row.id);
      return sendUnlessHeld(ids, () => AnnotationsService.restore(ids));
    },
    onMutate: async (annotations) => {
      await holdStill();
      patchRows((rows) => insertMarks(rows, annotations));
    },
    onError: (error, annotations) => {
      const retry = isRetryable(error, "POST");
      if (retry && editionId) {
        enqueue(
          collapseRestore(editionId, newMarkId(), annotations, {
            sent: !(error instanceof HeldBehindQueue),
          }),
        );
      }
      patchRows((rows) => withoutMarks(rows, new Set(annotations.map((row) => row.id))));
      if (!retry) reportRejection(error);
    },
    onSuccess: (restored, annotations) => {
      const back = new Set(restored.map((row) => row.id));
      const refused = new Set(
        annotations.filter((row) => !back.has(row.id)).map((row) => row.id),
      );
      patchRows((rows) =>
        restored.reduce(upsertMark, withoutMarks(rows, refused)),
      );
      // The server skips what this reader may no longer touch: say so once,
      // rather than let an undo half-happen in silence.
      if (refused.size > 0) {
        toast.error(t("annotations.rejected.no_access"), { id: REJECTION_TOAST_ID });
      }
      noteWrite(annotations);
    },
  });

  /**
   * Runs a live write. A failure the queue absorbed is "queued" — `onError` has
   * already put it there — and only a genuine rejection rejects.
   */
  const settle = useCallback(
    async (
      method: QueuedWrite["method"],
      run: () => Promise<unknown>,
    ): Promise<MarkWrite> => {
      try {
        await run();
        return "saved";
      } catch (error) {
        if (isRetryable(error, method)) return "queued";
        throw error;
      }
    },
    [],
  );

  const createMark = useCallback(
    async (annotation: ScoreAnnotation): Promise<MarkWrite> => {
      if (mustQueue([annotation.id])) {
        enqueue(collapseCreate(annotation));
        return "queued";
      }
      return settle("POST", () => createAsync(annotation));
    },
    [createAsync, enqueue, mustQueue, settle],
  );

  const updateMark = useCallback(
    async (id: string, patch: AnnotationPatch): Promise<MarkWrite> => {
      if (!editionId) return "discarded";
      if (mustQueue([id])) {
        enqueue(collapseUpdate(pendingFor(), editionId, id, patch));
        return "queued";
      }
      return settle("PATCH", () => updateAsync({ id, patch }));
    },
    [editionId, enqueue, mustQueue, pendingFor, settle, updateAsync],
  );

  const eraseMark = useCallback(
    async (annotation: ScoreAnnotation): Promise<MarkWrite> => {
      if (!editionId) return "discarded";
      if (mustQueue([annotation.id])) {
        const collapsed = collapseDelete(pendingFor(), editionId, annotation.id);
        enqueue(collapsed);
        return collapsed.replace ? "queued" : "discarded";
      }
      return settle("DELETE", () => removeAsync(annotation));
    },
    [editionId, enqueue, mustQueue, pendingFor, removeAsync, settle],
  );

  /**
   * Wipes exactly these marks. `clearId` names the gesture, so that its undo
   * can find it in the queue while it is still waiting there.
   */
  const clearMarks = useCallback(
    async (
      annotations: readonly ScoreAnnotation[],
      clearId: string,
    ): Promise<MarkWrite> => {
      if (!editionId || annotations.length === 0) return "discarded";
      const ids = annotations.map((row) => row.id);
      if (mustQueue(ids)) {
        enqueue(collapseClear(editionId, clearId, ids));
        return "queued";
      }
      return settle("POST", () => clearAsync({ clearId, annotations }));
    },
    [clearAsync, editionId, enqueue, mustQueue, settle],
  );

  /**
   * Brings erased marks back as themselves — same ids, authors and stacking
   * order. An erase or clear that never left the device is simply cancelled in
   * the queue; anything that may have reached the server is restored there.
   * `clearId` names the clear being undone, when it is one.
   */
  const reviveMarks = useCallback(
    async (
      annotations: readonly ScoreAnnotation[],
      clearId?: string,
    ): Promise<MarkWrite> => {
      if (!editionId || annotations.length === 0) return "discarded";
      const store = useOfflineStore.getState();
      const entries = pendingFor();

      const queuedClear = clearId
        ? entries.find(
            (entry) => entry.meta.op === "clear" && entry.meta.clearId === clearId,
          )
        : undefined;
      if (queuedClear && !wasSent(queuedClear)) {
        store.dequeueWrite(queuedClear.queueId);
        return "discarded";
      }

      const remaining = annotations.filter((row) => {
        const erase = entries.find(
          (entry) => entry.meta.op === "delete" && entry.meta.annotationId === row.id,
        );
        if (!erase || wasSent(erase)) return true;
        store.dequeueWrite(erase.queueId);
        return false;
      });
      if (remaining.length === 0) return "discarded";

      if (mustQueue(remaining.map((row) => row.id))) {
        enqueue(collapseRestore(editionId, newMarkId(), remaining));
        return "queued";
      }
      return settle("POST", () => restoreAsync(remaining));
    },
    [editionId, enqueue, mustQueue, pendingFor, restoreAsync, settle],
  );

  /** Mint the identity a new mark will keep on every device, forever. */
  const draftAnnotation = useCallback(
    (partial: Omit<NewAnnotation, "edition">): ScoreAnnotation | null => {
      if (!editionId) return null;
      const now = new Date().toISOString();
      return {
        ...partial,
        id: newMarkId(),
        edition: editionId,
        created_by: authorId,
        created_at: now,
        updated_at: now,
      };
    },
    [authorId, editionId],
  );

  return {
    createMark,
    updateMark,
    eraseMark,
    clearMarks,
    reviveMarks,
    draftAnnotation,
  };
};
