/**
 * @file leadSheet.dto.ts
 * @description One evening as the person running it receives it: the rehearsal,
 * the project it belongs to, and the choir to be called over.
 *
 * The cast rows are shaped as `Participation` + `Artist` on purpose. The roll
 * call in front of the choir is `ArtistRow`, and it must be the SAME control a
 * manager taps — a stand-in learning a second set of buttons on the evening they
 * are already nervous is the one thing this feature cannot afford. Anything that
 * control does not need (contact details, settlement) the server never sends.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/types
 */

import type { Artist, Participation, Rehearsal } from "@/shared/types";

/** One summoned singer, with the projection the register needs of them. */
export interface LeadSheetSeat extends Participation {
  artist_detail: Artist;
}

export interface LeadSheet {
  rehearsal: Rehearsal;
  project: {
    id: string;
    title: string;
    status: string;
  };
  /**
   * Whether the reader reached this page as a manager rather than through a
   * delegation. Stated by the server, never inferred from the read succeeding:
   * it decides what the page offers BESIDES the roll call — a span excusal is a
   * decision about somebody's standing in the choir, not part of running one
   * evening, and the server refuses it to a stand-in.
   */
  is_manager: boolean;
  cast: LeadSheetSeat[];
}
