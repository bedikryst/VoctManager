/**
 * @file useIncomingMarks.ts
 * @description Marks that appeared while this stand was open and were not
 * written here.
 *
 * Only the reader's side is watched. In conductor mode the shared layer IS the
 * user's own hand, so announcing it back to them would be noise. Everyone else
 * hears about marks on the two layers written TO them: what the choir is told,
 * and — for whoever is taking the evening — the leader cues. A cue that arrives
 * an hour before a rehearsal somebody else is running is exactly the mark that
 * must not land silently. The author may be the conductor or a leader writing
 * for the choir, so whoever announces these must not name one. A leader's own
 * rows are left out by author: the draft carries their id from the moment it is
 * drawn, which keeps a mark they just made from coming back to them as news.
 * @module features/annotations/lib
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { ScoreAnnotation } from "../types/annotations.dto";

/** Marks that arrived from someone else, and the page the first of them is on. */
export interface IncomingMarks {
  count: number;
  page: number;
}

export const useIncomingMarks = ({
  annotations,
  isLoaded,
  editionId,
  watching,
  userId,
}: {
  annotations: readonly ScoreAnnotation[];
  /**
   * Whether `annotations` holds a real list yet. Before it, the page shows only
   * what this device queued, and taking THAT as the baseline would announce the
   * whole score as news the moment the list arrives.
   */
  isLoaded: boolean;
  editionId: string | null;
  watching: boolean;
  userId: string | null;
}): { marks: IncomingMarks | null; dismiss: () => void } => {
  const seen = useRef<Set<string> | null>(null);
  const [marks, setMarks] = useState<IncomingMarks | null>(null);

  // A different score is a different conversation — forget both the baseline
  // and anything still on screen from the last one.
  useEffect(() => {
    seen.current = null;
    setMarks(null);
  }, [editionId]);

  useEffect(() => {
    if (!watching || !editionId || !isLoaded) return;
    const incoming = annotations.filter(
      (a) =>
        (a.layer_name === "shared" || a.layer_name === "leader") &&
        a.created_by !== userId,
    );
    // The first real list is the baseline, not news: everything already on the
    // page when the reader opened it is simply the score they asked for.
    if (seen.current === null) {
      seen.current = new Set(incoming.map((a) => a.id));
      return;
    }
    const fresh = incoming.filter((a) => !seen.current?.has(a.id));
    if (fresh.length === 0) return;
    for (const mark of fresh) seen.current.add(mark.id);
    setMarks({
      count: fresh.length,
      page: Math.min(...fresh.map((a) => a.page_number)),
    });
  }, [annotations, editionId, isLoaded, userId, watching]);

  const dismiss = useCallback(() => setMarks(null), []);

  return { marks, dismiss };
};
