/**
 * @file notices.ts
 * @description Client for the concert notice list — the site's only mailing list, and the only
 *  place it writes a reader's address anywhere. Three calls against our own Django backend
 *  (`outreach` app): ask to be written to, confirm the double opt-in, withdraw.
 *
 *  EVERY CALL IS A POST, INCLUDING THE TWO THAT LOOK LIKE LINK FOLLOW-UPS. The confirmation and
 *  unsubscribe links in a mail land on `/nuntius?confirm=…`, a page — and the page, once a human
 *  browser has run it, asks. A GET that confirmed on arrival would be spent by every link scanner
 *  in the chain (Outlook Safe Links, antivirus proxies), forging the one fact double opt-in
 *  exists to establish.
 *
 *  Cookie-less and unauthenticated, exactly like the donation and patronage clients: there is no
 *  session here, and sending credentials would only invite CSRF machinery this endpoint does not
 *  need.
 * @architecture Astro islands 2026
 * @module islands/landing/api/notices
 */

/** The endpoints, whole — nothing here is assembled from parts at runtime. */
const NOTICE_API = {
  subscribe: "/api/outreach/notices/subscribe/",
  confirm: "/api/outreach/notices/confirm/",
  unsubscribe: "/api/outreach/notices/unsubscribe/",
} as const;

/**
 * Which surface a sign-up was given on. The backend keeps an allowlist and refuses anything
 * else, so this union and `outreach/serializers.NOTICE_SURFACES` are one list in two places —
 * adding a placement means adding it to both.
 *
 * The value describes the SCREEN, which is why there is more than one of them and why that costs
 * the record nothing: every placement is the same island over the same clause, mounted by
 * `components/NoticeSignup.astro`, and the clause's version is the server's to name.
 */
export type NoticeSurface = "web:koncerty" | "web:newsletter" | "web:404" | "web:kontakt";

/** The site's three locales, as the backend spells them. */
export type NoticeLocale = "pl" | "en" | "fr";

/** Answers to a confirmation link. `invalid` covers an unknown, spent-then-withdrawn or garbled token. */
export const CONFIRM_STATUSES = [
  "confirmed",
  "already_confirmed",
  "expired",
  "invalid",
] as const;
export type ConfirmStatus = (typeof CONFIRM_STATUSES)[number];

/** Answers to an unsubscribe link. */
export const UNSUBSCRIBE_STATUSES = [
  "unsubscribed",
  "already_unsubscribed",
  "invalid",
] as const;
export type UnsubscribeStatus = (typeof UNSUBSCRIBE_STATUSES)[number];

/** Which link the reader followed. The two share a shape and differ only in their outcomes. */
export type NoticeAction = "confirm" | "unsubscribe";

export class NoticeError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "NoticeError";
  }
}

async function postJson(url: string, body: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "omit",
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new NoticeError(`Network error contacting ${url}`, cause);
  }
}

/**
 * Asks to be written to. Resolves on 202 and tells the caller nothing else — the endpoint
 * answers identically whether the address was new, pending or already on the list, so that a
 * public form cannot be used to ask "is this person subscribed?".
 */
export async function subscribeToNotices(payload: {
  readonly email: string;
  readonly locale: NoticeLocale;
  readonly surface: NoticeSurface;
}): Promise<void> {
  const response = await postJson(NOTICE_API.subscribe, {
    email: payload.email,
    locale: payload.locale,
    surface: payload.surface,
    consent: true,
  });
  if (!response.ok) {
    throw new NoticeError(`Notice sign-up failed: HTTP ${response.status}`);
  }
}

/**
 * Spends a link's token and reports which of the states the reader is in.
 *
 * An unrecognised `status` is thrown rather than rendered: the page maps a status to a sentence,
 * and a value it has no sentence for would otherwise print an empty panel that looks like
 * success. A backend that grows a fourth outcome must grow this file with it.
 */
export async function resolveNoticeToken(
  action: NoticeAction,
  token: string,
): Promise<ConfirmStatus | UnsubscribeStatus> {
  const response = await postJson(NOTICE_API[action], { token });
  if (!response.ok) {
    throw new NoticeError(`Notice ${action} failed: HTTP ${response.status}`);
  }

  const payload: unknown = await response.json().catch((cause: unknown) => {
    throw new NoticeError(`Notice ${action} returned no JSON`, cause);
  });
  const status =
    typeof payload === "object" && payload !== null
      ? (payload as { status?: unknown }).status
      : undefined;

  const known: readonly string[] =
    action === "confirm" ? CONFIRM_STATUSES : UNSUBSCRIBE_STATUSES;
  if (typeof status !== "string" || !known.includes(status)) {
    throw new NoticeError(`Notice ${action} returned an unknown status: ${String(status)}`);
  }
  return status as ConfirmStatus | UnsubscribeStatus;
}
