/**
 * @file project.service.ts
 * @description Pure HTTP service for the Project domain.
 * Keeps transport logic isolated from React state and presentation concerns.
 * @architecture Enterprise SaaS 2026
 */

import type { AxiosResponse } from "axios";

import api from "@/shared/api/api";
import type {
  Artist,
  Attendance,
  Collaborator,
  CrewAssignment,
  Participation,
  Piece,
  PieceCasting,
  ProgramItem,
  Project,
  Rehearsal,
  ScoreLicenseType,
  VoiceLineOption,
} from "@/shared/types";
import type {
  AttendanceCreateDTO,
  AttendanceUpdateDTO,
  CrewAssignmentCreateDTO,
  CrewAssignmentUpdateDTO,
  ParticipationCreateDTO,
  ParticipationUpdateDTO,
  PieceCastingBoardDTO,
  PieceCastingBoardsDTO,
  ProgramItemCreateDTO,
  ProgramItemUpdateDTO,
  ProjectBulkFeeDTO,
  ProjectCreateDTO,
  ProjectUpdateDTO,
  RehearsalCreateDTO,
  RehearsalUpdateDTO,
} from "../types/project.dto";

const PROJECTS_BASE_URL = "/api/projects/";
const PARTICIPATIONS_BASE_URL = "/api/participations/";
const REHEARSALS_BASE_URL = "/api/rehearsals/";
const CREW_ASSIGNMENTS_BASE_URL = "/api/crew-assignments/";
const PROGRAM_ITEMS_BASE_URL = "/api/program-items/";
const PIECE_CASTINGS_BASE_URL = "/api/piece-castings/";
const ATTENDANCES_BASE_URL = "/api/attendances/";
const PIECES_BASE_URL = "/api/pieces/";
const ARTISTS_BASE_URL = "/api/artists/";
const COLLABORATORS_BASE_URL = "/api/collaborators/";
const VOICE_LINES_BASE_URL = "/api/options/voice-lines/";

const buildListUrl = (
  baseUrl: string,
  params: Record<string, string | number>,
): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  return `${baseUrl}?${searchParams.toString()}`;
};

export type ProjectReportEndpoint =
  | "export_call_sheet"
  | "export_day_sheet"
  | "export_zaiks"
  | "export_dtp";

/**
 * One moment of the Mass, as the server names it. Both `label` and `part_label`
 * arrive resolved in the reader's language: the client picks a slot by `value`
 * and never composes, translates or renumbers a name of its own (a second copy
 * of one moment's name is a singer reading two names for one moment).
 */
export interface LiturgicalSlotOption {
  value: string;
  label: string;
  part: string;
  part_label: string;
  /** `function` slots are the ones whose name also prints before the title. */
  kind: "ordinary" | "proper" | "function";
}

/**
 * The whole vocabulary, in canonical order of the rite — the array order IS the
 * canonical rank, which is what the "order by liturgy" action sorts against.
 * `templates` lists which slots each kind of event is offered first.
 */
export interface LiturgicalSlotVocabulary {
  slots: LiturgicalSlotOption[];
  templates: Record<string, string[]>;
}

/** One programme piece in the conductor's readiness heatmap. */
export interface ProjectReadinessSummaryEntry {
  piece_id: string;
  piece_title: string;
  order: number;
  total_cast: number;
  ready: number;
  in_progress: number;
  not_started: number;
}

/**
 * Language-neutral gaps the server found in a project about to be published.
 * They are advisory: an incomplete project may still be a deliberate
 * announcement, so the decision stays the conductor's.
 */
export type ProjectPublicationWarning =
  | "no_cast"
  | "no_rehearsals"
  | "no_program"
  | "no_location"
  | "unreachable_artists";

export interface ProjectPublicationRecipient {
  participation_id: string;
  artist_name: string;
  /** False when the artist has no account yet — they are on the roster but no
   *  message can reach them. */
  is_reachable: boolean;
}

