/**
 * @file settings.dto.ts
 * @description Data Transfer Objects for the Settings feature.
 * Strictly mirrors the backend contracts from core/serializers.py.
 * @module features/settings/types
 */

import type { AppRole } from "@/shared/auth/auth.types";

export interface UserProfileDTO {
  role?: AppRole;
  is_manager?: boolean;
  is_artist?: boolean;
  is_crew?: boolean;
  avatar_url: string | null;
  avatar_thumb_url: string | null;
  phone_number: string;
  language: string;
  timezone: string;
  salutation: string;
  dietary_preference: string;
  dietary_notes: string;
  clothing_size: string;
  shoe_size: string;
  height_cm: number | null;
  calendar_token: string;
  // Notification delivery (daily digest of routine manager alerts).
  digest_enabled?: boolean;
  digest_hour?: number;
}

export interface DigestSettingsPayload {
  digest_enabled?: boolean;
  digest_hour?: number;
}

export interface UserMeDTO {
  id: string | number;
  email: string;
  first_name: string;
  last_name: string;
  profile: UserProfileDTO | null;
  voice_type?: string | null;
  voice_type_display?: string | null;
}

export interface UpdatePreferencesPayload {
  first_name: string;
  last_name: string;
  profile: {
    phone_number: string;
    language: string;
    timezone: string;
    salutation: string;
    dietary_preference: string;
    dietary_notes: string;
    clothing_size: string;
    shoe_size: string;
    height_cm: number | null;
  };
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export interface ChangeEmailPayload {
  new_email: string;
  password: string; // Current password required for verification
}

export interface ApiErrorResponse {
  error_code?: string;
  message?: string;
}

export interface DeleteAccountPayload {
  password: string;
}
