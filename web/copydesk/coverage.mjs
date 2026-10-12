// @ts-check
/**
 * @file coverage.mjs
 * @description `npm run copy:coverage` — runs the comment mode's matcher over every page of
 *  `dist/` against the corpus, and prints what an editor tapping that page would find: how much
 *  of its text is editable, which spans open a chooser, which of the page's own fields cannot be
 *  tapped and why, and the text no field accounts for.
 *
 *  It reads the built HTML, so it sees what the server sends: client-only islands and anything
 *  scripts render later (the rite after it ends, an opened overlay) are outside it, and their
 *  copy shows up as `scripted` when it travels in island props. Build first (`npm run build`); the
 *  corpus is extracted fresh on every run, the same way `copy:sync` does it.
 *
 *  Flags: `--summary` prints the table only; `--loose` adds each page's text no field accounts for
 *  (mostly concert data and chrome dictionaries, so long); `--suspects` adds, per locale, every
 *  tap that opens one field of another scope and every own field more than one span opens — where
 *  chrome that spells a desk value shows up, to be marked `data-desk="none"` (`match.ts`);
 *  `--locale <pl|en|fr>` and
 *  `--page <path>` narrow the details (the table always lists every page). From Git Bash, run
 *  `--page` under `MSYS_NO_PATHCONV=1`, which otherwise rewrites `/fr/…` into a Windows path.
 * @architecture Astro islands 2026
 * @module copydesk/coverage
 */

import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  BREAK,
  compileCorpus,
  fieldPattern,
  findOccurrences,
  isOnPage,
  normalizeText,
  readPage,
} from "../src/comment-mode/match.ts";
import { pathScope } from "../src/comment-mode/scopePath.ts";
import { readHtmlText } from "./htmlText.mjs";
import { extractToFile } from "./index.mjs";
import { SITE_LOCALES, scopeOf } from "./segment.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = path.join(WEB_ROOT, "dist");
const PUBLIC = path.join(WEB_ROOT, "public");
const SOURCES = path.join(WEB_ROOT, "src");
/** The mode itself never changes what a page prints, so editing it does not stale the build. */
const MODE_SOURCES = path.join(SOURCES, "comment-mode");

/** Shorter uncovered stretches are labels and separators, not a paragraph somebody would edit. */
const UNCOVERED_MIN = 16;
/** Uncovered text on more than this share of a locale's pages is the chrome, listed once. */
const CHROME_SHARE = 0.5;
const SNIPPET = 96;
const NUL = String.fromCharCode(0);

/**
 * @typedef {object} CoverageField
 * @property {string} key
 * @property {string} scope
 * @property {string} kind
 * @property {string} value
 * @property {string} fallback_value
 * @property {string} label
 */

/**
 * Why one of the page's own fields cannot be tapped there.
 *  - `inside`: its text is on the page, but only within a longer field's span.
 *  - `outside`: only inside chrome marked `data-desk="none"`, which says the desk prints nothing
 *    there: either the marker covers a field and must move, or the chrome spells the field's value.
 *  - `hidden`: only in attributes, the head, JSON-LD or `<noscript>` (meta, `alt`).
 *  - `scripted`: only in island props or a JSON data block; it appears when client code renders it.
 *  - `short`: under three characters, never matched by design.
 *  - `missing`: nowhere in the HTML.
 *
 * @typedef {"inside" | "outside" | "hidden" | "scripted" | "short" | "missing"} Absence
 */
const ABSENCES = /** @type {const} */ (["inside", "outside", "hidden", "scripted", "short", "missing"]);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const value = (/** @type {string} */ flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    summary: argv.includes("--summary"),
    loose: argv.includes("--loose"),
    suspects: argv.includes("--suspects"),
    locale: value("--locale"),
    page: value("--page"),
  };
}

/**
 * The fields each locale's pages print: the locale's own value, the Polish where it has none.
 *
 * @param {{ key: string, locale: string, kind: string, value: string, label: string }[]} segments
 * @returns {Map<string, CoverageField[]>}
 */
