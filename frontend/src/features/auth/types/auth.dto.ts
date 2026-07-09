// frontend/src/features/auth/types/auth.dto.ts
export interface ActivateAccountPayload {
  uidb64: string;
  token: string;
  new_password: string;
  /** Version of the Terms/Privacy documents accepted on the activation screen. */
  terms_version: string;
}

export interface ActivateAccountResponse {
  detail: string;
  email: string;
}

export interface ActivationPreviewResponse {
  first_name: string;
  first_name_vocative: string;
  /** The invitee's chosen language (pl|en|fr) — drives the activation screen. */
  language?: string;
}

export interface PasswordResetRequestPayload {
  email: string;
}

export interface PasswordResetConfirmPayload {
  uidb64: string;
  token: string;
  new_password: string;
}

export interface PasswordResetConfirmResponse {
  detail: string;
  email: string;
}
