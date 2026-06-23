/**
 * @file errorCopy.ts
 * @description Turns a {@link NormalizedApiError} into the words a chorister or
 * conductor actually reads. Priority, most-specific first:
 *   1. a known, stable `error_code` → curated localized copy;
 *   2. a single rejected field → that field's own message;
 *   3. a meaningful server sentence (domain rule) → shown verbatim;
 *   4. a localized fallback for the error's kind.
 * This is where "something went wrong" becomes "Ten adres e-mail jest już zajęty".
 * @module shared/api/errors/errorCopy
 * @architecture Enterprise SaaS 2026
 */

import type { TFunction } from "i18next";

import type { NormalizedApiError, ApiErrorKind } from "./types";

export interface ErrorCopy {
  title: string;
  detail: string;
  /**
   * `true` when `detail` carries real, error-specific information (a known
   * code, a rejected field's message, or a domain rule). `false` when it is
   * only the generic fallback for the kind — the signal a caller uses to decide
   * whether its own tailored copy reads better.
   */
  specific: boolean;
}

/** Stable server `error_code`s we have written first-class, localized copy for. */
const KNOWN_CODES: Record<string, { title: string; detail: string }> = {
  invalid_credentials: {
    title: "errors.codes.invalid_credentials.title",
    detail: "errors.codes.invalid_credentials.detail",
  },
  email_taken: {
    title: "errors.codes.email_taken.title",
    detail: "errors.codes.email_taken.detail",
  },
  // The email-change flow raises this per-raise code; same meaning as email_taken.
  email_in_use: {
    title: "errors.codes.email_taken.title",
    detail: "errors.codes.email_taken.detail",
  },
  invalid_current_password: {
    title: "errors.codes.invalid_current_password.title",
    detail: "errors.codes.invalid_current_password.detail",
  },
  expired_activation_link: {
    title: "errors.codes.expired_activation_link.title",
    detail: "errors.codes.expired_activation_link.detail",
  },
  expired_reset_link: {
    title: "errors.codes.expired_reset_link.title",
    detail: "errors.codes.expired_reset_link.detail",
  },
  invalid_reset_link: {
    title: "errors.codes.invalid_reset_link.title",
    detail: "errors.codes.invalid_reset_link.detail",
  },
  invalid_activation_link: {
    title: "errors.codes.invalid_activation_link.title",
    detail: "errors.codes.invalid_activation_link.detail",
  },
  avatar_missing: {
    title: "errors.codes.avatar_missing.title",
    detail: "errors.codes.avatar_missing.detail",
  },
  invalid_image: {
    title: "errors.codes.invalid_image.title",
    detail: "errors.codes.invalid_image.detail",
  },
  // Score-compiler PDF ingest.
  ingestion_unavailable: {
    title: "errors.codes.ingestion_unavailable.title",
    detail: "errors.codes.ingestion_unavailable.detail",
  },
  ingestion_precondition: {
    title: "errors.codes.ingestion_precondition.title",
    detail: "errors.codes.ingestion_precondition.detail",
  },
  piece_not_found: {
    title: "errors.codes.piece_not_found.title",
    detail: "errors.codes.piece_not_found.detail",
  },
};

/** Localized title + detail fallback for each coarse kind. */
const KIND_FALLBACK: Record<ApiErrorKind, { title: string; detail: string }> = {
  validation: {
    title: "errors.toast.validation_title",
    detail: "errors.toast.validation_detail",
  },
  domain: {
    title: "errors.toast.domain_title",
    detail: "errors.toast.domain_detail",
  },
  auth: { title: "errors.toast.auth_title", detail: "errors.toast.auth_detail" },
  permission: {
    title: "errors.toast.permission_title",
    detail: "errors.toast.permission_detail",
  },
  notfound: {
    title: "errors.toast.notfound_title",
    detail: "errors.toast.notfound_detail",
  },
  conflict: {
    title: "errors.toast.conflict_title",
    detail: "errors.toast.conflict_detail",
  },
  rate_limit: {
    title: "errors.toast.rate_limit_title",
    detail: "errors.toast.rate_limit_detail",
  },
  network: {
    title: "errors.toast.network_title",
    detail: "errors.toast.network_detail",
  },
  offline: {
    title: "errors.toast.offline_title",
    detail: "errors.toast.offline_detail",
  },
  server: {
    title: "errors.toast.server_title",
    detail: "errors.toast.server_detail",
  },
  unknown: {
    title: "errors.toast.unknown_title",
    detail: "errors.toast.unknown_detail",
  },
};

