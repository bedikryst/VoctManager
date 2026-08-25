/**
 * @file annotations.queries.ts
 * @description React Query hooks for score annotations, and the two things that
 * keep a score stand honest in the room it is actually used in.
 *
 * **Nothing is lost without signal.** Every write that dies on the network is
 * queued (`shared/offline`) instead of rolled back into thin air, and the page
 * is composed as `server rows ⊕ pending queue` — so a mark drawn in a basement
 * survives a refetch, a reload, and being closed on the train. Ids are minted
 * client-side, which is what lets an unsent mark still be edited and erased, and
 * what makes the replayed POST idempotent.
 *
 * **An open stand keeps up with the rehearsal.** While the viewer is open the
 * cheap fingerprint endpoint is polled, and the full list is refetched only on
 * the tick where it actually moved — paused while this reader's own writes are
 * in flight, so a background answer never wipes the stroke under their hand.
 * @module features/annotations/api
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useOfflineStore } from "@/app/store/useOfflineStore";
import { isLikelyOfflineError } from "@/shared/offline/offlineClient";

import { AnnotationsService } from "./annotations.service";
import {
  applyPendingMarks,
  collapseClear,
  collapseCreate,
  collapseDelete,
  collapseUpdate,
  pendingMarkEntries,
  type CollapsedWrite,
} from "../lib/pendingMarks";
import type {
  AnnotationPatch,
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
   * Which cached rows a `clear` wipes. Must mirror the server's role-aware clear
   * scope (managers: shared+conductor; readers: their own personal layer) or
   * both the optimistic patch and the pending-queue view would drop marks that
   * actually survive.
   */
  isCleared?: (annotation: ScoreAnnotation) => boolean;
  /**
   * True while the score is on screen — turns on the fingerprint poll. Off
   * everywhere else, so a songbook of forty closed rows costs nothing.
   */
  live?: boolean;
}

const ALL_CLEARED = () => true;

export interface ScoreMarks {
  /** Server rows redrawn through everything still waiting in the queue. */
  annotations: ScoreAnnotation[];
  /** Markup writes this device is still holding for the network. */
  pendingCount: number;
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

  const { data } = useQuery({
    queryKey: annotationKeys.byEdition(editionId ?? "none"),
    queryFn: () => AnnotationsService.list(editionId as string),
    enabled: !!editionId,
    staleTime: 1000 * 30,
  });

  useMarkFingerprintWatch(editionId, options?.live ?? false);

  const pending = useMemo(
    () => pendingMarkEntries(queue, editionId),
    [queue, editionId],
  );

  const annotations = useMemo(
    () => applyPendingMarks(data ?? [], pending, isCleared),
    [data, pending, isCleared],
  );

  return { annotations, pendingCount: pending.length };
};

/**
 * Polls the fingerprint while the stand is open and invalidates the list only
 * when the pair moves. Held off whenever this reader has markup writes of their
 * own in flight — a refetch landing between the optimistic patch and the
 * server's reply would take the stroke off the page under their hand.
 */
