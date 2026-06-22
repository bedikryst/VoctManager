/**
 * @file auth.types.ts
 * @description Shared authentication and RBAC contracts consumed across the frontend.
 * Mirrors the enterprise identity payload returned by the backend.
 * @module shared/auth/types
 */

export const APP_ROLES = {
  MANAGER: "MANAGER",
  ARTIST: "ARTIST",
  CREW: "CREW",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export interface AuthProfile {
  role?: AppRole;
  is_manager?: boolean;
  is_artist?: boolean;
  is_crew?: boolean;
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
  language?: string;
  timezone?: string;
  salutation?: string;
  phone_number?: string;
  dietary_preference?: string;
  dietary_notes?: string;
  clothing_size?: string;
  shoe_size?: string;
  height_cm?: number | null;
  calendar_token?: string;
  /** Set once, server-side, when the member completes the one-time home welcome. */
  welcome_seen_at?: string | null;
}

export interface AuthUser {
  id: string | number;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  artist_profile_id?: string | number | null;
  voice_type?: string | null;
  voice_type_display?: string | null;
  profile?: AuthProfile | null;
}
