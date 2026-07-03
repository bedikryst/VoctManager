/**
 * @file index.ts
 * @description Comprehensive Data Dictionary for the production frontend.
 * Directly maps to Django backend models (roster & archive applications).
 * @architecture Enterprise SaaS 2026
 * @module shared/types
 */

import type { ProjectStatus } from "@features/projects/constants/projectDomain";

export interface BaseModel {
  id: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
}

// ==========================================
// STRICT DOMAIN ENUMS
// ==========================================

export type VoiceType =
  | "SOP"
  | "MEZ"
  | "ALT"
  | "CT"
  | "TEN"
  | "BAR"
  | "BAS"
  | "DIR";

export type ParticipationStatus = "INV" | "CON" | "DEC";
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
export type CollaboratorSpecialty =
  | "SOUND"
  | "LIGHT"
  | "VISUALS"
  | "INSTRUMENT"
  | "LOGISTICS"
  | "OTHER";
export type CrewAssignmentStatus = "INV" | "CON";
export type Epoch =
  | "MED"
  | "REN"
  | "BAR"
  | "CLA"
  | "ROM"
  | "M20"
  | "CON"
  | "POP"
  | "FOLK"
  | "OTH";

export type VoiceLine =
  | "S1"
  | "S2"
  | "S3"
  | "A1"
  | "A2"
  | "A3"
  | "T1"
  | "T2"
  | "T3"
  | "B1"
  | "B2"
  | "B3"
  | "SOLO"
  | "VP"
  | "TUTTI"
  | "BACK"
  | "ACC"
  | "PRON";

export interface VoiceLineOption {
  value: VoiceLine;
  label: string;
}

export interface VoiceTypeOption {
  value: string;
  label: string;
}

// ==========================================
// DOMAIN ENTITIES: ROSTER & PROJECTS
// ==========================================

export interface Artist extends BaseModel {
  user?: string | null;
  avatar_thumb_url?: string | null;
  first_name: string;
  last_name: string;
  first_name_vocative?: string;
  email?: string;
  phone_number?: string;
  voice_type: VoiceType;
  voice_type_display?: string;
  is_active: boolean;
  username?: string | null;
  is_manager?: boolean;
  sight_reading_skill?: number | null;
  vocal_range_bottom?: string;
  vocal_range_top?: string;
}

export interface RunSheetItem {
  id?: string | number;
  time: string;
  title: string;
  description?: string;
  activity?: string;
  details?: string;
}

/**
 * Read-only snippet returned by `LocationSnippetSerializer`. Used inline on
 * Project / Rehearsal payloads. For the full Location record (address,
 * coords, notes) use `Location`.
 */
export interface LocationSnippet {
  id: string;
  name: string;
  category: LocationCategory | string;
  timezone: string;
}

/**
 * Snippet shape returned inline on Project.program (built by
 * ProjectSerializer.get_program). Does NOT carry an id / project / piece FK —
 * those are only present on the full `ProgramItem` row from
 * /api/program-items/.
 */
export interface ProjectProgramItem {
  order: number;
  piece_id: string | number;
  title: string;
  is_encore: boolean;
}

export interface Project extends BaseModel {
  title: string;
  date_time: string;
  timezone: string;
  call_time?: string | null;
  dress_code_male?: string | null;
  dress_code_female?: string | null;
  location?: LocationSnippet | null;
  // Read shape from API is the FK id (or null). Some frontend hooks enrich
  // this into the full Artist after joining against the artists dictionary.
  conductor?: string | Artist | null;
  conductor_name?: string | null;
  description?: string | null;
  spotify_playlist_url?: string | null;
  score_pdf?: string | null;
  status: ProjectStatus;
  run_sheet?: RunSheetItem[];
  program?: ProjectProgramItem[];
  cast?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    voice_type: VoiceType;
    voice_type_display: string;
  }>;
  rehearsals_total?: number;
  rehearsals_upcoming?: number;
  cast_total?: number;
  cast_confirmed?: number;
  cast_pending?: number;
  cast_declined?: number;
  crew_total?: number;
  pieces_total?: number;
}

export interface Participation extends BaseModel {
  artist: string;
  project: string;
  status: ParticipationStatus;
  fee?: string | number | null;
  // Settlement state — mutated only through the dedicated `payment` action.
  is_paid?: boolean;
  paid_at?: string | null;
  artist_name?: string;
  project_name?: string;
  artist_voice_type_display?: string;
}

export interface Rehearsal extends BaseModel {
  project: string;
  date_time: string;
  timezone: string;
  location?: LocationSnippet | null;
  focus?: string;
  is_mandatory: boolean;
  invited_participations?: string[];
  absent_count?: number;
}

// Backend Attendance is a plain models.Model (no soft-delete / timestamps in
// the API response), and status always has a default — so it's never null.
export interface Attendance {
  id: string;
  rehearsal: string;
  participation: string;
  status: AttendanceStatus;
  minutes_late?: number | null;
  excuse_note?: string | null;
}

