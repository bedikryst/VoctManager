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
 * @param {string} url
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function getJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`[copydesk] GET ${url} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

/**
 * @param {string} url
 * @param {string} token
 * @param {unknown} body
 * @returns {Promise<any>}
 */
export async function postJson(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      // Explicit charset: the payload is Polish prose and this is the one place a default could
      // quietly reinterpret it.
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`[copydesk] POST ${url} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}