/** Polish-first defaults so a missing translation key never reads as a raw key. */
const FALLBACK_TEXT: Record<string, string> = {
  "errors.toast.validation_title": "Sprawdź formularz",
  "errors.toast.validation_detail": "Niektóre pola wymagają poprawy.",
  "errors.toast.domain_title": "Nie można wykonać tej operacji",
  "errors.toast.domain_detail": "Ta czynność jest teraz niedozwolona.",
  "errors.toast.auth_title": "Sesja wygasła",
  "errors.toast.auth_detail": "Zaloguj się ponownie, aby kontynuować.",
  "errors.toast.permission_title": "Brak uprawnień",
  "errors.toast.permission_detail": "Nie masz dostępu do tej operacji.",
  "errors.toast.notfound_title": "Nie znaleziono",
  "errors.toast.notfound_detail": "Tego zasobu już nie ma lub został przeniesiony.",
  "errors.toast.conflict_title": "Konflikt zmian",
  "errors.toast.conflict_detail":
    "Ktoś zmienił te dane w międzyczasie. Odśwież i spróbuj ponownie.",
  "errors.toast.rate_limit_title": "Zbyt wiele prób",
  "errors.toast.rate_limit_detail": "Odczekaj chwilę i spróbuj ponownie.",
  "errors.toast.network_title": "Brak połączenia",
  "errors.toast.network_detail":
    "Nie udało się połączyć z serwerem. Sprawdź sieć i spróbuj ponownie.",
  "errors.toast.offline_title": "Jesteś offline",
  "errors.toast.offline_detail":
    "Zmiany zostaną wysłane, gdy wróci połączenie.",
  "errors.toast.server_title": "Błąd serwera",
  "errors.toast.server_detail":
    "Coś po naszej stronie zawiodło. Pracujemy nad tym — spróbuj za chwilę.",
  "errors.toast.unknown_title": "Wystąpił błąd",
  "errors.toast.unknown_detail": "Spróbuj ponownie za chwilę.",
};

const translate = (t: TFunction, key: string): string =>
  t(key, FALLBACK_TEXT[key] ?? "");

export const resolveErrorCopy = (
  error: NormalizedApiError,
  t: TFunction,
): ErrorCopy => {
  // 1. A stable, known code wins — fully curated, localized copy.
  if (error.code && KNOWN_CODES[error.code]) {
    const keys = KNOWN_CODES[error.code];
    return {
      title: translate(t, keys.title),
      detail: translate(t, keys.detail),
      specific: true,
    };
  }

  const fallback = KIND_FALLBACK[error.kind];
  const title = translate(t, fallback.title);

  // 2. Exactly one rejected field → lead with its own specific message.
  const fieldMessages = Object.values(error.fieldErrors);
  if (error.kind === "validation" && fieldMessages.length === 1) {
    return { title, detail: fieldMessages[0], specific: true };
  }

  // 3. A meaningful server sentence (typically a domain rule) → trust it.
  if (
    (error.kind === "domain" || error.kind === "conflict") &&
    error.serverMessage
  ) {
    return { title, detail: error.serverMessage, specific: true };
  }

  // 4. Localized fallback for the kind. Most kinds still name a real cause
  //    (offline, forbidden, server, …) that beats a caller's generic line. The
  //    exceptions are "unknown" and a message-less "domain" rule: there the
  //    feature's own hint ("project still has contracts") is the best copy, so
  //    yield to a fallbackDescription.
  return {
    title,
    detail: translate(t, fallback.detail),
    specific: error.kind !== "unknown" && error.kind !== "domain",
  };
};
