// @ts-check
/**
 * @file tree.mjs
 * @description What the working tree says about the corpus, for the two commands that care.
 *
 *  `copy:sync` REFUSES a dirty `src/content/`: a mirror built from uncommitted text describes a
 *  site nobody is serving, and the desk would show an editor sentences that exist only on one
 *  laptop. `copy:apply` only WARNS about one, because there the danger is different in kind — the
 *  patch's own fields are protected by the pre-image check, and what a dirty tree costs is the
 *  review, by mixing the developer's uncommitted work into the diff the patch is judged by.
 *
 *  This can only live on the client. The server has no checkout to inspect; what it can offer is
 *  traceability — the revision the payload claimed — and not enforcement.
 * @architecture Astro islands 2026
 * @module copydesk/tree
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Where the corpus and its overlays live, relative to `web/` — the only tree these commands read. */
export const CONTENT_DIR = "src/content";

/**
 * The revision this checkout is on, and whether the corpus in it is committed.
 *
 * @returns {{revision: string, dirty: boolean}}
 */
export function describeTree() {
  /** @param {string[]} args */
  const git = (args) => execFileSync("git", args, { cwd: WEB_ROOT, encoding: "utf8" }).trim();
  const head = git(["rev-parse", "--short", "HEAD"]);
  const dirty = git(["status", "--porcelain", "--", CONTENT_DIR]).length > 0;
  return { revision: dirty ? `${head}-dirty` : head, dirty };
}
