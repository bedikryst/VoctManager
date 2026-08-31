/**
 * @file check-literal-colours.mjs
 * @description The dark-mode guardrail that eslint cannot be: a colour written
 * as a literal reaches no theme, and nothing in the type system or the compiled
 * stylesheet says so. Four rules, run over `src/` on every `npm run lint`.
 *
 * Two of them exist because Stage 5 of the dark-mode work proved an inventory
 * built from literals cannot see a defect written in tokens: fifteen modal
 * scrims were `bg-ethereal-ink/4x`, correct-looking on light and a WHITE veil
 * over the dialog on dark, and no grep for `white`/`black` would ever have
 * found them (rule 3). The other pair is the arbitrary bracket value, where a
 * raw `rgba()` sits inside a class the token swap never reaches (rule 4).
 *
 * The rules encode what the spec settled, so most correct code needs no entry
 * in the allowlist at all:
 *  · a full-viewport veil IS black — the absence of light, on both themes;
 *  · a cast written `rgba(0,0,0,…)` lands inside a surface-inverse island,
 *    which is dark under both themes (a cast onto the PAGE is warm here, and
 *    warm casts are variables since Stage 5);
 *  · a gold or incense literal is an ACCENT, and an accent holds its hue.
 * Anything else is a decision, and a decision belongs in the allowlist beside
 * its reason.
 *
 * A stale allowlist entry is an error too. An allowlist nobody prunes stops
 * being a record of decisions and becomes a list of things that used to be true.
 *
 * Usage: node scripts/check-literal-colours.mjs   (exit 1 on any finding)
 * @module scripts/check-literal-colours
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const ALLOWLIST = join(ROOT, "scripts", "literal-colours.allow.json");

/** Tailwind utility prefixes that take a colour. */
const COLOUR_PREFIX = "(?:bg|text|border|ring|fill|stroke|divide|from|via|to)";

/**
 * A veil is recognised by its geometry, not by its file: `inset-0` is what
 * separates "the absence of light over the whole screen" from a black chip
 * somebody typed. The two routinely sit on different lines of the same `cn()`,
 * so the search runs back to the opening `className` rather than over a fixed
 * window of lines — a comment between the geometry and the fill is normal, and
 * a fixed window would read one as the other's absence.
 */
const CLASSNAME_SCOPE = 14;
const isVeil = (lines, index) => {
  for (let cursor = index; cursor >= Math.max(0, index - CLASSNAME_SCOPE); cursor -= 1) {
    if (/\binset-0\b/.test(lines[cursor])) return true;
    if (/className\s*=/.test(lines[cursor])) return false;
  }
  return false;
};

/** The two literal families the palette deliberately keeps — see the header. */
const ACCENT_LITERAL = /rgba?\(\s*(?:194,\s*168,\s*120|166,\s*146,\s*121)\b/;
const INVERSE_ISLAND_CAST = /rgba?\(\s*0,\s*0,\s*0\b/;

const RULES = [
  {
    id: "white-literal",
    // No geometric exception: every legitimate one is paper (the score canvas,
    // a printable page, a QR quiet zone) or a specular mark on an accent fill,
    // and each of those is a decision with a name.
    pattern: new RegExp(`\\b${COLOUR_PREFIX}-white(?:/[0-9.]+)?\\b`, "g"),
    verdict: () => "allowlist",
    hint: "a white literal reaches no theme — use a ladder rung, or `ink-on-inverse` if it is ink on a surface that stays dark",
  },
  {
    id: "black-literal",
    pattern: new RegExp(`\\b${COLOUR_PREFIX}-black(?:/[0-9.]+)?\\b`, "g"),
    verdict: (lines, index) => (isVeil(lines, index) ? "ok" : "allowlist"),
    hint: "black is the scrim colour and nothing else — a full-viewport veil (`inset-0`) passes on its own",
  },
  {
    id: "veil-in-a-rung",
    // The inverse of rule 2, and the one the spec's own inventory missed: a
    // veil painted in one of the two rungs that are DARK on light and light on
    // dark inverts into a sheet brighter than the dialog standing on it. Never
    // allowlisted — there is no correct case. The surface rungs are absent on
    // purpose: an inset `bg-ethereal-alabaster/60` over a map that has not
    // loaded is the card's own colour, and it follows the ladder correctly.
    pattern: /\bbg-ethereal-(?:ink|graphite)\/[0-9.]+/g,
    verdict: (lines, index) => (isVeil(lines, index) ? "error" : "ok"),
    hint: "a full-viewport veil is `bg-black/2x…/8x`; these two rungs invert into a pale sheet on the dark theme",
  },
  {
    id: "raw-literal-in-brackets",
    pattern:
      /\b(?:shadow|drop-shadow|text-shadow|bg)-\[[^\]]*(?:rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})[^\]]*\]/g,
    verdict: (_lines, _index, match) =>
      ACCENT_LITERAL.test(match) || INVERSE_ISLAND_CAST.test(match)
        ? "ok"
        : "allowlist",
    hint: "an arbitrary value is compiled with its colour baked in — use `--glass-*` / `--aura-*` for anything cast on the PAGE",
  },
];

const walk = async (dir) => {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else if (
      /\.tsx?$/.test(entry.name) &&
      // A test asserting on a literal is quoting the stylesheet, not painting
      // with it — `fieldShell.test.ts` pins the light theme's own inset.
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      files.push(path);
    }
  }
  return files;
};

const main = async () => {
  const allowlist = JSON.parse(await readFile(ALLOWLIST, "utf8"));
  const seen = new Map(); // "path::match" → true, for the staleness check
  const findings = [];

  for (const file of await walk(SRC)) {
    const key = relative(SRC, file).split(sep).join("/");
    const allowed = new Set(allowlist.files?.[key]?.allow ?? []);
    const lines = (await readFile(file, "utf8")).split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const rule of RULES) {
        for (const [match] of line.matchAll(rule.pattern)) {
          const verdict = rule.verdict(lines, index, match);
          if (verdict === "ok") continue;
          if (verdict === "allowlist" && allowed.has(match)) {
            seen.set(`${key}::${match}`, true);
            continue;
          }
          findings.push({
            where: `src/${key}:${index + 1}`,
            match,
            rule: rule.id,
            hint: rule.hint,
            fatal: verdict === "error",
          });
        }
      }
    });
  }

  const stale = [];
  for (const [key, entry] of Object.entries(allowlist.files ?? {})) {
    for (const match of entry.allow ?? []) {
      if (!seen.has(`${key}::${match}`)) stale.push(`src/${key} → ${match}`);
    }
  }

  if (findings.length === 0 && stale.length === 0) {
    console.log("literal-colour guard: clean");
    return;
  }

  for (const finding of findings) {
    console.error(
      `${finding.where}\n  ${finding.match}  [${finding.rule}]\n  ${finding.hint}${
        finding.fatal ? "" : "\n  If it is correct on BOTH themes, add it to scripts/literal-colours.allow.json with a reason."
      }`,
    );
  }
  if (stale.length > 0) {
    console.error(
      `\nStale allowlist entries — the code no longer has these, so drop them:\n  ${stale.join("\n  ")}`,
    );
  }
  process.exitCode = 1;
};

await main();
