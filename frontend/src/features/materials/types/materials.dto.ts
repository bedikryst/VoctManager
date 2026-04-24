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
  birth_year: string;
  death_year: string;
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

export interface MaterialsPiece {
  id: string;
  title: string;
  composer: MaterialsComposer | null;
  language: string;
  estimated_duration: number | null;
  voicing: string;
  epoch: string;
  sheet_music: string;
  lyrics_original: string;
  lyrics_translation: string;
  reference_recording_youtube: string;
  reference_recording_spotify: string;
  tracks: MaterialsTrack[];
  castings: MaterialsCasting[];
  my_casting: MaterialsCasting | null;
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
  participation_id: string;
  participation_status: string;
  fee: string | null;
  project: MaterialsProject;
  program: MaterialsProgramItem[];
}

export interface MaterialsDashboardGroup {
  project: MaterialsProject;
  participationId: string;
  participationStatus: string;
  fee: string | null;
  program: MaterialsProgramItem[];
}
