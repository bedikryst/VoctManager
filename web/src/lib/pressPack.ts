/**
 * @file pressPack.ts
 * @description Where the downloadable press pack lives, what it is called, and whether it is
 *  there. One module, because three things have to agree about it: the page that offers it, the
 *  script that builds it (`scripts/press-pack.mjs`) and the developer who uploads it.
 *
 *  THE PAGE LOOKS; IT IS NEVER TOLD. /press renders a download tile or an honest "write to us"
 *  band depending on what this function finds on disk at build. The 2026-07 audit of that page
 *  found SEVEN dead download links, including a gold "Pobierz cały pakiet" pointing at a
 *  directory that did not exist — because the markup asserted a file instead of asking about one.
 *  A hard-coded href cannot be kept true; a lookup cannot be wrong.
 *
 *  THE ARCHIVE IS NOT IN GIT, on the same terms as the photographs it contains
 *  (`web/.gitignore`): tens of megabytes of other people's files, uploaded to the build host
 *  out-of-band. The consequence is the good one — a host without the file builds a page that
 *  simply says the pack is still being assembled, which is true there.
 *
 *  DATED, AND THE NEWEST ONE WINS. A pack carries the month it was cut, because a photograph
 *  selection and a rider go stale and an organiser holding last year's zip should be able to see
 *  that they are. Several may sit in the directory during a changeover; the page offers the
 *  latest and nothing enumerates the rest.
 * @architecture Astro islands 2026
 * @module lib/pressPack
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Inside `web/`, and inside `public/` so the build copies it verbatim to the served root. */
export const PACK_DIR = "public/press";

/** The URL path a reader downloads from — `public/` is the served root. */
export const PACK_URL_BASE = "/press";

/** `voctensemble-press-2026-09.zip`. The month is the pack's own, not today's. */
export const PACK_NAME = /^voctensemble-press-(\d{4})-(\d{2})\.zip$/;

/** The archive's name for a given month. The one place that spells it. */
export function packFileName(year: number, month: number): string {
  return `voctensemble-press-${year}-${String(month).padStart(2, "0")}.zip`;
}

export interface PressPack {
  /** Absolute URL path, ready for an `href`. */
  readonly href: string;
  readonly fileName: string;
  readonly bytes: number;
  /** First day of the month the pack was cut for — what the page prints beside the size. */
  readonly cutAt: Date;
}

/**
 * The newest pack in `public/press/`, or `undefined` when there is none.
 *
 * `root` defaults to the process's working directory, which is `web/` for both callers: `astro
 * build` runs from the directory holding `astro.config.mjs`, and npm runs a script from its
 * package's directory. Passing it explicitly is for tests.
 */
export function findPressPack(root: string = process.cwd()): PressPack | undefined {
  const dir = join(root, PACK_DIR);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    // No directory at all is the normal state of a fresh checkout, not an error.
    return undefined;
  }

  const candidates = names
    .map((name) => ({ name, match: PACK_NAME.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => entry.match !== null)
    // Lexical order is chronological order for `YYYY-MM`, which is the whole reason for the shape.
    .sort((a, b) => b.name.localeCompare(a.name));

  const newest = candidates[0];
  if (!newest) return undefined;

  const year = Number(newest.match[1]);
  const month = Number(newest.match[2]);
  return {
    href: `${PACK_URL_BASE}/${newest.name}`,
    fileName: newest.name,
    bytes: statSync(join(dir, newest.name)).size,
    cutAt: new Date(Date.UTC(year, month - 1, 1)),
  };
}

/**
 * A file size as a reader decides whether to download it on a train. Megabytes, one decimal below
 * ten, none above — the precision nobody is served by.
 */
export function formatBytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