export interface Collaborator extends BaseModel {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone_number?: string;
  company_name?: string;
  specialty: CollaboratorSpecialty;
}

// Backend CrewAssignment is a plain models.Model — no soft-delete fields.
export interface CrewAssignment {
  id: string;
  collaborator: string;
  project: string;
  role_description?: string;
  status: CrewAssignmentStatus;
  fee?: string | number | null;
  // Settlement state — mutated only through the dedicated `payment` action.
  is_paid?: boolean;
  paid_at?: string | null;
  collaborator_name?: string;
  collaborator_specialty_display?: string;
}

// ==========================================
// DOMAIN ENTITIES: LOGISTICS
// ==========================================

export type LocationCategory =
  | "CONCERT_HALL"
  | "CHURCH"
  | "REHEARSAL_ROOM"
  | "HOTEL"
  | "AIRPORT"
  | "TRANSIT_STATION"
  | "WORKSPACE"
  | "OTHER";

export interface Location extends BaseModel {
  name: string;
  category: LocationCategory;
  google_place_id?: string | null;
  formatted_address: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  timezone: string;
  internal_notes?: string;
  is_active: boolean;
}

// ==========================================
// DOMAIN ENTITIES: ARCHIVE
// ==========================================

export interface Composer extends BaseModel {
  first_name?: string;
  last_name: string;
  birth_year?: string;
  death_year?: string;
  // AI enrichments (canonical identity + biography). All optional —
  // composers entered manually pre-pipeline won't have them.
  full_name?: string;
  mbid?: string | null;
  wikidata_qid?: string;
  nationality?: string;
  period?: Epoch | "";
  bio?: string;
  portrait_url?: string;
  portrait_license?: string;
  aliases?: string[];
  // Server-annotated fields exposed by the composer list endpoint.
  pieces_count?: number;
  is_orphan?: boolean;
}

// Backend PieceVoiceRequirement model extends EnterpriseBaseModel but the
// serializer only exposes the 5 fields below.
export interface VoiceRequirement {
  id?: string;
  piece?: string;
  voice_line: VoiceLine;
  voice_line_display?: string;
  quantity: number;
}

// Backend Track model extends EnterpriseBaseModel but TrackSerializer only
// exposes the 5 fields below.
export interface Track {
  id: string;
  piece: string;
  voice_part: VoiceLine;
  voice_part_display?: string;
  audio_file: string;
}

// ---- Score Compiler nested entities ----------------------------------------

// Backend Movement / Translation / Recording / ProgramNote models extend
// EnterpriseBaseModel, but their respective read serializers only expose the
// explicit fields listed below (no created_at / updated_at / is_deleted in
// the API response).

export interface Movement {
  id: string;
  order_index: number;
  title: string;
  tempo_marking?: string;
  duration_seconds?: number | null;
  voicing_override?: string;
  starts_on_page?: number | null;
}

export interface Translation {
  id: string;
  movement?: string | null;
  target_language: string;
  text: string;
  is_singable: boolean;
  translator: string;
}

export type RecordingSource = "SPF" | "YTB" | "APL" | "OTH";

export interface Recording {
  id: string;
  source: RecordingSource;
  source_display?: string;
  external_id: string;
  url: string;
  performer?: string;
  year?: number | null;
  duration_seconds?: number | null;
  is_featured: boolean;
}

export interface ProgramNote {
  id: string;
  project?: string | null;
  language: string;
  target_tone: string;
  word_count_target: number;
  content: string;
  is_approved: boolean;
}

/** Where a single field's value came from — mirrors backend ProvenanceSource. */
export type ProvenanceSourceCode =
  | "MAN" // manual / human-verified
  | "AIH" // AI — Haiku
  | "AIS" // AI — Sonnet
  | "AIO" // AI — Opus
  | "MBZ" // MusicBrainz
  | "WKD" // Wikidata
  | "SPF" // Spotify
  | "YTB" // YouTube
  | "IMS"; // IMSLP

export interface ProvenanceEntry {
  source: ProvenanceSourceCode;
  source_display: string;
  /** AI self-rated confidence 0..1 (1 for canonical/manual sources). */
  confidence: number;
  model_version: string;
  retrieved_at: string | null;
}

/**
 * Per-field provenance for a piece + its children, keyed `"<objectId>:<field>"`.
 * Only populated on the piece-detail endpoint (the AI Review cockpit). Lets the
 * UI show, per field, whether a value is AI-suggested (and how confident),
 * canonical (MusicBrainz/Wikidata), or human-verified.
 */
export type ProvenanceMap = Record<string, ProvenanceEntry>;

export type IngestionStatusCode =
  | "PEND"
  | "EXTR"
  | "ENRI"
  | "GENR"
  | "AWAI"
  | "RDY "
  | "FAIL";

