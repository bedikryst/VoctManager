/**
 * @file useScheduleSubject.ts
 * @description Whose timeline the schedule read model is about, and whether
 * that person holds a seat to write from. Two different facts that used to be
 * carried by one artist id, which is why a manager with no Artist row got an
 * empty calendar: no id meant no cache key and no request, so the server never
 * got the chance to answer for them.
 * @module panel/schedule/hooks/useScheduleSubject
 */

import { useMemo } from "react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useArtistPreview } from "@/app/providers/ArtistPreviewProvider";

export interface ScheduleSubject {
  /**
   * Cache identity of the reader. The artist id where there is one, so the
   * query keys (and the route preloader that warms them) stay exactly as they
   * were; a per-user key otherwise.
   */
  key: string;
  /**
   * The roster seat this timeline is read through — the RSVP target, the
   * absence-range subject, and the row the cast lists highlight as "me". Null
   * for a reader who has none: a manager running the choir from the office. The
   * server sends them the same evenings with no participation attached, so
   * every affordance that needs a seat is already absent.
   */
  artistId: string | number | null;
}

export const useScheduleSubject = (): ScheduleSubject | undefined => {
  const { user } = useAuth();
  const { isPreview, artist: previewArtist } = useArtistPreview();

  return useMemo(() => {
    // Inside a preview the timeline belongs to the member being looked at, not
    // to the manager reading over their shoulder — including the absence-range
    // write, which must name them.
    const artistId = (isPreview ? previewArtist?.id : user?.artist_profile_id) ?? null;
    if (artistId) return { key: String(artistId), artistId };
    // A preview of a member with no roster row is not a reader of its own; it
    // would otherwise fall through to the manager's own season.
    if (isPreview || !user?.id) return undefined;
    return { key: `viewer-${user.id}`, artistId: null };
  }, [isPreview, previewArtist?.id, user?.artist_profile_id, user?.id]);
};