export interface ProjectPublicationPreview {
  project_id: string;
  status: string;
  is_publishable: boolean;
  /** People who will actually be written to. */
  recipient_count: number;
  recipients: ProjectPublicationRecipient[];
  /** Cast members deliberately not addressed — they already answered. */
  skipped_count: number;
  warnings: ProjectPublicationWarning[];
}

export type AnnouncementSubject =
  | "PROJECT"
  | "REHEARSAL"
  | "CASTING"
  | "PARTICIPATION";
export type AnnouncementKind = "CREATED" | "CHANGED" | "REMOVED";
export type AnnouncementLevel = "INFO" | "WARNING" | "URGENT";

/**
 * One line of the conductor's review sheet — the unit a checkbox holds back. A
 * project diff is one line per field (the venue can go out while a call time
 * waits); a creation, a removal or a rehearsal's whole diff is one indivisible
 * line. `metadata` is the payload the emitter built, so the sheet renders the
 * line from exactly the facts the artist's own message will carry.
 */
export interface AnnouncementChange {
  id: string;
  /** The pending rows this line stands for — what `exclude`/`discard` act on. */
  row_ids: string[];
  subject_type: AnnouncementSubject;
  subject_id: string;
  kind: AnnouncementKind;
  notification_type: string;
  level: AnnouncementLevel;
  /** The single field this line reports, when it is one line of a wider diff;
   *  empty for anything indivisible. */
  field: string;
  metadata: Record<string, unknown>;
  /** How many people this line reaches. */
  recipient_count: number;
  /** Whose part this is, for a personal line — above all, who is about to be told
   *  they are off the cast. Empty for a broadcast. */
  recipient_name: string;
  /** Held back by the conductor (or by the rule that holds a whole subject when
   *  its creation is held). The row stays pending; nothing is discarded. */
  is_held: boolean;
}

/** One reader's share of the publication — the fold seen from their side. */
export interface AnnouncementRecipientShare {
  recipient_id: string;
  name: string;
  /** The change ids that reach this person. */
  change_ids: string[];
  /** True when their several changes arrive as one composite briefing. */
  is_briefing: boolean;
}

export interface AnnouncementReview {
  project_id: string;
  /** Raw rows still waiting — higher than `change_count` when a value moved back. */
  pending_count: number;
  /** How many distinct changes the sheet lists. */
  change_count: number;
  /** How many messages the current selection would actually send, counted in
   *  envelopes rather than events — one change broadcast to twelve singers is
   *  twelve. This is the number on the confirm button. */
  message_count: number;
  briefing_count: number;
  recipient_count: number;
  /** True when the queue holds a cast removal — discarding it wholesale would
   *  leave that person removed and never told. */
  has_cast_removal: boolean;
  changes: AnnouncementChange[];
  recipients: AnnouncementRecipientShare[];
}

export interface AnnouncementPublishResult {
  announcements: number;
  messages: number;
  briefings: number;
  recipients: number;
  rows: number;
  held: number;
}

export type ScorePackageStatus = "IDLE" | "QUED" | "BLDG" | "RDY" | "FAIL";

export interface ScorePackageConfig {
  density_mode: "CONCERT" | "MASS";
  include_title_page: boolean;
  include_toc: boolean;
  include_page_numbers: boolean;
  include_bookmarks: boolean;
  normalize_to_a4: boolean;
  duplex_mode: boolean;
  /** Cover the page numbers the editions print themselves, so the book carries
   *  only its own continuous folio. Detected from the PDF's text layer; a
   *  scanned edition without one keeps its numbering. */
  hide_source_page_numbers: boolean;
  include_cards: boolean;
  /** Book-wide default set of card elements. Per-item cards inherit this list
   *  unless they pin their own — global default, per-item override, same
   *  element vocabulary on both surfaces. */
  card_default_elements: CardElement[];
  translation_language: string;
}

/** Toggleable element of a per-piece frontispiece card. */
export type CardElement =
  | "eyebrow"
  | "meta"
  | "cast"
  | "movements"
  | "text"
  | "translation"
  | "note"
  | "ipa";

/** Traffic light for a single card element's data. `na` = the element cannot
 * meaningfully exist for this piece (e.g. a translation when the piece is
 * already sung in the book's language) — informational, never a gap. */