/**
 * Fine-grained "what is the AI doing right now" step, set by the backend at the
 * start of each pipeline task. Empty string = no step active (queued or done).
 * Distinct from {@link IngestionStatusCode}: one coarse status (e.g. GENR) spans
 * several of these steps. Backend source of truth: `archive.models.IngestionProgress`.
 */
export type IngestionProgressCode =
  | ""
  | "preparing"
  | "analyzing"
  | "resolving"
  | "persisting"
  | "program_note"
  | "recordings"
  | "waiting_overload";

/**
 * Live partial-analysis preview, published (throttled, ~1.2s) by the backend
 * while Claude streams its reading of the score — the record materialising in
 * real time. Present only during the `analyzing` step; null/absent otherwise.
 * Backend source of truth: `archive.tasks._LiveAnalysisProgress`.
 */
export interface LiveAnalysisPreview {
  /** Which part of the record the model is writing right now. */
  section: "identity" | "movements" | "sung_text" | "ipa" | "translations";
  /** Work title, the moment it appears in the stream. */
  title?: string | null;
  /** Composer, the moment it appears in the stream. */
  composer?: string | null;
  /** Movements detected so far. */
  movements?: number;
  /** Raw streamed characters — a cheap liveness signal. */
  chars?: number;
}

/**
 * Status codes as named constants. Always prefer these over string literals —
 * the backend stores 'RDY ' (with trailing space, max_length=4) and getting
 * the spacing wrong silently breaks comparisons.
 */
export const INGESTION_STATUS = {
  PENDING: "PEND",
  EXTRACTING: "EXTR",
  ENRICHING: "ENRI",
  GENERATING: "GENR",
  AWAITING: "AWAI",
  READY: "RDY ",
  FAILED: "FAIL",
} as const satisfies Record<string, IngestionStatusCode>;

export const INGESTION_TERMINAL_STATUSES: ReadonlySet<IngestionStatusCode> =
  new Set([
    INGESTION_STATUS.AWAITING,
    INGESTION_STATUS.READY,
    INGESTION_STATUS.FAILED,
  ]);

export const isIngestionInProgress = (status: IngestionStatusCode): boolean =>
  !INGESTION_TERMINAL_STATUSES.has(status);

/**
 * ScoreEdition summary embedded in Piece read responses. Carries enough to
 * render PDF download links, status chips, and the per-edition cost report.
 * The full review payload (annotations, sha256) is fetched separately by the
 * AI Review tab when a specific edition is opened.
 */
export interface ScoreEditionSummary extends BaseModel {
  pdf_file?: string;
  original_filename: string;
  publisher?: string;
  edition_year?: number | null;
  editor_name?: string;
  page_count?: number | null;
  is_default: boolean;
  ingestion_status: IngestionStatusCode;
  ingestion_status_display?: string;
  ingestion_progress?: IngestionProgressCode;
  ingestion_cost_cents?: number;
  ingestion_cost_cents_lifetime?: number;
  ingestion_error?: string;
}

export interface Piece extends BaseModel {
  title: string;
  // Read shape: nested composer object. Write payloads use `composer_id`
  // (see PieceWriteDTO in features/archive).
  composer?: Composer | null;

  arranger?: string;
  language?: string;
  estimated_duration?: number | null; // seconds
  voicing?: string;
  description?: string;
  lyrics_original?: string;

  composition_year?: number | null;
  epoch?: Epoch | "";
  epoch_display?: string;

  // AI/external-source identifiers.
  opus_catalog?: string;
  musical_key?: string;
  text_source?: string;
  lyrics_ipa?: string;
  mbid_work?: string | null;

  // Derived from editions[] by the backend serializer — never stored on Piece.
  ingestion_status?: IngestionStatusCode;
  ingestion_status_display?: string;

  // Per-field source attribution + confidence. Only present on the piece-detail
  // (review) endpoint; empty/undefined on the list. See {@link ProvenanceMap}.
  provenance?: ProvenanceMap;

  // Nested relations — read-only on this serializer; each has its own write endpoint.
  tracks: Track[];
  voice_requirements_read?: VoiceRequirement[];
  movements: Movement[];
  translations: Translation[];
  recordings: Recording[];
  program_notes: ProgramNote[];
  editions: ScoreEditionSummary[];
}

/**
 * Full ProgramItem row returned by /api/program-items/. The lite shape
 * embedded inline on Project.program lives under `ProjectProgramItem`.
 * Backend ProgramItem is a plain models.Model so there are no soft-delete
 * or timestamp fields in the API response.
 */
export interface ProgramItem {
  id: string;
  project: string | number;
  piece: string | number;
  piece_title?: string;
  order: number;
  is_encore: boolean;
}

// Backend ProjectPieceCasting is a plain models.Model — no soft-delete fields.
export interface PieceCasting {
  id: string;
  participation: string;
  piece: string;
  voice_line: VoiceLine;
  gives_pitch: boolean;
  notes?: string;

  voice_line_display?: string;
  artist_name?: string;
  project_id?: string;
  artist_id?: string;
}
