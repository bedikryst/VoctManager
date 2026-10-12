/**
 * @file api.ts
 * @description The site's one credentialed API client, used by the comment mode only. The
 *  islands' helpers send `credentials: "omit"` on purpose (`islands/landing/api/notices.ts`), so
 *  this is a module of its own and they stay as they are.
 *
 *  Site, panel and API share one origin, so the panel's session cookies reach `/api/copydesk/*`
 *  from a site page and no token travels in a link. The contract is the panel's own
 *  (`frontend/src/shared/api/api.ts`):
 *  - Writes carry `X-CSRFToken` from the `csrftoken` cookie, because the backend enforces CSRF
 *    whenever the access cookie is present; `GET /api/csrf/` sets the cookie when it is missing.
 *  - A 401 triggers ONE single-flight `POST /api/token/refresh/`, then the request is replayed.
 *    Only a refresh the server answers with 401 ends the session; one that gets no answer leaves
 *    it alone and the request fails as offline.
 *  - A CSRF refusal and a permission refusal are both 403 with the same generic `detail`; only
 *    `errors.detail` starting with "CSRF Failed" tells them apart. A CSRF refusal is retried once
 *    with a fresh cookie, since it means the token rotated (a login in another tab).
 * @module comment-mode/api
 */

import type { Locale } from "../i18n/config";
import type { MatchField } from "./match";

export type ProposalStatus = "DRAFT" | "PROPOSED" | "ACCEPTED" | "REJECTED";

/**
 * Why a trusted translator's save waits for the reviewers after all: an empty value, or `{slots}`
 * or link targets that differ from the Polish (`copydesk/trust.py`).
 */
export type HoldReason = "empty" | "slots" | "links";

/** The reader's own proposal on a field, as the site index carries it. */
export interface OwnProposal {
  readonly id: string;
  readonly status: ProposalStatus;
  readonly value: string;
  readonly comment: string;
  /** Accepted by the reader's own save (a trusted translator), not yet published: still theirs. */
  readonly self_accepted: boolean;
}

/** One field of the site in one locale (`GET site-index/`). `mine` is patched after a save. */
export interface IndexRow extends MatchField {
  readonly id: string;
  readonly key: string;
  readonly scope: string;
  readonly scope_label: string;
  /** The Polish path of the scope's page; empty when it has none. */
  readonly scope_path: string;
  readonly label: string;
  readonly kind: string;
  /** This locale's value, `""` when untranslated. */
  readonly value: string;
  /** The Polish, set only when `value` is empty: what the page prints instead. */
  readonly fallback_value: string;
  readonly is_stale: boolean;
  mine: OwnProposal | null;
  readonly others_open: number;
}

export interface SiteIndex {
  readonly locale: Locale;
  /** The reader's `Profile.language`: the language the mode's chrome speaks. */
  readonly language: Locale;
  /** Where the reader's saves are accepted without a review: every locale but Polish, or none. */
  readonly trusted_locales: readonly Locale[];
  readonly segments: IndexRow[];
}

/** A proposal as the desk lists it (`GET segments/`). Times are ISO 8601. */
export interface DeskProposal {
  readonly id: string;
  readonly value: string;
  readonly status: ProposalStatus;
  readonly comment: string;
  readonly author_name: string;
  readonly is_mine: boolean;
  readonly self_accepted: boolean;
  readonly updated_at: string;
  readonly reviewed_at: string | null;
  readonly applied_at: string | null;
}

/** One field in one locale with its proposal history (`GET segments/?scope=`). */
export interface DeskSegment {
  readonly id: string;
  readonly key: string;
  readonly locale: Locale;
  readonly kind: string;
  readonly value: string;
  /** The current Polish; equal to `value` on a Polish row. */
  readonly source_value: string;
  readonly is_stale: boolean;
  readonly proposals: readonly DeskProposal[];
}

/**
 * What `POST proposals/` stored: the value after the server's sanitizer. `ACCEPTED` is a trusted
 * translator's save; `held` says why one of theirs went to the reviewers instead.
 */
export interface StoredProposal {
  readonly id: string;
  readonly status: ProposalStatus;
  readonly value: string;
  readonly comment: string;
  readonly self_accepted: boolean;
  readonly held: HoldReason | null;
}