function fieldsByLocale(segments) {
  /** @type {Map<string, string>} */
  const polish = new Map();
  for (const row of segments) if (row.locale === "pl") polish.set(row.key, row.value);

  /** @type {Map<string, CoverageField[]>} */
  const out = new Map(SITE_LOCALES.map((locale) => [locale, []]));
  for (const row of segments) {
    out.get(row.locale)?.push({
      key: row.key,
      scope: scopeOf(row.key),
      kind: row.kind,
      value: row.value,
      fallback_value: row.value ? "" : (polish.get(row.key) ?? ""),
      label: row.label,
    });
  }
  return out;
}

/**
 * The served path of a file in `dist/` (`build.format: "file"`).
 *
 * @param {string} relative
 */
function servedPath(relative) {
  const bare = relative.split(path.sep).join("/").replace(/\.html$/u, "").replace(/(^|\/)index$/u, "");
  return `/${bare}`;
}

/** @param {string} dir */
async function newestMtime(dir) {
  let newest = 0;
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.parentPath.startsWith(MODE_SOURCES)) continue;
    const { mtimeMs } = await stat(path.join(entry.parentPath, entry.name));
    newest = Math.max(newest, mtimeMs);
  }
  return newest;
}

/** @param {string} text */
function clip(text) {
  const flat = text.replace(/[\s\p{Cf}]+/gu, " ").trim();
  return flat.length > SNIPPET ? `${flat.slice(0, SNIPPET - 1)}…` : flat;
}

/**
 * The original text between two units of the flattened page.
 *
 * @param {{ text: string }[]} nodes
 * @param {import("../src/comment-mode/match.ts").PageText} page
 * @param {number} from
 * @param {number} to
 */
function originalText(nodes, page, from, to) {
  const first = page.node[from];
  const last = page.node[to - 1];
  if (first === last) return nodes[first].text.slice(page.start[from], page.end[to - 1]);
  let text = nodes[first].text.slice(page.start[from]);
  for (let n = first + 1; n < last; n++) text += ` ${nodes[n].text}`;
  return `${text} ${nodes[last].text.slice(0, page.end[to - 1])}`;
}

/**
 * @param {string} urlPath
 * @param {string} html
 * @param {Map<string, import("../src/comment-mode/match.ts").Corpus<CoverageField>>} corpora
 * @param {Map<string, CoverageField[]>} fields
 */
