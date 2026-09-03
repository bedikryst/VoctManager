// @ts-check
/**
 * @file client.mjs
 * @description The copy desk's two commands talk to the panel over HTTP, and this is the door they
 *  share. `copy:sync` carries git's text INTO the desk's mirror; `copy:apply` carries accepted
 *  proposals back OUT into the repository. Both run from a checkout on the developer's machine,
 *  which is the reason the seam is an endpoint at all: Postgres publishes no host port, so nothing
 *  here can reach the database directly (spec §6e).
 *
 *  Credentials come from the environment and never from a file in the repo. The account is staff —
 *  the same power that accepts a proposal in the first place, because both ends of this loop decide
 *  what the public site will say.
 * @architecture Astro islands 2026
 * @module copydesk/client
 */

const DEFAULT_API = "http://localhost:8000";

/** The panel this checkout talks to, without its trailing slash. */
export function apiBase() {
  return (process.env.COPYDESK_API ?? DEFAULT_API).replace(/\/+$/u, "");
}

/**
 * The staff credentials, or null with the reason printed. Returned rather than thrown so a command
 * can decide whether it needs them at all — a dry run does not.
 *
 * @returns {{email: string, password: string}|null}
 */
export function credentials() {
  const email = process.env.COPYDESK_EMAIL;
  const password = process.env.COPYDESK_PASSWORD;
  if (!email || !password) {
    console.error(
      "[copydesk] Set COPYDESK_EMAIL and COPYDESK_PASSWORD (a staff account — the same one that reviews).",
    );
    return null;
  }
  return { email, password };
}

/**
 * @param {string} base
 * @param {{email: string, password: string}} account
 * @returns {Promise<string>}
 */
export async function authenticate(base, account) {
  const response = await fetch(`${base}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account),
  });
  if (!response.ok) {
    throw new Error(`[copydesk] sign-in failed: ${response.status} ${await response.text()}`);
  }
  const { access } = await response.json();
  if (!access) throw new Error("[copydesk] sign-in returned no access token.");
  return access;
}

/**
 * Pauses between attempts when a request fails on the SERVER'S side.
 *
 * An import posts a thousand times in a row against a one-vCPU droplet, where an occasional 500 or
 * dropped connection is the traffic rather than a defect in the payload — and losing one of them
 * ends the run three quarters of the way through. A 4xx is never retried: that is the server
 * refusing this exact request, and repeating it only delays the stop.
 *
 * Repeating a POST is safe for both of this loop's writes: `save_proposal` revises the author's own
 * open proposal rather than adding a row, and an accept that already landed answers 409, which
 * `proposeAndAccept` reads as the state it was asking for.
 */
const RETRY_PAUSES_MS = [2_000, 5_000, 15_000, 30_000];

/**
 * The floor on how often this client knocks, in milliseconds.
 *
 * Under half the server's own 300/minute cap, and deliberately so: the panel runs one Django
 * process on a one-vCPU droplet that is also serving the people using it, and an import saturating
 * the cap is a load test aimed at production — the observed symptom is the worker wedging and
 * answering 500 to everything for a quarter of a minute, this run's requests and an editor's alike.
 * Pacing turns a 428-value locale into a few unattended minutes, which is the right trade for a
 * command that runs twice a year.
 */
const MIN_REQUEST_GAP_MS = 400;

/** When the next request may leave, as a monotonic-enough wall clock. */
let nextSlot = 0;

/** Wait for this client's own turn. Serial by construction: the import posts one row at a time. */
async function takeSlot() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_REQUEST_GAP_MS;
  if (at > now) await pause(at - now);
}

/**
 * How many times one request may be told to come back later before the run gives up.
 *
 * 429 is the one 4xx that means "later" rather than "never": DRF caps an authenticated account at
 * 300 requests a minute, and an import of 428 values is two requests per value, so the cap is not
 * an anomaly — it is the speed this loop runs at. The server names the wait, the request sleeps it
 * off, and the run settles into the rate the panel is willing to serve. A throttled request is not
 * recorded in the throttle's own history, so waiting costs nothing but time.
 */
const THROTTLE_ATTEMPTS = 12;

/** Nothing is learned by printing a wait shorter than this, and there are hundreds of them. */
const THROTTLE_LOG_FLOOR_MS = 3_000;

const pause = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The wait the server asked for, in milliseconds, or null when it named none.
 *
 * @param {Response} response
 */
function retryAfterMs(response) {
  const header = Number(response.headers.get("Retry-After"));
  // A little over the announced second: asking again at the exact boundary is how a run spends its
  // attempts re-learning the same wait.
  return Number.isFinite(header) && header >= 0 ? header * 1000 + 500 : null;
}

/**
 * One request, retried while the failure is the server's or its rate limit. Errors carry `status`
 * so a caller can tell one refusal from another without parsing the message.
 *
 * @param {string} method
 * @param {string} url
 * @param {RequestInit} init
 * @returns {Promise<any>}
 */
async function send(method, url, init) {
  let faults = 0;
  let throttles = 0;

  for (;;) {
    /** @type {Response|null} */
    let response = null;
    /** @type {unknown} */
    let failure = null;
    await takeSlot();
    try {
      response = await fetch(url, init);
    } catch (error) {
      failure = error;
    }

    /** @type {number|null} */
    let delay = null;

    if (response !== null) {
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;

      failure = Object.assign(
        new Error(`[copydesk] ${method} ${url} failed: ${response.status} ${JSON.stringify(payload)}`),
        { status: response.status },
      );
      if (response.status === 429 && throttles < THROTTLE_ATTEMPTS) {
        delay = retryAfterMs(response) ?? RETRY_PAUSES_MS[Math.min(throttles, RETRY_PAUSES_MS.length - 1)];
        throttles += 1;
      } else if (response.status >= 500 && faults < RETRY_PAUSES_MS.length) {
        delay = RETRY_PAUSES_MS[faults];
        faults += 1;
      }
    } else if (faults < RETRY_PAUSES_MS.length) {
      delay = RETRY_PAUSES_MS[faults];
      faults += 1;
    }

    if (delay === null) throw failure;
    if (delay >= THROTTLE_LOG_FLOOR_MS) {
      console.warn(
        `[copydesk] ${method} ${url.replace(/^https?:\/\/[^/]+/u, "")} — ` +
          `${failure instanceof Error ? failure.message.split(" failed: ").pop()?.slice(0, 60) : "no response"}; ` +
          `waiting ${Math.round(delay / 1000)}s.`,
      );
    }
    await pause(delay);
  }
}

/**
 * @param {string} url
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function getJson(url, token) {
  return send("GET", url, { headers: { Authorization: `Bearer ${token}` } });
}

/**
 * @param {string} url
 * @param {string} token
 * @param {unknown} body
 * @returns {Promise<any>}
 */
export async function postJson(url, token, body) {
  return send("POST", url, {
    method: "POST",
    headers: {
      // Explicit charset: the payload is Polish prose and this is the one place a default could
      // quietly reinterpret it.
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}
