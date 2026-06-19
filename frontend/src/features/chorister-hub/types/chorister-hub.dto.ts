// chorister-hub/types/chorister-hub.dto.ts
// Strict TypeScript DTOs for the Chorister Hub feature domain.

export type DocumentRole = "ARTIST" | "MANAGER" | "CREW";

export type DocumentIconKey =
  | "BookOpen"
  | "Shirt"
  | "FileText"
  | "Shield"
  | "HeartPulse"
  | "Music"
  | "Users"
  | "Briefcase"
  | "MapPin"
  | "Landmark"
  | "GraduationCap"
  | "ScrollText"
  | "Scale"
  | "Mic2";

export interface DocumentFileDTO {
  id: string;
  title: string;
  description: string;
  file_url: string;
  file_size_bytes: number;
  mime_type: string;
  allowed_roles: DocumentRole[];
  order: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentCategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_key: DocumentIconKey;
  order: number;
  allowed_roles: DocumentRole[];
  documents: DocumentFileDTO[];
  created_at: string;
  updated_at: string;
}

export interface DocumentCategoryCreateDTO {
  name: string;
  description: string;
  icon_key: DocumentIconKey;
  order: number;
  allowed_roles: DocumentRole[];
}

export interface DocumentCategoryUpdateDTO {
  name?: string;
  description?: string;
  icon_key?: DocumentIconKey;
  order?: number;
  allowed_roles?: DocumentRole[];
}

export interface DocumentUploadDTO {
  title: string;
  description: string;
  file: File;
  allowed_roles: DocumentRole[];
  order: number;
}

export interface VocalLineEntry {
  voice_line: string;
  voice_line_display: string;
  count: number;
}

export interface RepertoireEntry {
  piece_id: string;
  title: string;
  composer_name: string;
  epoch: string;
  voice_lines: string[];
  performances: number;
  years: number[];
}

export interface ArtistIdentityMetricsDTO {
  total_concerts: number;
  active_seasons: number;
  season_years: number[];
  vocal_line_distribution: VocalLineEntry[];
  first_project_year: number | null;
  total_pieces: number;
  total_composers: number;
  /** % of recorded rehearsal attendances marked present/late; null = no data. */
  attendance_rate: number | null;
  repertoire: RepertoireEntry[];
}

// ── Concert roster ("Z kim śpiewam") ──────────────────────────────────────────
// Strictly scoped to the caller's own upcoming concerts and the pieces they sing;
// grouped by the voice line each co-singer sings IN THAT PIECE. The backend never
// sends the full ensemble, anyone's default voice type, nor sight-reading / vocal
// range (the conductor's private data).

export interface SectionMemberDTO {
  artist_id: string;
  first_name: string;
  last_name: string;
  avatar_thumb_url: string | null;
  is_me: boolean;
}

export interface PieceVoiceSectionDTO {
  voice_line: string;
  voice_line_display: string;
  /** True when the caller themselves sings this voice line in this piece. */
  is_mine: boolean;
  members: SectionMemberDTO[];
}

export interface ConcertPieceDTO {
  piece_id: string;
  title: string;
  sections: PieceVoiceSectionDTO[];
}

export interface ConcertRosterDTO {
  project_id: string;
  title: string;
  date: string | null;
  pieces: ConcertPieceDTO[];
}

export interface EnsembleMeDTO {
  /** The caller's own voice type label — self-knowledge only. */
  voice_type_display: string | null;
  is_active: boolean;
  /** False for users with no artist record (pure managers / conductors). */
  is_linked: boolean;
}

export interface MyEnsembleDTO {
  me: EnsembleMeDTO;
  concerts: ConcertRosterDTO[];
}
