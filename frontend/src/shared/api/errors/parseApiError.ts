/**
 * @file parseApiError.ts
 * @description The funnel. Takes anything a failed request can throw and returns
 * one {@link NormalizedApiError}. It deliberately understands every error shape
 * this backend produces today, because the contract is not yet uniform:
 *
 *  - RFC 7807 envelope (global handler): `{ status, detail, validation_errors |
 *    errors, ... }`
 *  - pydantic 422: `validation_errors: [{ field, message }]`  (a list)
 *  - hand-rolled auth payloads: `validation_errors: { new_password: [...] }`
 *    (a dict), or `{ error_code, message }`
 *  - DRF serializer errors nested under `errors: { field: [...] }`
 *  - bare DRF `{ detail }` / `{ field: [...] }`
 *  - no response at all (network / offline)
 *
 * Pure and side-effect free — safe to unit test and to call from anywhere.
 * @module shared/api/errors/parseApiError
 * @architecture Enterprise SaaS 2026
 */

import type { NormalizedApiError, ApiErrorKind } from "./types";

/** Envelope `detail` strings that carry no information worth showing a human. */
const BOILERPLATE_DETAILS = new Set([
  "An error occurred while processing the request.",
  "The request payload failed structural validation.",
]);

/** Envelope/meta keys that must never be mistaken for a form field. */
const META_KEYS = new Set([
  "type",
  "title",
  "status",
  "detail",
  "instance",
  "errors",
  "validation_errors",
  "error_code",
  "message",
  "non_field_errors",
]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** First non-empty string in a value that may be a string, or an array of them. */
const firstString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  return null;
};

/** Merge `field → message` out of every validation shape the server uses. */
const collectFieldErrors = (
  data: Record<string, unknown>,
): Record<string, string> => {
  const out: Record<string, string> = {};
  const add = (field: string, message: string | null): void => {
    if (field && message && !(field in out)) out[field] = message;
  };

  const ve = data.validation_errors;
  if (Array.isArray(ve)) {
    // pydantic: [{ field, message }]
    for (const item of ve) {
      if (isRecord(item) && typeof item.field === "string") {
        add(item.field, firstString(item.message));
      }
    }
  } else if (isRecord(ve)) {
    // hand-rolled dict: { field: [messages] }
    for (const [field, val] of Object.entries(ve)) {
      add(field, firstString(val));
    }
  }

  // DRF serializer errors nested under the envelope's `errors`.
  if (isRecord(data.errors)) {
    for (const [field, val] of Object.entries(data.errors)) {
      if (field === "detail" || field === "non_field_errors") continue;
      add(field, firstString(val));
    }
  }

  // Bare DRF serializer map at the top level (no envelope present): treat any
  // non-meta key whose value is a string/array-of-strings as a field error.
  if (Object.keys(out).length === 0 && !("validation_errors" in data)) {
    for (const [field, val] of Object.entries(data)) {
      if (META_KEYS.has(field)) continue;
      add(field, firstString(val));
    }
  }

  return out;
};

const deriveKind = (
  status: number,
  hasFieldErrors: boolean,
): ApiErrorKind => {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "notfound";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limit";
  if (status === 422) return "validation";
  if (status === 400) return hasFieldErrors ? "validation" : "domain";
  if (status >= 500) return "server";
  return "unknown";
};

export const parseApiError = (error: unknown): NormalizedApiError => {
  const response = isRecord(error)
    ? (error.response as { status?: unknown; data?: unknown } | undefined)
    : undefined;

  // No response → the request never completed. Distinguish a known-offline
  // browser from a server that simply did not answer.
  if (!isRecord(response)) {
    const offline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    return {
      status: null,
      kind: offline ? "offline" : "network",
      code: null,
      serverMessage: error instanceof Error ? error.message : null,
      fieldErrors: {},
      raw: error,
    };
  }

  const status = typeof response.status === "number" ? response.status : 0;
  const data = isRecord(response.data) ? response.data : {};

  const fieldErrors = collectFieldErrors(data);

  const code =
    typeof data.error_code === "string" && data.error_code.trim().length > 0
      ? data.error_code.trim()
      : null;

  // The most specific human sentence the server offered, skipping boilerplate.
  let serverMessage = firstString(data.message);
  if (!serverMessage) {
    const detail = firstString(data.detail);
    if (detail && !BOILERPLATE_DETAILS.has(detail)) serverMessage = detail;
  }
  if (!serverMessage && isRecord(data.errors)) {
    serverMessage =
      firstString(data.errors.detail) ??
      firstString(data.errors.non_field_errors);
  }
  if (!serverMessage) {
    serverMessage = firstString(data.non_field_errors);
  }

  return {
    status,
    kind: deriveKind(status, Object.keys(fieldErrors).length > 0),
    code,
    serverMessage,
    fieldErrors,
    raw: error,
  };
};
