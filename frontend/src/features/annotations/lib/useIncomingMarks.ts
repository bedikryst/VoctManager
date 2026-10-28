/**
 * @file useIncomingMarks.ts
 * @description What is new on this score for this reader, what to tell them
 * about it, and how far to move their read pointer as they leave.
 *
 * Every reader hears about marks someone else wrote on the two layers written
 * TO a reader: what the choir is told, and the leader cues. For a singer that
 * is the conductor's hand, or a leader writing for the choir; for whoever is
 * taking the evening, the cues left for them; for the conductor, an
 * assistant's answer on the leader's layer and what a delegate wrote for the
 * choir. The author varies, so whoever announces these must not name one. The
 * reader's own rows are left out by author: the draft carries their id from
 * the moment it is drawn. A layer the reader has hidden is left out too, from
 * the notice, the halo and the pointer alike: a mark that was never on screen
 * has not been read.
 *
 * New is measured against the reader's pointer (`seen_at`), taken once per
 * edition per open, from the stand's first fingerprint. The set it picks out
 * stays put while the stand is open, so a mark keeps its halo for the whole
 * session rather than until the next poll. The reader hears about it twice at
 * most: once in the summary of what changed while they were away, and once
 * more if it arrives (or changes) while the stand is open.
 *
 * Leaving an edition — closing the stand, or turning from one piece of the
 * concert book into the next — sends the newest `content_at` the device drew,
 * but only for an edition whose pointer this open took. A score opened from the
 * cache with no signal, closed before the fingerprint answered, or a piece of
 * the book turned past on the way has had nothing measured against it, and its
 * news must wait for a visit that does. The app going to the background counts
 * as leaving too, and that pointer goes straight into the durable queue: a PWA
 * swiped away or evicted by iOS runs no cleanup at all.
 * @module features/annotations/lib
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ScoreAnnotation } from "../types/annotations.dto";
import { layerOf } from "./layers";
import {
  isNewSince,
  isWrittenToReader,
  newestContent,
  pagesOf,
  timeOf,
} from "./markSeen";
import type { LayerVisibility } from "./useAnnotationTools";

/** One line's worth of news, and the pages it is on (edition pages, ascending). */
export interface IncomingMarks {
  /**
   * `since` sums up what changed while the reader was away, once per open;
   * `live` announces marks that arrived while the stand was open.
   */
  kind: "since" | "live";
  count: number;
  pages: number[];
}

export interface IncomingMarksState {
  notice: IncomingMarks | null;
  dismiss: () => void;
  /** Marks new to this reader: since their last visit, or since this stand opened. */
  newMarks: ScoreAnnotation[];
}

interface Baseline {
  editionId: string;
  /** Instant; marks whose content is later are new. */
  time: number;
}

/** A mark that changes what it says after being announced is news again. */
const announcementKey = (mark: ScoreAnnotation): string =>
  `${mark.id}:${mark.content_at ?? ""}`;

