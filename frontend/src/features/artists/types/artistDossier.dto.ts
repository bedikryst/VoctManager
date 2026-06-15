/**
 * @file artistDossier.dto.ts
 * @description Read model for the manager-only Artist Dossier — the project
 * track record (stats + per-project casting history + attendance reliability)
 * served by GET /api/artists/{id}/dossier/. Derived from relational state on the
 * backend; the frontend only presents it.
 * @architecture Enterprise SaaS 2026
 */

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
  /** Settlement footprint (PLN). Declined invitations are excluded. */
  earnings_paid: number;
  earnings_outstanding: number;
  projects_paid: number;
}

export interface ArtistDossier {
  artist_id: string;
  stats: ArtistDossierStats;
  projects: DossierProject[];
}