function analysePage(urlPath, html, corpora, fields) {
  const doc = readHtmlText(html);
  if (doc.htmlClass.split(/\s+/u).includes("legal-doc-root")) return null;
  const locale = doc.lang.slice(0, 2).toLowerCase();
  const corpus = corpora.get(locale);
  if (!corpus) return null;

  const ownScope = pathScope(urlPath, { notFound: doc.bodyClass.split(/\s+/u).includes("page-404") });
  const page = readPage(doc.nodes);
  const occurrences = findOccurrences(corpus, page, { ownScope });

  const covered = new Uint8Array(page.text.length);
  /** @type {Map<string, "matched" | "ambiguous">} */
  const tappable = new Map();
  /** @typedef {Map<string, { snippet: string, keys: string[], count: number }>} Groups */
  /** @type {Groups} */
  const ambiguous = new Map();
  /** One-word spans no own field holds and several fields share: a tap explains, offers nothing. */
  /** @type {Groups} */
  const unclaimed = new Map();
  /**
   * Taps that open one field of another scope with no choice: the notice block, the vault, a
   * concert title in the menu, or chrome that spells a desk value and wants `data-desk="none"`.
   * @type {Groups}
   */
  const foreign = new Map();
  /** Per own field, the spans that open it alone: more than one is a field printed twice, or chrome spelling it. */
  /** @type {Groups} */
  const repeated = new Map();
  /** Choosers among the page's own fields, which no ranking by page can settle. */
  let ownTies = 0;
  let unclaimedCount = 0;
  /**
   * @param {Groups} groups
   * @param {(typeof occurrences)[number]} occurrence
   * @param {CoverageField[]} list
   */
  const group = (groups, occurrence, list) => {
    const keys = list.map((field) => field.key);
    const id = keys.join(" ");
    const entry = groups.get(id);
    if (entry) entry.count += 1;
    else {
      const snippet = clip(originalText(doc.nodes, page, occurrence.from, occurrence.to));
      groups.set(id, { snippet, keys, count: 1 });
    }
  };
  for (const occurrence of occurrences) {
    covered.fill(1, occurrence.from, occurrence.to);
    if (occurrence.candidates.length === 0) {
      unclaimedCount += 1;
      group(unclaimed, occurrence, [...occurrence.fields]);
      continue;
    }
    const unique = occurrence.candidates.length === 1;
    if (unique) {
      const [field] = occurrence.candidates;
      if (field.scope !== ownScope) group(foreign, occurrence, [field]);
      else {
        const repeat = repeated.get(field.key);
        if (repeat) repeat.count += 1;
        else {
          const snippet = clip(originalText(doc.nodes, page, occurrence.from, occurrence.to));
          repeated.set(field.key, { snippet, keys: [field.key], count: 1 });
        }
      }
    }
    for (const field of occurrence.candidates) {
      if (unique) tappable.set(field.key, "matched");
      else if (!tappable.has(field.key)) tappable.set(field.key, "ambiguous");
    }
    if (!unique) {
      if (occurrence.candidates[0].scope === ownScope) ownTies += 1;
      group(ambiguous, occurrence, [...occurrence.candidates]);
    }
  }

  const outsideDesk = doc.outside.map(normalizeText).join(NUL);
  const hidden = doc.hidden.map(normalizeText).join(NUL);
  const scripted = doc.scripted.map(normalizeText).join(NUL);
  /** @type {Record<Absence, CoverageField[]>} */
  const absent = { inside: [], outside: [], hidden: [], scripted: [], short: [], missing: [] };
  let ownMatched = 0;
  let ownAmbiguous = 0;
  const own = ownScope ? (fields.get(locale) ?? []).filter((field) => field.scope === ownScope) : [];
  for (const field of own) {
    const status = tappable.get(field.key);
    if (status === "matched") ownMatched += 1;
    else if (status === "ambiguous") ownAmbiguous += 1;
    else {
      const pattern = fieldPattern(field);
      const inText = (/** @type {string} */ text) => pattern?.pieces.every((piece) => text.includes(piece));
      if (!pattern) absent.short.push(field);
      else if (isOnPage(page, field)) absent.inside.push(field);
      else if (inText(outsideDesk)) absent.outside.push(field);
      else if (inText(hidden)) absent.hidden.push(field);
      else if (inText(scripted)) absent.scripted.push(field);
      else absent.missing.push(field);
    }
  }

  /** @type {{ id: string, snippet: string }[]} */
  const uncovered = [];
  for (let i = 0; i < page.text.length; ) {
    if (covered[i]) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < page.text.length && !covered[j] && !(page.flags[j] & BREAK)) j += 1;
    if (j - i >= UNCOVERED_MIN) {
      uncovered.push({ id: page.text.slice(i, j), snippet: clip(originalText(doc.nodes, page, i, j)) });
    }
    i = j;
  }

  const coveredCount = covered.reduce((sum, unit) => sum + unit, 0);
  return {
    urlPath,
    locale,
    ownScope,
    share: page.text.length ? coveredCount / page.text.length : 0,
    occurrences: occurrences.length,
    ambiguousCount: occurrences.filter((occurrence) => occurrence.candidates.length > 1).length,
    ownTies,
    ambiguous: [...ambiguous.values()],
    unclaimedCount,
    unclaimed: [...unclaimed.values()],
    own: own.length,
    ownMatched,
    ownAmbiguous,
    absent,
    uncovered,
    tappedKeys: [...tappable.keys()],
    foreign: [...foreign.values()],
    repeated: [...repeated.values()].filter((entry) => entry.count > 1),
  };
}

