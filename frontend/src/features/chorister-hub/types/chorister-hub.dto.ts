// chorister-hub/types/chorister-hub.dto.ts
// Strict TypeScript DTOs for the Chorister Hub feature domain.

export type DocumentRole = 'ARTIST' | 'MANAGER' | 'ADMIN';

export type DocumentIconKey =
  | 'BookOpen'
  | 'Shirt'
  | 'FileText'
  | 'Shield'
  | 'HeartPulse'
  | 'Music'
  | 'Users'
  | 'Briefcase'
  | 'MapPin'
  | 'Landmark'
  | 'GraduationCap'
  | 'ScrollText'
  | 'Scale'
  | 'Mic2';

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

export interface VocalLineEntry {
  voice_line: string;
  voice_line_display: string;
  count: number;
}

export interface ArtistIdentityMetricsDTO {
  total_concerts: number;
  active_seasons: number;
  season_years: number[];
  vocal_line_distribution: VocalLineEntry[];
  first_project_year: number | null;
}