const useMarkFingerprintWatch = (
  editionId: string | null,
  live: boolean,
): void => {
  const queryClient = useQueryClient();
  const writing = useIsMutating({ mutationKey: annotationKeys.all }) > 0;

  const { data } = useQuery({
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

  const seen = useRef<string | null>(null);

  // Reset the baseline when the score changes, so opening a second edition
  // never reads the first one's fingerprint as "something is new here".
  useEffect(() => {
    seen.current = null;
  }, [editionId]);

  useEffect(() => {
    if (!editionId || !data) return;
    const signature = `${data.count}:${data.latest ?? ""}`;
    if (seen.current === null) {
      seen.current = signature;
      return;
    }
    if (seen.current === signature) return;
    seen.current = signature;
    void queryClient.invalidateQueries({
      queryKey: annotationKeys.byEdition(editionId),
    });
  }, [data, editionId, queryClient]);
};

const newMarkId = (): string =>
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
 * Create / update / delete / clear, scoped to one edition's cache.
 *
 * Two layers of safety net, and they do different jobs. The optimistic patch
 * answers the hand instantly while the request is in the air. The offline queue
 * is what survives the request failing: on a network error the cache is rolled
 * back to the server's truth and the write is queued, and the queue is what
 * `useScoreAnnotations` composes back onto the page. A genuine rejection (403 on
 * reserved ink, 400 on a malformed payload) is NOT queued — it rolls back and
 * stays rolled back, which is the honest answer.
 */
export const useAnnotationMutations = (
  editionId: string | null,
  options?: AnnotationsOptions,
) => {
  const queryClient = useQueryClient();
  const key = annotationKeys.byEdition(editionId ?? "none");
  const isCleared = options?.isCleared ?? ALL_CLEARED;

  /** Apply a collapsed write to the durable queue. */
  const enqueue = useCallback((collapsed: CollapsedWrite, label: string) => {
    const store = useOfflineStore.getState();
    for (const queueId of collapsed.drop) store.dequeueWrite(queueId);
    if (!collapsed.replace) return;
    store.enqueueWrite({
      kind: "annotation",
      method: collapsed.replace.method,
      url: collapsed.replace.url,
      body: collapsed.replace.body,
      dedupeKey: collapsed.replace.dedupeKey,
      label,
      meta: collapsed.replace.meta,
    });
  }, []);

  const pendingFor = useCallback(
    () => pendingMarkEntries(useOfflineStore.getState().queue, editionId),
    [editionId],
  );

  const create = useMutation({
    mutationKey: annotationKeys.all,
    mutationFn: (annotation: ScoreAnnotation) =>
      AnnotationsService.create({
        id: annotation.id,
        edition: annotation.edition,
        page_number: annotation.page_number,
        annotation_type: annotation.annotation_type,
        payload: annotation.payload,
        color: annotation.color,
        layer_name: annotation.layer_name,
      }),
    onMutate: async (annotation) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<ScoreAnnotation[]>(key) ?? [];
      queryClient.setQueryData<ScoreAnnotation[]>(key, [...snapshot, annotation]);
      return { snapshot };
    },
    onError: (error, annotation, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
      if (isLikelyOfflineError(error)) {
        enqueue(collapseCreate(annotation), "Oznaczenie na nutach");
      }
    },
    onSuccess: (created, annotation) => {
      queryClient.setQueryData<ScoreAnnotation[]>(key, (current) =>
        (current ?? []).map((row) => (row.id === annotation.id ? created : row)),
      );
    },
  });

  const update = useMutation({
    mutationKey: annotationKeys.all,
    mutationFn: ({ id, patch }: { id: string; patch: AnnotationPatch }) =>
      AnnotationsService.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<ScoreAnnotation[]>(key) ?? [];
      queryClient.setQueryData<ScoreAnnotation[]>(key, (current) =>
        (current ?? []).map((row) =>
          row.id === id
            ? { ...row, ...patch, updated_at: new Date().toISOString() }
            : row,
        ),
      );
      return { snapshot };
    },
    onError: (error, { id, patch }, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
      if (isLikelyOfflineError(error) && editionId) {
        enqueue(
          collapseUpdate(pendingFor(), editionId, id, patch),
          "Oznaczenie na nutach",
        );
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ScoreAnnotation[]>(key, (current) =>
        (current ?? []).map((row) => (row.id === updated.id ? updated : row)),
      );
    },
  });

  const remove = useMutation({
    mutationKey: annotationKeys.all,
    mutationFn: (id: string) => AnnotationsService.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<ScoreAnnotation[]>(key) ?? [];
      queryClient.setQueryData<ScoreAnnotation[]>(
        key,
        snapshot.filter((row) => row.id !== id),
      );
      return { snapshot };
    },
    onError: (error, id, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
      if (isLikelyOfflineError(error) && editionId) {
        enqueue(
          collapseDelete(pendingFor(), editionId, id),
          "Skasowane oznaczenie",
        );
      }
    },
  });

  const clear = useMutation({
    mutationKey: annotationKeys.all,
    mutationFn: () => AnnotationsService.clear(editionId as string),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<ScoreAnnotation[]>(key) ?? [];
      queryClient.setQueryData<ScoreAnnotation[]>(
        key,
        snapshot.filter((row) => !isCleared(row)),
      );
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
      if (isLikelyOfflineError(error) && editionId) {
        enqueue(collapseClear(editionId), "Wyczyszczone oznaczenia");
      }
    },
  });

  /** Mint the identity a new mark will keep on every device, forever. */
  const draftAnnotation = useCallback(
    (partial: Omit<NewAnnotation, "edition">): ScoreAnnotation | null => {
      if (!editionId) return null;
      const now = new Date().toISOString();
      return {
        ...partial,
        id: newMarkId(),
        edition: editionId,
        created_by: null,
        created_at: now,
        updated_at: now,
      };
    },
    [editionId],
  );

  return { create, update, remove, clear, draftAnnotation };
};
