/**
 * @file artistDossier.dto.ts
 * @description Read model for the manager-only Artist Dossier — the project
 * track record (stats + per-project casting history + attendance reliability +
 * project leadership) served by GET /api/artists/{id}/dossier/. Derived from
 * relational state on the backend; the frontend only presents it.
 * @architecture Enterprise SaaS 2026
 */

import type { DecimalString } from "@/features/finance/types/finance.dto";
import type { ParticipationStatus } from "@/shared/types";

export interface DossierCasting {
  piece_title: string;
  voice_line: string;
  voice_line_label: string;
  gives_pitch: boolean;
}

export interface DossierProject {
  project_id: string;
  title: string;
  date_time: string | null;
  /** Project lifecycle code: DRAFT | ACTIVE | DONE | CANC. */
  status: string;
  participation_status: ParticipationStatus;
  castings: DossierCasting[];
  /** The artist led this project (any leadership grant, live or ended). */
  led: boolean;
}

export interface DossierLeadershipScopes {
  marks: boolean;
  roll_call: boolean;
  materials: boolean;
  /** The one scope that is off by default: writing the choir's own layer. */
  choir_marks: boolean;
}

/**
 * One project the artist was appointed leader of. A led project the artist
 * is not cast in appears here and nowhere else in the dossier.
 */
export interface DossierLedProject {
  project_id: string;
  title: string;
  date_time: string | null;
  /** Project lifecycle code: DRAFT | ACTIVE | DONE | CANC. */
  status: string;
  /** The grant still opens something today: unexpired, not revoked, project open. */
  is_live: boolean;
  expires_at: string | null;
  scopes: DossierLeadershipScopes;
}

export interface ArtistDossierLeadership {
  projects_led: number;
  /** Past rehearsals the artist stood in front of (`Rehearsal.led_by`), not grants. */
  rehearsals_led: number;
  debriefs_written: number;
  projects: DossierLedProject[];
}

export interface DossierVoiceLine {
  voice_line: string;
  label: string;
  count: number;
}

export interface ArtistDossierStats {
  projects_total: number;
  projects_confirmed: number;
  projects_upcoming: number;
  projects_completed: number;
  invitations_pending: number;
  invitations_declined: number;
  /** confirmed / (confirmed + declined); null when the artist has never decided. */
  acceptance_rate: number | null;
  rehearsals_invited: number;
  attendance_present: number;
  attendance_late: number;
  attendance_absent: number;
  attendance_excused: number;
  /** (present + late) / (present + late + absent); null when nothing recorded. */
  attendance_rate: number | null;
  top_voice_lines: DossierVoiceLine[];
  /**
   * Settlement footprint (PLN, decimal strings), summed from the finance ledger
   * by artist. Paid counts every payment made; outstanding leaves out seats
   * that were declined or removed.
   */
  earnings_paid: DecimalString;
  earnings_outstanding: DecimalString;
  projects_paid: number;
}

export interface ArtistDossier {
  artist_id: string;
  stats: ArtistDossierStats;
  leadership: ArtistDossierLeadership;
  projects: DossierProject[];
}
