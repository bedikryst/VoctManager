// @ts-check
/**
 * @file sync.mjs
 * @description `npm run copy:sync` — the whole read direction as one command: extract the corpus,
 *  then post it to `POST /api/copydesk/segments/ingest/`, which reconciles the desk's mirror of git
 *  and retires the keys the extractor no longer emits.
 *
 *  An HTTP door rather than a management command because the loop then runs from the repository on
 *  any machine with a checkout, which is also how `apply-copy` must already reach the database:
 *  Postgres publishes no host port, so nothing on the developer's machine can talk to it directly.
 *  The alternative — `docker compose exec -T … < segments.json` — needs a shell on the server and
 *  puts a 300 kB UTF-8 payload through a Windows pipe, which is a recorded way to lose Polish
 *  characters without anything saying so.
 *
 *  THE CLEAN-TREE GUARD LIVES HERE, and can only live here: the server has no checkout to inspect.
 *  A mirror built from uncommitted text describes a site nobody is serving — an editor would be
 *  reviewing sentences that exist only on one laptop — so a dirty `src/content/` stops the run.
 *  `--allow-dirty` overrides it and marks the revision so the log says which mirror this was.
 *
 *  Credentials come from the environment (`COPYDESK_EMAIL` / `COPYDESK_PASSWORD`), never from a
 *  file in the repo: the account is staff, which is the account that can review and accept.
 * @architecture Astro islands 2026
 * @module copydesk/sync
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { extractToFile } from "./index.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Where the corpus lives, relative to `web/` — the only tree the guard cares about. */
const CONTENT_DIR = "src/content";

const DEFAULT_API = "http://localhost:8000";

/**
 * @param {string[]} args
 * @returns {string}
 */
function git(args) {
  return execFileSync("git", args, { cwd: WEB_ROOT, encoding: "utf8" }).trim();
}

/**
 * The revision this payload was read from, and whether the corpus in it is committed.
 *
 * @returns {{ revision: string, dirty: boolean }}
 */
function describeTree() {
  const head = git(["rev-parse", "--short", "HEAD"]);
  const dirty = git(["status", "--porcelain", "--", CONTENT_DIR]).length > 0;
  return { revision: dirty ? `${head}-dirty` : head, dirty };
}

/**
 * @param {string} base
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>}
 */
async function authenticate(base, email, password) {
  const response = await fetch(`${base}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`[copydesk] sign-in failed: ${response.status} ${await response.text()}`);
  }
  const { access } = await response.json();
  if (!access) throw new Error("[copydesk] sign-in returned no access token.");
  return access;
}

/**
 * @param {object} args
 * @param {string} args.base
 * @param {string} args.token
 * @param {object[]} args.segments
 * @param {string} args.revision
 * @param {boolean} args.prune
 */
async function ingest({ base, token, segments, revision, prune }) {
  const response = await fetch(`${base}/api/copydesk/segments/ingest/`, {
    method: "POST",
    headers: {
      // Explicit charset: the payload is Polish prose and this is the one place a
      // default could quietly reinterpret it.
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ segments, revision, prune }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`[copydesk] ingest failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

/**
 * Say what the run did, and say it loudly when it withdrew more keys than one editorial deletion
 * explains — that is the signature of an entry INSERTED into a positionally keyed list, which
 * re-keys everything below it and takes those rows' proposals and first-seen dates with them.
 *
 * @param {Record<string, any>} result
 */
function report(result) {
  console.log(
    `[copydesk] mirror: ${result.created} created · ${result.updated} updated · ${result.retired} retired`,
  );
  if (!result.retired) return;

  const lines = [
    `${result.retired_keys.length} key(s) left the site:`,
    ...result.retired_keys.map((/** @type {string} */ key) => `  - ${key}`),
  ];
  if (result.orphaned_proposals) {
    lines.push(`${result.orphaned_proposals} OPEN PROPOSAL(S) were on those rows.`);
  }
  if (result.bulk_retirement) {
    lines.push(
      "",
      "That many keys at once is the signature of a SHIFTED LIST, not a deletion.",
      "Check whether an entry was inserted into a positionally keyed list; if it was,",
      "the rows are still on the site under new keys and their proposals are stranded.",
      "Retirement is a soft delete — `restore()` in the admin puts them back.",
    );
  }
  const shout = result.bulk_retirement ? console.warn : console.log;
  shout(lines.map((line) => `[copydesk] ${line}`).join("\n"));
}

async function main() {
  const argv = process.argv.slice(2);
  const allowDirty = argv.includes("--allow-dirty");
  const prune = !argv.includes("--no-prune");
  const dryRun = argv.includes("--dry-run");

  const { revision, dirty } = describeTree();
  if (dirty && !allowDirty) {
    console.error(
      `[copydesk] ${CONTENT_DIR} has uncommitted changes.\n` +
        "[copydesk] A mirror built from them describes a site nobody is serving, and the desk\n" +
        "[copydesk] would show an editor sentences that exist only on this machine.\n" +
        "[copydesk] Commit the corpus, or re-run with --allow-dirty.",
    );
    process.exitCode = 1;
    return;
  }

  const { segments } = await extractToFile({});
  if (dryRun) {
    console.log(`[copydesk] dry run at ${revision}: ${segments.length} rows not posted.`);
    return;
  }

  const base = (process.env.COPYDESK_API ?? DEFAULT_API).replace(/\/+$/u, "");
  const email = process.env.COPYDESK_EMAIL;
  const password = process.env.COPYDESK_PASSWORD;
  if (!email || !password) {
    console.error(
      "[copydesk] Set COPYDESK_EMAIL and COPYDESK_PASSWORD (a staff account — the same one that reviews).",
    );
    process.exitCode = 1;
    return;
  }

  const token = await authenticate(base, email, password);
  report(await ingest({ base, token, segments, revision, prune }));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
