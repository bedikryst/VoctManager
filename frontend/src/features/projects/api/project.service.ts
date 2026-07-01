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
  VoiceLineOption,
} from "@/shared/types";
import type {
  AttendanceCreateDTO,
  AttendanceUpdateDTO,
  CrewAssignmentCreateDTO,
  CrewAssignmentUpdateDTO,
  ParticipationCreateDTO,
  ParticipationUpdateDTO,
  PieceCastingCreateDTO,
  PieceCastingUpdateDTO,
  ProgramItemCreateDTO,
  ProgramItemUpdateDTO,
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
  | "export_zaiks"
  | "export_dtp";

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

export type ScorePackageStatus = "IDLE" | "QUED" | "BLDG" | "RDY" | "FAIL";

export interface ScorePackageConfig {
  density_mode: "CONCERT" | "MASS";
  include_title_page: boolean;
  include_toc: boolean;
  include_page_numbers: boolean;
  include_bookmarks: boolean;
  normalize_to_a4: boolean;
  include_cards: boolean;
  card_include_text: boolean;
  card_include_translation: boolean;
  card_include_program_note: boolean;
  translation_language: string;
}

/** Toggleable element of a per-piece frontispiece card. */
export type CardElement =
  | "eyebrow"
  | "meta"
  | "text"
  | "translation"
  | "note"
  | "ipa";

/** Traffic light for a single card element's data. */
export type ElementStatus = "ready" | "low" | "missing";

/** Roll-up readiness for one program item. */
export type ItemReadinessOverall = "ready" | "low" | "incomplete" | "no_edition";

export interface ScorePackageEditionOption {
  id: string;
  label: string;
  page_count: number | null;
  is_default: boolean;
  ingestion_status: string;
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
  has_pdf: boolean;
  suggested_start: number | null;
  pdf_page_start: number | null;
  pdf_page_end: number | null;
  section_label: string;
  role_prefix: string;
  card_enabled: boolean | null;
  card_enabled_effective: boolean;
  card_elements: CardElement[] | null;
  card_elements_effective: CardElement[];
  text_override: string;
  note_override: string;
  readiness: ScorePackageItemReadiness;
}

/** Mutable per-item overrides accepted by the cockpit PATCH endpoint. */
export interface ScorePackageItemPatch {
  score_edition_id: string | null;
  pdf_page_start: number | null;
  pdf_page_end: number | null;
  section_label: string;
  role_prefix: string;
  card_enabled: boolean | null;
  card_elements: CardElement[] | null;
  text_override: string;
  note_override: string;
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

  downloadReport: async (
    projectId: string,
    endpoint: ProjectReportEndpoint,
  ): Promise<AxiosResponse<Blob>> =>
    api.get(`${PROJECTS_BASE_URL}${projectId}/${endpoint}/`, {
      responseType: "blob",
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

  createPieceCasting: async (
    data: PieceCastingCreateDTO,
  ): Promise<PieceCasting> => {
    const response = await api.post<PieceCasting>(
      PIECE_CASTINGS_BASE_URL,
      data,
    );
    return response.data;
  },

  updatePieceCasting: async (
    id: string | number,
    data: PieceCastingUpdateDTO,
  ): Promise<PieceCasting> => {
    const response = await api.patch<PieceCasting>(
      `${PIECE_CASTINGS_BASE_URL}${id}/`,
      data,
    );
    return response.data;
  },

  deletePieceCasting: async (id: string | number): Promise<void> => {
    await api.delete(`${PIECE_CASTINGS_BASE_URL}${id}/`);
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
