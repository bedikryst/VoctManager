/**
 * @file materials.dto.ts
 * @description Feature-local types for the Materials dashboard.
 * These types mirror the shape returned by GET /api/participations/materials-dashboard/
 * and are intentionally self-contained — no cross-feature type dependencies.
 */

export interface MaterialsComposer {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  birth_year: string;
  death_year: string;
  // Score Compiler enrichments (may be empty for manually-entered composers).
  nationality?: string;
  period?: string;
  bio?: string;
  portrait_url?: string;
  mbid?: string | null;
  wikidata_qid?: string;
}

export interface MaterialsTranslation {
  id: string;
  target_language: string;
  text: string;
  is_singable: boolean;
}

export type MaterialsRecordingSource = "SPF" | "YTB" | "APL" | "OTH";

export interface MaterialsRecording {
  id: string;
  source: MaterialsRecordingSource;
  source_display: string;
  external_id: string;
  url: string;
  performer: string;
  year: number | null;
  duration_seconds: number | null;
  is_featured: boolean;
}

export interface MaterialsProgramNote {
  id: string;
  language: string;
  target_tone: string;
  word_count_target: number;
  content: string;
  is_approved: boolean;
}

export type MaterialsIngestionStatus =
  | "PEND"
  | "EXTR"
  | "ENRI"
  | "GENR"
  | "AWAI"
  | "RDY "
  | "FAIL";

export interface MaterialsEdition {
  id: string;
  pdf_file: string;
  /** Server-computed: may this edition leave the app? False → in-app only. */
  can_export?: boolean;
  original_filename: string;
  publisher: string;
  edition_year: number | null;
  editor_name: string;
  page_count: number | null;
  is_default: boolean;
  ingestion_status: MaterialsIngestionStatus;
  created_at: string;
}

export interface MaterialsLocation {
  id: string;
  name: string;
  category: string;
  timezone: string;
}

export interface MaterialsTrack {
  id: string;
  voice_part: string;
  voice_part_display: string;
  audio_file: string;
}

export interface MaterialsCasting {
  id: string;
  artist_id: string;
  artist_name: string;
  voice_line: string;
  voice_line_display: string;
  gives_pitch: boolean;
  notes: string;
  is_me: boolean;
}

export type MaterialsReadinessStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY";

/**
 * One rehearsal starting pitch (the list keeps top voice first): `note` is a
 * chromatic index (0=C … 11=B/H), `octave` in scientific pitch notation.
 * Mirrors `shared/types` StartingPitch — kept local per this file's
 * no-cross-feature-deps contract.
 */
export interface MaterialsStartingPitch {
  voice: string;
  note: number;
  octave: number;
}

export interface MaterialsPiece {
  id: string;
  title: string;
  composer: MaterialsComposer | null;
  language: string;
  estimated_duration: number | null;
  voicing: string;
  epoch: string;
  lyrics_original: string;
  // AI-enriched fields (may be empty for manually-entered pieces).
  opus_catalog: string;
  musical_key: string;
  starting_pitches: MaterialsStartingPitch[];
  text_source: string;
  lyrics_ipa: string;
  mbid_work: string | null;
  translations: MaterialsTranslation[];
  recordings: MaterialsRecording[];
  program_notes: MaterialsProgramNote[];
  editions: MaterialsEdition[];
  tracks: MaterialsTrack[];
  castings: MaterialsCasting[];
  my_casting: MaterialsCasting | null;
  my_readiness: MaterialsReadinessStatus;
}

export interface MaterialsProgramItem {
  order: number;
  is_encore: boolean;
  piece: MaterialsPiece;
}

export interface MaterialsProject {
  id: string;
  title: string;
  date_time: string;
  status: string;
  status_display: string;
  location: MaterialsLocation | null;
}

export interface MaterialsDashboardItem {
  /** Null for a project the user only conducts (they have no participation). */
  participation_id: string | null;
  /** Null for a conductor row — there is no participation to have a status. */
  participation_status: string | null;
  /** True when this project is one the user conducts, not one they sing in. */
  is_conducting: boolean;
  fee: string | null;
  project: MaterialsProject;
  program: MaterialsProgramItem[];
}

export interface MaterialsDashboardGroup {
  project: MaterialsProject;
  /** Null for a conductor-only group (no self-report / readiness target). */
  participationId: string | null;
  participationStatus: string | null;
  /** The user leads this project rather than singing in it. */
  isConducting: boolean;
  program: MaterialsProgramItem[];
}