export type ElementStatus = "ready" | "low" | "missing" | "na";

/** Roll-up readiness for one program item. */
export type ItemReadinessOverall = "ready" | "low" | "incomplete" | "no_edition";

export interface ScorePackageEditionOption {
  id: string;
  label: string;
  page_count: number | null;
  is_default: boolean;
  ingestion_status: string;
  license_type: ScoreLicenseType;
  copies_owned: number | null;
}

/** Set when a LICENSED_COPIES edition is bound for more singers than owned copies. */
export interface CopiesShortfall {
  copies_owned: number;
  cast_size: number;
}

/** One piece-level translation the conductor can pin to an item's card; the
 * cockpit composes the display label (language + singable/literal) via i18n. */
export interface ScorePackageTranslationOption {
  id: string;
  language: string;
  is_singable: boolean;
  translator: string;
}

export interface ScorePackageItemReadiness {
  overall: ItemReadinessOverall;
  elements: Record<CardElement, ElementStatus>;
}

/** One program item as rendered in the build cockpit, with its overrides. */
export interface ScorePackageItem {
  id: string;
  order: number;
  piece_id: string;
  title: string;
  composer: string;
  is_encore: boolean;
  editions: ScorePackageEditionOption[];
  explicit_edition_id: string | null;
  selected_edition_id: string | null;
  edition_page_count: number | null;
  /** Licence of the resolved edition; null when no edition binds. */
  selected_license_type: ScoreLicenseType | null;
  /** Present when the bound licensed edition is short of copies for the cast. */
  copies_shortfall: CopiesShortfall | null;
  has_pdf: boolean;
  suggested_start: number | null;
  pdf_page_start: number | null;
  pdf_page_end: number | null;
  translations: ScorePackageTranslationOption[];
  explicit_translation_id: string | null;
  selected_translation_id: string | null;
  performers: string;
  section_label: string;
  role_prefix: string;
  /** Writable slot code; the three fields below are what it resolves to. */
  liturgical_slot: string;
  slot_label: string;
  /** What the card actually prints once the overrides are resolved against the
   *  slot — the cockpit shows these as the placeholders of the two override
   *  fields, so an empty field reads as "inherited", not as "missing". */
  section_effective: string;
  role_prefix_effective: string;
  card_enabled: boolean | null;
  card_enabled_effective: boolean;
  card_elements: CardElement[] | null;
  card_elements_effective: CardElement[];
  text_override: string;
  note_override: string;
  /** Per-item pin; null inherits the package setting. */
  hide_source_page_numbers: boolean | null;
  hide_source_page_numbers_effective: boolean;
  readiness: ScorePackageItemReadiness;
}

/** Mutable per-item overrides accepted by the cockpit PATCH endpoint. */
export interface ScorePackageItemPatch {
  score_edition_id: string | null;
  pdf_page_start: number | null;
  pdf_page_end: number | null;
  translation_id: string | null;
  performers: string;
  section_label: string;
  role_prefix: string;
  liturgical_slot: string;
  card_enabled: boolean | null;
  card_elements: CardElement[] | null;
  text_override: string;
  note_override: string;
  hide_source_page_numbers: boolean | null;
}

/** Build state + readiness of a project's auto-assembled concert score book. */
export interface ScorePackageState {
  status: ScorePackageStatus;
  status_display: string;
  is_stale: boolean;
  has_pdf: boolean;
  page_count: number | null;
  generated_at: string | null;
  /** Increments on every successful build — stamps printed/distributed copies. */
  build_version: number;
  /** When a singer first downloaded the current build (null = not yet out). */
  distributed_at: string | null;
  /** The current book has reached the singers — a rebuild silently replaces it. */
  is_distributed: boolean;
  /** The current score_pdf was hand-uploaded, not generated — hide version/staleness. */
  is_manual_upload: boolean;
  error: string;
  total_pieces: number;
  bindable_pieces: number;
  pieces_without_pdf: string[];
  /** Active ensemble size — the number a licensed edition's copies is checked against. */
  cast_size: number;
  /** Titles whose bound licensed edition is short of physical copies for the cast. */
  pieces_over_copies: string[];
  card_elements: CardElement[];
  config: ScorePackageConfig;
  items: ScorePackageItem[];
}