/**
 * A request that did not succeed. `status` 0 is no answer at all (offline, a dropped connection,
 * a refresh that got no reply).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly csrf: boolean;

  constructor(status: number, detail: string, csrf = false) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.csrf = csrf;
  }
}

const CSRF_COOKIE = "csrftoken";

function readCookie(name: string): string {
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

async function csrfToken(fresh: boolean): Promise<string> {
  const known = readCookie(CSRF_COOKIE);
  if (known && !fresh) return known;
  try {
    await fetch("/api/csrf/", { credentials: "same-origin", cache: "no-store" });
  } catch {
    // No answer: the write goes out without the header and its own failure says so.
  }
  return readCookie(CSRF_COOKIE);
}

type Method = "GET" | "POST" | "DELETE";

async function send(method: Method, path: string, body: unknown, freshCsrf: boolean): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const token = await csrfToken(freshCsrf);
    if (token) headers["X-CSRFToken"] = token;
  }
  try {
    return await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "No answer from the server.");
  }
}

type RefreshOutcome = "renewed" | "ended" | "unreachable";

let refreshing: Promise<RefreshOutcome> | null = null;

/** One refresh for every request that met a 401 at the same time. */
function refreshSession(): Promise<RefreshOutcome> {
  refreshing ??= (async (): Promise<RefreshOutcome> => {
    try {
      const response = await send("POST", "/api/token/refresh/", {}, false);
      if (response.ok) return "renewed";
      return response.status === 401 ? "ended" : "unreachable";
    } catch {
      return "unreachable";
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

interface ErrorBody {
  readonly detail?: unknown;
  readonly errors?: { readonly detail?: unknown } | null;
}

async function failure(response: Response): Promise<ApiError> {
  let body: ErrorBody = {};
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    // Not JSON (a proxy's error page): the status alone speaks.
  }
  const inner = typeof body.errors?.detail === "string" ? body.errors.detail : "";
  const detail = inner || (typeof body.detail === "string" ? body.detail : "") || response.statusText;
  return new ApiError(response.status, detail, response.status === 403 && inner.startsWith("CSRF Failed"));
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T | null> {
  let response = await send(method, path, body, false);

  if (response.status === 401) {
    const outcome = await refreshSession();
    if (outcome === "unreachable") throw new ApiError(0, "The session could not be renewed.");
    if (outcome === "renewed") response = await send(method, path, body, false);
  }

  if (response.status === 403 && method !== "GET") {
    const refusal = await failure(response);
    if (!refusal.csrf) throw refusal;
    response = await send(method, path, body, true);
  }

  if (!response.ok) throw await failure(response);
  if (response.status === 204) return null;
  return (await response.json()) as T;
}

async function expect<T>(promise: Promise<T | null>): Promise<T> {
  const value = await promise;
  if (value === null) throw new ApiError(0, "Empty answer.");
  return value;
}

export function fetchSiteIndex(locale: Locale): Promise<SiteIndex> {
  return expect(request<SiteIndex>("GET", `/api/copydesk/site-index/?locale=${encodeURIComponent(locale)}`));
}

/** Every locale of one scope's fields, with their proposals: what the edit sheet shows beside. */
export async function fetchScopeSegments(scope: string): Promise<readonly DeskSegment[]> {
  const page = await expect(
    request<{ segments: DeskSegment[] }>("GET", `/api/copydesk/segments/?scope=${encodeURIComponent(scope)}`),
  );
  return page.segments;
}

/**
 * Write or revise the reader's open proposal. All three of `value`, `comment` and `status` are
 * sent every time: a revision overwrites each with what arrived, so a missing comment would erase
 * the editor's note.
 */
export function saveProposal(segmentId: string, value: string, comment: string): Promise<StoredProposal> {
  return expect(
    request<StoredProposal>("POST", "/api/copydesk/proposals/", {
      segment_id: segmentId,
      value,
      comment,
      status: "PROPOSED",
    }),
  );
}

/**
 * Withdraw the reader's open proposal, or the acceptance their own save made. A 409 means a
 * reviewer settled it, or `copy:apply` wrote it, meanwhile.
 */
export async function withdrawProposal(proposalId: string): Promise<void> {
  await request<null>("DELETE", `/api/copydesk/proposals/${encodeURIComponent(proposalId)}/`);
}

/** What "Gotowe" set off: how many proposals the digest announced, and whether anyone got it. */
export interface NotifyOutcome {
  readonly proposals: number;
  /** False when there is no reviewer to tell. */
  readonly delivered: boolean;
}

/**
 * Send the reader's not-yet-announced proposals to the reviewers now, rather than after the
 * half hour of quiet the hourly digest waits for. Pressing it twice announces nothing twice.
 */
export function notifyReviewers(): Promise<NotifyOutcome> {
  return expect(request<NotifyOutcome>("POST", "/api/copydesk/notify/", {}));
}
