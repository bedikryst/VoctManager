/**
 * @file types.ts
 * @description The single, normalized shape every API failure is funnelled into,
 * so UI code reasons about one contract instead of the half-dozen the server
 * actually emits (RFC 7807 envelope, pydantic `validation_errors` lists, DRF
 * `{field: [...]}` maps, `{error_code, message}` auth payloads, bare network
 * failures). Producing this is the job of `parseApiError`; turning it into
 * localized words is the job of `resolveErrorCopy`.
 * @module shared/api/errors/types
 * @architecture Enterprise SaaS 2026
 */

/** Coarse category that drives the headline, tone and recovery affordance. */
export type ApiErrorKind =
  | "validation" // a field (or the whole form) was rejected — show it on the field
  | "domain" // a business rule said no (e.g. "rehearsal already locked")
  | "auth" // not authenticated / session expired
  | "permission" // authenticated but not allowed
  | "notfound" // the resource is gone
  | "conflict" // a concurrent/duplicate edit
  | "rate_limit" // too many attempts
  | "network" // request never reached the server
  | "offline" // ...and the browser knows it is offline
  | "server" // 5xx — our fault, not theirs
  | "unknown";

export interface NormalizedApiError {
  /** HTTP status, or `null` when the request never reached the server. */
  status: number | null;
  /** Coarse category. */
  kind: ApiErrorKind;
  /** Stable machine code from the server (`error_code`), when provided. */
  code: string | null;
  /** A human sentence the server returned, if any (may be untranslated). */
  serverMessage: string | null;
  /** `field name → first message`, ready to push straight onto a form. */
  fieldErrors: Record<string, string>;
  /** The original thrown value, kept for logging/telemetry. */
  raw: unknown;
}