export const useIncomingMarks = ({
  annotations,
  isLoaded,
  isSettled,
  editionId,
  watching,
  userId,
  visibleLayers,
  seenAt,
  onSeen,
}: {
  annotations: readonly ScoreAnnotation[];
  /** A real list is on hand, not only what this device queued. */
  isLoaded: boolean;
  /** Loaded, and no newer list on its way — the moment to sum up. */
  isSettled: boolean;
  editionId: string | null;
  watching: boolean;
  userId: string | null;
  /** The reader's layer switches; a hidden layer is neither news nor read. */
  visibleLayers: LayerVisibility;
  /** The reader's pointer from the fingerprint; undefined until it answers. */
  seenAt: string | null | undefined;
  /**
   * Moves the pointer for an edition the reader is leaving. `durable`: the page
   * may not live to hear an answer, so the pointer goes straight to the queue.
   */
  onSeen: (editionId: string, at: string, durable: boolean) => void;
}): IncomingMarksState => {
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [notice, setNotice] = useState<IncomingMarks | null>(null);
  const summarized = useRef(false);
  const announced = useRef(new Set<string>());
  /**
   * Per edition: the pointer an open started from, and what was sent since.
   * Kept across opens, so a reopened stand never shows as new what its last
   * `seen` is still carrying to the server.
   */
  const pointers = useRef(new Map<string, number>());
  /** The editions whose pointer THIS open took: the only ones it may move. */
  const measured = useRef(new Set<string>());
  /** Per edition: the newest content the device drew, as the server spelled it. */
  const drawnUpTo = useRef(new Map<string, string>());
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  // A new open measures afresh. Cleared as the open starts rather than as it
  // ends: the closing stand's own `seen` is sent from a cleanup, which runs
  // before any effect of the render that closed it.
  useEffect(() => {
    if (watching) measured.current.clear();
  }, [watching]);

  // A different score, or the same one opened again, is a different
  // conversation — forget the baseline and anything still on screen.
  useEffect(() => {
    summarized.current = false;
    announced.current = new Set();
    setBaseline(null);
    setNotice(null);
  }, [editionId, watching]);

  // The pointer is taken once per edition per open, and never earlier than one
  // this open has already sent: returning to a piece of the book the reader
  // just left must not show its marks as new again while that `seen` is still
  // on its way.
  useEffect(() => {
    if (!watching || !editionId || seenAt === undefined) return;
    if (baseline?.editionId === editionId) return;
    // No pointer at all means the edition is gone: nothing on it is news.
    const server = timeOf(seenAt) ?? Number.POSITIVE_INFINITY;
    const sent = pointers.current.get(editionId) ?? Number.NEGATIVE_INFINITY;
    const time = Math.max(server, sent);
    pointers.current.set(editionId, time);
    measured.current.add(editionId);
    setBaseline({ editionId, time });
  }, [baseline, editionId, seenAt, watching]);

  const addressed = useMemo(
    () =>
      watching
        ? annotations.filter(
            (mark) => isWrittenToReader(mark, userId) && visibleLayers[layerOf(mark)],
          )
        : [],
    [annotations, userId, visibleLayers, watching],
  );

  const newMarks = useMemo(() => {
    if (!baseline || baseline.editionId !== editionId) return [];
    return addressed.filter((mark) => isNewSince(mark, baseline.time));
  }, [addressed, baseline, editionId]);

  useEffect(() => {
    if (!watching || !baseline || baseline.editionId !== editionId) return;
    if (!summarized.current) {
      // Summed up from a settled list only: one restored from the snapshot
      // would leave out what the network is about to bring, and that would
      // then arrive as a second, "live" line.
      if (!isLoaded || !isSettled) return;
      summarized.current = true;
      for (const mark of newMarks) announced.current.add(announcementKey(mark));
      if (newMarks.length > 0) {
        setNotice({ kind: "since", count: newMarks.length, pages: pagesOf(newMarks) });
      }
      return;
    }
    const fresh = newMarks.filter((mark) => !announced.current.has(announcementKey(mark)));
    if (fresh.length === 0) return;
    for (const mark of fresh) announced.current.add(announcementKey(mark));
    setNotice({ kind: "live", count: fresh.length, pages: pagesOf(fresh) });
  }, [baseline, editionId, isLoaded, isSettled, newMarks, watching]);

  useEffect(() => {
    if (!editionId || !isLoaded) return;
    const newest = newestContent(addressed);
    if (newest) drawnUpTo.current.set(editionId, newest);
  }, [addressed, editionId, isLoaded]);

  /**
   * Sends one edition's pointer, if this open measured the edition and the
   * device drew further than was already sent. Reads only refs, which are
   * written in place and never replaced, so it is stable for the hook's life.
   */
  const moveSeen = useCallback((edition: string, durable: boolean): void => {
    if (!measured.current.has(edition)) return;
    const at = drawnUpTo.current.get(edition);
    const time = timeOf(at);
    if (!at || time === null) return;
    if (time <= (pointers.current.get(edition) ?? Number.NEGATIVE_INFINITY)) return;
    pointers.current.set(edition, time);
    onSeenRef.current(edition, at, durable);
  }, []);

  // Leaving the edition: its cleanup runs before the next edition's effects,
  // so it still reads this edition's entries.
  useEffect(() => {
    if (!watching || !editionId) return;
    return () => moveSeen(editionId, false);
  }, [editionId, moveSeen, watching]);

  // The app leaving the foreground. Every edition this open measured is sent,
  // since in the book the reader may have read several before the switch.
  useEffect(() => {
    if (!watching) return;
    const leave = (): void => {
      for (const edition of measured.current) moveSeen(edition, true);
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") leave();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
    };
  }, [moveSeen, watching]);

  const dismiss = useCallback(() => setNotice(null), []);

  return { notice, dismiss, newMarks };
};