/** One rasterised edition page in the build-cockpit page-trim strip. */
export interface ScorePackageThumbnail {
  page: number;
  /** Inline WebP data URI, so the whole strip renders from one gated response. */
  src: string;
}

/** Page thumbnails for a program item's resolved edition (visual page-range trim). */
export interface ScorePackageThumbnailManifest {
  /** False when the host has no rasteriser — the cockpit keeps manual page entry. */
  available: boolean;
  edition_id: string | null;
  width: number;
  page_count: number | null;
  thumbnails: ScorePackageThumbnail[];
}

export const ProjectService = {
  getAll: async (): Promise<Project[]> => {
    const response = await api.get(PROJECTS_BASE_URL);
    return response.data.results ?? response.data ?? [];
  },

  getById: async (id: string | number): Promise<Project> => {
    const response = await api.get<Project>(`${PROJECTS_BASE_URL}${id}/`);
    return response.data;
  },

  getReadinessSummary: async (
    projectId: string | number,
  ): Promise<ProjectReadinessSummaryEntry[]> => {
    const response = await api.get<ProjectReadinessSummaryEntry[]>(
      `${PROJECTS_BASE_URL}${projectId}/readiness-summary/`,
    );
    return response.data ?? [];
  },

  getPublicationPreview: async (
    projectId: string | number,
  ): Promise<ProjectPublicationPreview> => {
    const response = await api.get<ProjectPublicationPreview>(
      `${PROJECTS_BASE_URL}${projectId}/publish/`,
    );
    return response.data;
  },

  /** Takes the project live and sends one full invitation per awaiting artist. */
  publish: async (projectId: string | number): Promise<Project> => {
    const response = await api.post<Project>(
      `${PROJECTS_BASE_URL}${projectId}/publish/`,
    );
    return response.data;
  },

  /**
   * The review sheet's preview for a given selection. `exclude` holds those lines
   * back and `hasNote` applies the note's fold, so the counts follow the boxes the
   * conductor has unticked. Only the note's presence changes the arithmetic — its
   * text is sent only when publishing.
   */
  getAnnouncementReview: async (
    projectId: string | number,
    exclude: readonly string[] = [],
    hasNote = false,
  ): Promise<AnnouncementReview> => {
    const response = await api.get<AnnouncementReview>(
      `${PROJECTS_BASE_URL}${projectId}/announcements/`,
      { params: { exclude: exclude.join(","), with_note: hasNote ? 1 : 0 } },
    );
    return response.data;
  },

  /** Publishes the queue, sending everything except the held `exclude` rows and
   *  carrying the conductor's `note` when there is one. */
  publishAnnouncements: async (
    projectId: string | number,
    payload: { note?: string; exclude?: readonly string[] } = {},
  ): Promise<AnnouncementPublishResult> => {
    const response = await api.post<AnnouncementPublishResult>(
      `${PROJECTS_BASE_URL}${projectId}/announcements/`,
      { note: payload.note ?? "", exclude: payload.exclude ?? [] },
    );
    return response.data;
  },

  /** Abandons the whole queue without telling anyone. The saved data stands. */
  discardAnnouncements: async (
    projectId: string | number,
  ): Promise<{ discarded: number }> => {
    const response = await api.delete<{ discarded: number }>(
      `${PROJECTS_BASE_URL}${projectId}/announcements/`,
    );
    return response.data;
  },

  create: async (data: ProjectCreateDTO): Promise<Project> => {
    const response = await api.post<Project>(PROJECTS_BASE_URL, data);
    return response.data;
  },

  update: async (
    id: string | number,
    data: ProjectUpdateDTO,
  ): Promise<Project> => {
    const response = await api.patch<Project>(
      `${PROJECTS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  remove: async (id: string | number): Promise<void> => {
    await api.delete(`${PROJECTS_BASE_URL}${id}/`);
  },

  /**
   * `params` carries the document's shape, not a filter: `export_day_sheet`
   * resolves the audience from the caller, and a manager passes
   * `{ audience: "production" }` to get the stage manager's day card instead of
   * the personal one they are not entitled to.
   */
  downloadReport: async (
    projectId: string,
    endpoint: ProjectReportEndpoint,
    params?: Record<string, string>,
  ): Promise<AxiosResponse<Blob>> =>
    api.get(`${PROJECTS_BASE_URL}${projectId}/${endpoint}/`, {
      responseType: "blob",
      params,
    }),

  uploadScorePdf: async (projectId: string, file: File): Promise<Project> => {
    const formData = new FormData();
    formData.append("score_pdf", file);
    const response = await api.post<Project>(
      `${PROJECTS_BASE_URL}${projectId}/score_pdf/`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  removeScorePdf: async (projectId: string): Promise<void> => {
    await api.delete(`${PROJECTS_BASE_URL}${projectId}/score_pdf/`);
  },

  /**
   * The stage manager's concert-day card. Same endpoint as the personal day
   * sheet, asked for in its production shape — which the server only grants a
   * manager. Assembled per request, so it is never cached.
   */
  fetchDayCardBlob: async (projectId: string | number): Promise<Blob> => {
    const response = await api.get(
      `${PROJECTS_BASE_URL}${projectId}/export_day_sheet/`,
      { responseType: "blob", params: { audience: "production" } },
    );
    return response.data as Blob;
  },

  fetchScorePdfBlob: async (projectId: string): Promise<Blob> => {
    const response = await api.get(
      `${PROJECTS_BASE_URL}${projectId}/score_pdf/`,
      { responseType: "blob" },
    );
    return response.data;
  },

  getScorePackageState: async (
    projectId: string | number,
  ): Promise<ScorePackageState> => {
    const response = await api.get<ScorePackageState>(
      `${PROJECTS_BASE_URL}${projectId}/score_package/`,
    );
    return response.data;
  },

  generateScorePackage: async (
    projectId: string | number,
    config?: Partial<ScorePackageConfig>,
  ): Promise<ScorePackageState> => {
    const response = await api.post<ScorePackageState>(
      `${PROJECTS_BASE_URL}${projectId}/score_package/`,
      config ?? {},
    );
    return response.data;
  },

  /** Persist global score-package layout settings (no build); returns fresh state. */
  updateScorePackageConfig: async (
    projectId: string | number,
    patch: Partial<ScorePackageConfig>,
  ): Promise<ScorePackageState> => {
    const response = await api.patch<ScorePackageState>(
      `${PROJECTS_BASE_URL}${projectId}/score_package/config/`,
      patch,
    );
    return response.data;
  },

  /** Persist one program item's build-cockpit overrides; returns the fresh state. */
  updateScorePackageItem: async (
    projectId: string | number,
    itemId: string,
    patch: Partial<ScorePackageItemPatch>,
  ): Promise<ScorePackageState> => {
    const response = await api.patch<ScorePackageState>(
      `${PROJECTS_BASE_URL}${projectId}/score_package/item/`,
      { item_id: itemId, ...patch },
    );
    return response.data;
  },

  /** Render one program item's card to a PDF for the live cockpit preview. */
  fetchScorePackageCardPreviewBlob: async (
    projectId: string | number,
    itemId: string,
  ): Promise<Blob> => {
    const response = await api.get(
      `${PROJECTS_BASE_URL}${projectId}/score_package/preview/`,
      { params: { item: itemId }, responseType: "blob" },
    );
    return response.data as Blob;
  },

  /** Fetch a score-edition PDF through the gated download, for the page picker. */
  fetchScoreEditionBlob: async (editionId: string): Promise<Blob> => {
    const response = await api.get(`/api/materials/scores/${editionId}/download/`, {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  /** Page thumbnails of an item's resolved edition, for visual page-range trimming. */
  fetchScorePackageThumbnails: async (
    projectId: string | number,
    itemId: string,
  ): Promise<ScorePackageThumbnailManifest> => {
    const response = await api.get<ScorePackageThumbnailManifest>(
      `${PROJECTS_BASE_URL}${projectId}/score_package/thumbnails/`,
      { params: { item: itemId } },
    );
    return response.data;
  },

  getArtistsDictionary: async (): Promise<Artist[]> => {
    const response = await api.get(ARTISTS_BASE_URL);
    return response.data.results ?? response.data ?? [];
  },

  getPiecesDictionary: async (): Promise<Piece[]> => {
    const response = await api.get(PIECES_BASE_URL);
    return response.data.results ?? response.data ?? [];
  },

  getCollaboratorsDictionary: async (): Promise<Collaborator[]> => {
    const response = await api.get(COLLABORATORS_BASE_URL);
    return response.data.results ?? response.data ?? [];
  },

  getVoiceLinesDictionary: async (): Promise<VoiceLineOption[]> => {
    const response = await api.get(VOICE_LINES_BASE_URL);
    return response.data.results ?? response.data ?? [];
  },

  getParticipationsByProject: async (
    projectId: string | number,
  ): Promise<Participation[]> => {
    const response = await api.get(
      buildListUrl(PARTICIPATIONS_BASE_URL, { project: projectId }),
    );
    return response.data.results ?? response.data ?? [];
  },

  createParticipation: async (
    data: ParticipationCreateDTO,
  ): Promise<Participation> => {
    const response = await api.post<Participation>(
      PARTICIPATIONS_BASE_URL,
      data,
    );
    return response.data;
  },

  updateParticipation: async (
    id: string | number,
    data: ParticipationUpdateDTO,
  ): Promise<Participation> => {
    const response = await api.patch<Participation>(
      `${PARTICIPATIONS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  updateParticipationStatus: async (
    id: string,
    status: "CON" | "DEC",
  ): Promise<Participation> => {
    const response = await api.patch<Participation>(
      `${PARTICIPATIONS_BASE_URL}${id}/status/`,
      { status },
    );
    return response.data;
  },

  deleteParticipation: async (id: string | number): Promise<void> => {
    await api.delete(`${PARTICIPATIONS_BASE_URL}${id}/`);
  },

  getRehearsalsByProject: async (
    projectId: string | number,
  ): Promise<Rehearsal[]> => {
    const response = await api.get(
      buildListUrl(REHEARSALS_BASE_URL, { project: projectId }),
    );
    return response.data.results ?? response.data ?? [];
  },

  createRehearsal: async (data: RehearsalCreateDTO): Promise<Rehearsal> => {
    const response = await api.post<Rehearsal>(REHEARSALS_BASE_URL, data);
    return response.data;
  },

  updateRehearsal: async (
    id: string | number,
    data: RehearsalUpdateDTO,
  ): Promise<Rehearsal> => {
    const response = await api.patch<Rehearsal>(
      `${REHEARSALS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteRehearsal: async (id: string | number): Promise<void> => {
    await api.delete(`${REHEARSALS_BASE_URL}${id}/`);
  },

  getCrewAssignmentsByProject: async (
    projectId: string | number,
  ): Promise<CrewAssignment[]> => {
    const response = await api.get(
      buildListUrl(CREW_ASSIGNMENTS_BASE_URL, { project: projectId }),
    );
    return response.data.results ?? response.data ?? [];
  },

  createCrewAssignment: async (
    data: CrewAssignmentCreateDTO,
  ): Promise<CrewAssignment> => {
    const response = await api.post<CrewAssignment>(
      CREW_ASSIGNMENTS_BASE_URL,
      data,
    );
    return response.data;
  },

  updateCrewAssignment: async (
    id: string | number,
    data: CrewAssignmentUpdateDTO,
  ): Promise<CrewAssignment> => {
    const response = await api.patch<CrewAssignment>(
      `${CREW_ASSIGNMENTS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteCrewAssignment: async (id: string | number): Promise<void> => {
    await api.delete(`${CREW_ASSIGNMENTS_BASE_URL}${id}/`);
  },

  /**
   * One standard rate across a whole project, in a single statement rather than
   * one PATCH per person. The server excludes rows it must not rewrite —
   * settled fees on both sides, and singers who declined — so the count that
   * comes back is what was actually repriced, not what was asked for.
   */
  applyBulkCastFee: async (data: ProjectBulkFeeDTO): Promise<number> => {
    const response = await api.patch<{ updated_count: number }>(
      `${PARTICIPATIONS_BASE_URL}bulk-fee/`,
      data,
    );
    return response.data.updated_count;
  },

  applyBulkCrewFee: async (data: ProjectBulkFeeDTO): Promise<number> => {
    const response = await api.patch<{ updated_count: number }>(
      `${CREW_ASSIGNMENTS_BASE_URL}bulk-fee/`,
      data,
    );
    return response.data.updated_count;
  },

  getProgramByProject: async (
    projectId: string | number,
  ): Promise<ProgramItem[]> => {
    const response = await api.get(
      buildListUrl(PROGRAM_ITEMS_BASE_URL, { project: projectId }),
    );
    const data = response.data.results ?? response.data ?? [];
    return [...data].sort(
      (a: ProgramItem, b: ProgramItem) => a.order - b.order,
    );
  },

  /** The liturgical vocabulary in the caller's language. Static per language —
   *  see `SESSION_STATIC_DICTIONARY` and the language-keyed query key. */
  getLiturgicalSlots: async (): Promise<LiturgicalSlotVocabulary> => {
    const response = await api.get<LiturgicalSlotVocabulary>(
      `${PROGRAM_ITEMS_BASE_URL}slots/`,
    );
    return response.data;
  },

  createProgramItem: async (
    data: ProgramItemCreateDTO,
  ): Promise<ProgramItem> => {
    const response = await api.post<ProgramItem>(PROGRAM_ITEMS_BASE_URL, data);
    return response.data;
  },

  updateProgramItem: async (
    id: string | number,
    data: ProgramItemUpdateDTO,
  ): Promise<ProgramItem> => {
    const response = await api.patch<ProgramItem>(
      `${PROGRAM_ITEMS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteProgramItem: async (id: string | number): Promise<void> => {
    await api.delete(`${PROGRAM_ITEMS_BASE_URL}${id}/`);
  },

  getPieceCastingsByProject: async (
    projectId: string | number,
  ): Promise<PieceCasting[]> => {
    const response = await api.get(
      buildListUrl(PIECE_CASTINGS_BASE_URL, {
        participation__project: projectId,
      }),
    );
    return response.data.results ?? response.data ?? [];
  },

  /** Saves one piece's divisi board whole; resolves with the persisted board. */
  savePieceCastingBoard: async (
    data: PieceCastingBoardDTO,
  ): Promise<PieceCasting[]> => {
    const response = await api.put<PieceCasting[]>(
      `${PIECE_CASTINGS_BASE_URL}board/`,
      data,
    );
    return response.data;
  },

  /**
   * Saves several pieces' boards in one transaction; resolves with every
   * persisted seat across them.
   */
  savePieceCastingBoards: async (
    data: PieceCastingBoardsDTO,
  ): Promise<PieceCasting[]> => {
    const response = await api.put<PieceCasting[]>(
      `${PIECE_CASTINGS_BASE_URL}boards/`,
      data,
    );
    return response.data;
  },

  getAttendancesByProject: async (
    projectId: string | number,
  ): Promise<Attendance[]> => {
    const response = await api.get(
      buildListUrl(ATTENDANCES_BASE_URL, { rehearsal__project: projectId }),
    );
    return response.data.results ?? response.data ?? [];
  },

  createAttendance: async (data: AttendanceCreateDTO): Promise<Attendance> => {
    const response = await api.post<Attendance>(ATTENDANCES_BASE_URL, data);
    return response.data;
  },

  updateAttendance: async (
    id: string | number,
    data: AttendanceUpdateDTO,
  ): Promise<Attendance> => {
    const response = await api.patch<Attendance>(
      `${ATTENDANCES_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deleteAttendance: async (id: string | number): Promise<void> => {
    await api.delete(`${ATTENDANCES_BASE_URL}${id}/`);
  },
};
