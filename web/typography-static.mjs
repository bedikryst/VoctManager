// @ts-check
/**
 * @file typography-static.mjs
 * @description Build integration that runs the micro-typography pass (src/lib/typoHtml) over
 *  every HTML file in the finished build, and reports what it was not allowed to touch.
 *
 *  It, not the middleware, is what guarantees the shipped artifact. Two kinds of page reach dist/
 *  and only one of them is rendered by Astro: `public/polityka-prywatnosci.html` is a hand-authored
 *  document that is COPIED, so no route, no middleware and no component ever sees it — it would
 *  have been the one page on the site still breaking lines after a one-letter preposition. Running
 *  over the whole directory covers both origins with one rule and needs no list to keep in sync.
 *
 *  Safe to apply to output the middleware already passed in dev: every rule only swaps a breakable
 *  space for an unbreakable one, and none of them match what they have already produced.
 *
 *  The second half is the standing audit. `<astro-island>` subtrees are skipped by the pass on
 *  purpose (rewriting text React is about to hydrate desynchronises the two renders), so their
 *  copy has to pin itself where it is written — `nbsp()` / `typoFor()` from src/lib/typo.ts. This
 *  runs the rules over those subtrees anyway and WARNS with what would have changed, so a line
 *  breaking badly inside an island shows up in the build instead of on the live site. It does not
 *  fail the build: an island warning is a copy job, not a broken artifact.
 * @architecture Astro islands 2026
 * @module build/typography-static
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectLocale, typographyHtml } from "./src/lib/typoHtml.ts";

/**
 * @param {string} dir
 * @returns {Promise<string[]>} absolute paths of every .html file below `dir`
 */
async function walkHtml(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walkHtml(full)));
    else if (entry.isFile() && entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

/** Island subtrees, whose text the pass leaves to the components themselves.
 * @param {string} html
 * @returns {string[]} */
function islandFragments(html) {
  /** @type {string[]} */
  const fragments = [];
  const open = /<astro-island\b[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    const end = html.indexOf("</astro-island", m.index);
    fragments.push(html.slice(m.index + m[0].length, end === -1 ? html.length : end));
  }
  return fragments;
}

/**
 * Where `before` and `after` part company, as readable one-line samples.
 *
 * A whitespace RUN is one unit on both sides: the pass renders it as exactly one character, which
 * is a plain space when nothing was pinned there and a no-break space when something was. Walking
 * character by character instead would desynchronise on the very first multi-space run and then
 * report phantom spots for the rest of the page.
 * @param {string} before
 * @param {string} after
 * @returns {string[]}
 */
function differences(before, after) {
  /** @type {string[]} */
  const samples = [];
  /** @param {number} at */
  const sample = (at) =>
    `${before.slice(Math.max(0, at - 34), at).replace(/\s+/g, " ")}·${before
      .slice(at + 1, at + 26)
      .replace(/\s+/g, " ")}`.trim();

  /** @param {string} s @param {number} from @param {RegExp} re */
  const runLength = (s, from, re) => {
    let n = 0;
    while (from + n < s.length && re.test(s[from + n])) n += 1;
    return n;
  };

  let a = 0;
  let b = 0;
  while (a < before.length && b < after.length && samples.length < 60) {
    const runA = runLength(before, a, /[ \t\r\n]/);
    const runB = runLength(after, b, /[ \u00a0\u202f\t\r\n]/);
    if (runA > 0 && runB > 0) {
      // Both sides hold the same gap. It is a finding only if the pass pinned it; an untouched
      // multi-space run has to be consumed on BOTH sides or everything after it reads as a defect.
      if (/[\u00a0\u202f]/.test(after.slice(b, b + runB))) samples.push(sample(a));
      a += runA;
      b += runB;
      continue;
    }
    if (before[a] === after[b]) {
      a += 1;
      b += 1;
      continue;
    }
    // Nothing consumed on the left: a character was inserted (a thin space, a word joiner).
    samples.push(sample(a));
    b += 1;
  }
  return samples;
}

/** @returns {import("astro").AstroIntegration} */
export function staticTypography() {
  return {
    name: "voct:typography",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const files = await walkHtml(outDir);
        let touched = 0;
        /** @type {Map<string, string[]>} */
        const islandSpots = new Map();

        for (const file of files) {
          const html = await readFile(file, "utf8");
          const locale = detectLocale(html);
          const next = typographyHtml(html, locale);
          if (next !== html) {
            await writeFile(file, next, "utf8");
            touched += 1;
          }

          // Judged in the PAGE's locale, which it did not use to be: island copy was the Polish
          // original on every page until the donation vault was translated, and reading a French
          // paragraph under the Polish one-letter-word rule flags every correct sentence in it.
          // The reverse is now the useful signal — an island still SSR-ing Polish onto a foreign
          // page shows up here as a run of spots no rule of that language should have found.
          /** @type {string[]} */
          const spots = [];
          for (const fragment of islandFragments(next)) {
            const fixed = typographyHtml(fragment, locale);
            if (fixed !== fragment) spots.push(...differences(fragment, fixed));
          }
          if (spots.length > 0) islandSpots.set(path.relative(outDir, file), [...new Set(spots)]);
        }

        logger.info(
          touched === 0
            ? `all ${files.length} pages already carry their pinned spaces`
            : `pinned line breaks in ${touched}/${files.length} pages`,
        );

        if (islandSpots.size === 0) return;
        const total = [...islandSpots.values()].reduce((n, s) => n + s.length, 0);
        logger.warn(
          `${total} spot(s) inside React islands still break badly — the HTML pass cannot touch ` +
            `island markup (hydration), so pin these in the component with nbsp():`,
        );
        for (const [file, spots] of islandSpots) {
          logger.warn(`  ${file}`);
          for (const spot of spots.slice(0, 8)) logger.warn(`    · ${spot}`);
          if (spots.length > 8) logger.warn(`    (+${spots.length - 8} more)`);
        }
      },
    },
  };
}