/** @param {CoverageField} field */
function describe(field) {
  const printed = field.value || field.fallback_value;
  const untranslated = field.value ? "" : " [untranslated]";
  return `${field.key}${untranslated} — ${clip(printed)}`;
}

/**
 * @param {string} text
 * @param {number} width
 */
const pad = (text, width) => (text.length >= width ? `${text} ` : text.padEnd(width));

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(DIST)) throw new Error("[copy:coverage] dist/ is missing: run `npm run build` first.");

  const builtAt = (await stat(path.join(DIST, "index.html"))).mtimeMs;
  const editedAt = await newestMtime(SOURCES);
  const payload = await extractToFile({ quiet: true });
  const fields = fieldsByLocale(payload.segments);
  const corpora = new Map(
    [...fields].map(([locale, list]) => [locale, compileCorpus(list)]),
  );

  const files = (await readdir(DIST, { recursive: true }))
    .filter((file) => file.endsWith(".html") && !existsSync(path.join(PUBLIC, file)))
    .sort((a, b) => servedPath(a).localeCompare(servedPath(b)));

  /** @type {NonNullable<ReturnType<typeof analysePage>>[]} */
  const pages = [];
  /** @type {string[]} */
  const outside = [];
  for (const file of files) {
    const result = analysePage(servedPath(file), await readFile(path.join(DIST, file), "utf8"), corpora, fields);
    if (result) pages.push(result);
    else outside.push(servedPath(file));
  }

  const out = [];
  out.push(`copy:coverage — ${pages.length} pages of dist/, ${payload.stats.keys} keys`);
  if (editedAt > builtAt) out.push("WARNING: src/ changed after the last build; run `npm run build` first.");
  out.push(`Not covered (the mode never loads there): ${outside.join(", ")}`);
  out.push("");
  out.push(
    "text% = share of the page's body text inside a matched field · occ/amb/one = occurrences, of " +
      "which open a chooser / are one shared word a tap only explains · own = the page's own scope: " +
      "tappable / chooser / inside / outside / hidden / scripted / short / missing · loose = uncovered stretches",
  );
  out.push("");
  out.push(
    `${pad("page", 34)}${pad("loc", 4)}${pad("scope", 30)}${pad("text%", 7)}${pad("occ", 5)}${pad("amb", 5)}` +
      `${pad("one", 5)}${pad("own", 30)}loose`,
  );
  for (const page of pages) {
    const ownCell = page.ownScope
      ? `${page.own}: ${page.ownMatched}/${page.ownAmbiguous}/${ABSENCES.map((a) => page.absent[a].length).join("/")}`
      : "—";
    out.push(
      `${pad(page.urlPath, 34)}${pad(page.locale, 4)}${pad(page.ownScope ?? "—", 30)}` +
        `${pad(`${Math.round(page.share * 100)}`, 7)}${pad(String(page.occurrences), 5)}` +
        `${pad(String(page.ambiguousCount), 5)}${pad(String(page.unclaimedCount), 5)}` +
        `${pad(ownCell, 30)}${page.uncovered.length}`,
    );
  }

  /** @type {Map<string, Map<string, { snippet: string, pages: number }>>} */
  const chrome = new Map();
  for (const locale of SITE_LOCALES) {
    const ofLocale = pages.filter((page) => page.locale === locale);
    /** @type {Map<string, { snippet: string, pages: number }>} */
    const seen = new Map();
    for (const page of ofLocale) {
      for (const run of new Map(page.uncovered.map((r) => [r.id, r])).values()) {
        const entry = seen.get(run.id);
        if (entry) entry.pages += 1;
        else seen.set(run.id, { snippet: run.snippet, pages: 1 });
      }
    }
    const threshold = ofLocale.length * CHROME_SHARE;
    chrome.set(locale, new Map([...seen].filter(([, entry]) => entry.pages > threshold)));
  }

  out.push("");
  for (const locale of SITE_LOCALES) {
    const tapped = new Set(pages.filter((p) => p.locale === locale).flatMap((p) => p.tappedKeys));
    const total = fields.get(locale)?.length ?? 0;
    out.push(`${locale}: ${tapped.size} of ${total} fields tappable on at least one page.`);
  }

  if (!options.summary) {
    const selected = pages.filter(
      (page) => (!options.locale || page.locale === options.locale) && (!options.page || page.urlPath === options.page),
    );
    for (const page of selected) {
      const sharedRuns = chrome.get(page.locale) ?? new Map();
      const loose = page.uncovered.filter((run) => !sharedRuns.has(run.id));
      const lines = [];
      /** @param {{ snippet: string, keys: string[], count: number }} entry */
      const groupLine = (entry) => {
        const keys = entry.keys.length > 4 ? [...entry.keys.slice(0, 4), `+${entry.keys.length - 4}`] : entry.keys;
        const times = entry.count > 1 ? ` ×${entry.count}` : "";
        return `    «${entry.snippet}»${times} → ${keys.join(" · ")}`;
      };
      if (page.ambiguous.length > 0) {
        const others = page.ambiguousCount - page.ownTies;
        lines.push(`  chooser (${page.ambiguousCount}: ${page.ownTies} among own fields, ${others} from other scopes):`);
        for (const entry of page.ambiguous) lines.push(groupLine(entry));
      }
      if (page.unclaimed.length > 0) {
        lines.push(`  one shared word, explained (${page.unclaimedCount}):`);
        for (const entry of page.unclaimed) lines.push(groupLine(entry));
      }
      for (const absence of ["missing", "inside", "outside", "scripted"]) {
        const list = page.absent[/** @type {Absence} */ (absence)];
        if (list.length === 0) continue;
        lines.push(`  own, ${absence} (${list.length}):`);
        for (const field of list) lines.push(`    ${describe(field)}`);
      }
      if (options.loose && loose.length > 0) {
        lines.push(`  loose text (${loose.length}):`);
        for (const run of loose) lines.push(`    «${run.snippet}»`);
      }
      if (lines.length === 0) continue;
      out.push("", `== ${page.urlPath} (${page.locale}, ${page.ownScope ?? "no scope of its own"})`, ...lines);
    }
    for (const [locale, runs] of chrome) {
      if (options.locale && options.locale !== locale) continue;
      if (runs.size === 0) continue;
      out.push("", `== chrome (${locale}): loose text on most pages`);
      for (const entry of runs.values()) out.push(`    «${entry.snippet}» (${entry.pages} pages)`);
    }
  }

  if (options.suspects) {
    /** @param {string[]} paths */
    const where = (paths) => (paths.length > 3 ? `${paths.slice(0, 3).join(", ")} +${paths.length - 3}` : paths.join(", "));
    for (const locale of SITE_LOCALES) {
      if (options.locale && options.locale !== locale) continue;
      const ofLocale = pages.filter((page) => page.locale === locale && (!options.page || page.urlPath === options.page));
      /** @type {Map<string, { snippet: string, paths: string[] }>} */
      const foreign = new Map();
      for (const page of ofLocale) {
        for (const entry of page.foreign) {
          const seen = foreign.get(entry.keys[0]);
          if (seen) seen.paths.push(page.urlPath);
          else foreign.set(entry.keys[0], { snippet: entry.snippet, paths: [page.urlPath] });
        }
      }
      const repeated = ofLocale.flatMap((page) => page.repeated.map((entry) => ({ ...entry, path: page.urlPath })));
      out.push("", `== suspects (${locale}): one field of another scope, no choice (${foreign.size})`);
      for (const [key, entry] of [...foreign].sort((a, b) => b[1].paths.length - a[1].paths.length)) {
        out.push(`    «${entry.snippet}» → ${key} (${entry.paths.length}: ${where(entry.paths)})`);
      }
      out.push("", `== suspects (${locale}): an own field more than one span opens (${repeated.length})`);
      for (const entry of repeated) out.push(`    ${entry.path}: «${entry.snippet}» ×${entry.count} → ${entry.keys[0]}`);
    }
  }

  console.log(out.join("\n"));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
