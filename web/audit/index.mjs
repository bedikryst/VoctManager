// @ts-check
/**
 * @file index.mjs
 * @description The register audit: a build-time conformance gate for the entrance-register
 *  language (`styles/registers.css`, `scripts/reveal.ts`, `docs/web-landing-guardrails.md` §5).
 *
 *  Every rule it enforces was learned by shipping its violation. The register language has one
 *  property that makes it worth a tool at all: it fails SILENTLY. A `transition` shorthand that
 *  replaces another parses and builds. A page rule that out-specifies the register leaves the
 *  node observed, flipped, settled and motionless. A comment that swallows a rule passes
 *  `astro check`. None of it errors, none of it looks wrong in review, and each defect was found
 *  by eye, weeks later, usually by someone hovering something.
 *
 *  It reads the FINISHED BUILD for anything about the cascade, because that is the only place the
 *  contest is real — Astro's `[data-astro-cid-…]` scoping is what decides most of them and it does
 *  not exist in the source. Source is read only for what the build erases: comments, `@property`
 *  registrations and the timing tokens.
 *
 *  Runs as an Astro integration on `astro:build:done`, and standalone (`npm run audit:registers`)
 *  against whatever `dist/` is already there.
 * @architecture Astro islands 2026
 * @module audit/index
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkVeilDelta, measureAssets } from "./assets.mjs";
import {
  checkCuePurity,
  checkPinnedRegisterValues,
  checkPressRestWeight,
  checkPropertyRegistrations,
  checkRegisterShorthands,
  checkScopedRootRules,
  checkSettleCeiling,
  checkSwallowedRules,
  checkTransitionCollisions,
  checkUngatedHiddenState,
  indexRules,
} from "./checks.mjs";
import { collectComments, collectCss, collectPages, collectRegisteredProperties } from "./collect.mjs";

/**
 * The site root, found rather than assumed. Astro bundles `astro.config.mjs` — and the modules it
 * imports — into a temp module before running it, so `import.meta.url` is not this file's path
 * during a build. Deriving the root from it put every source-side read (the timing tokens, the
 * `@property` registrations, the comments, the photographs) on a directory that does not exist,
 * and each of those checks degrades to SILENCE when its input is empty. An audit that reports
 * "clean" because it read nothing is the one failure this tool may never have, so the root is
 * located by a file that must be there, from both plausible starting points.
 */
function findWebRoot() {
  const marker = path.join("src", "styles", "registers.css");
  const starts = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let current = path.resolve(start);
    for (let depth = 0; depth < 6; depth++) {
      if (existsSync(path.join(current, marker))) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error(`register-audit: could not locate the site root (looked for ${marker}).`);
}

const WEB_ROOT = findWebRoot();

/** Register durations worth budgeting against the settle ceiling. */
const DURATION_TOKENS = ["--ink-in", "--rule-in", "--veil-lift"];

/** @typedef {import("./checks.mjs").Finding} Finding */

/** @param {string} value */
function toMilliseconds(value) {
  const match = /^(-?\d*\.?\d+)(ms|s)$/.exec(value.trim());
  if (!match) return null;
  return match[2] === "s" ? Number(match[1]) * 1000 : Number(match[1]);
}

/**
 * The timing tokens and the resting weight, read from source: the build inlines `var()` nowhere,
 * so these values exist only where they are declared.
 */
async function readTokens() {
  const css = await readFile(path.join(WEB_ROOT, "src/styles/tokens.css"), "utf8").catch(() => "");
  /** @type {Map<string, number>} */
  const durations = new Map();
  for (const token of DURATION_TOKENS) {
    const match = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(css);
    const ms = match ? toMilliseconds(match[1]) : null;
    if (ms !== null) durations.set(token, ms);
  }
  const restMatch = /--wght-rest\s*:\s*(\d+)/.exec(css);
  return { durations, restWeight: restMatch ? Number(restMatch[1]) : 300 };
}

/** The ceiling every choreography has to clear, read from the controller that enforces it. */
async function readSettleCeiling() {
  const source = await readFile(path.join(WEB_ROOT, "src/scripts/reveal.ts"), "utf8").catch(() => "");
  const match = /SETTLE_FALLBACK_MS\s*=\s*(\d+)/.exec(source);
  return match ? Number(match[1]) : 3400;
}

/**
 * Authored per-host veil delays, which only the emitted CSS knows in full.
 * @param {import("./collect.mjs").CssRule[]} rules
 */
function readVeilDelays(rules) {
  /** @type {{ selector: string, file: string, line: number, delayMs: number }[]} */
  const delays = [];
  for (const rule of rules) {
    const value = rule.declarations.get("--veil-delay");
    if (value === undefined) continue;
    const ms = toMilliseconds(value);
    if (ms === null) continue;
    delays.push({ selector: rule.selector, file: rule.file, line: rule.line, delayMs: ms });
  }
  return delays;
}

/**
 * @param {string} distDir
 * @returns {Promise<{ findings: Finding[], stats: Record<string, number>, notes: string[] }>}
 */
export async function runRegisterAudit(distDir) {
  const srcStyles = path.join(WEB_ROOT, "src/styles");
  const notes = [];

  const [rules, pages, registrations, comments, tokens, ceiling] = await Promise.all([
    collectCss(distDir, distDir),
    collectPages(distDir, distDir),
    collectRegisteredProperties(srcStyles, WEB_ROOT),
    collectComments(srcStyles, WEB_ROOT),
    readTokens(),
    readSettleCeiling(),
  ]);

  const index = indexRules(rules);
  const veilDelays = readVeilDelays(rules);

  const { measurements, skipped } = await measureAssets(
    path.join(WEB_ROOT, "src/assets/photos"),
    WEB_ROOT,
    path.join(WEB_ROOT, "node_modules/.cache/voct-register-audit"),
  );
  if (skipped) notes.push(skipped);

  // Every check degrades to silence when its input is empty, so an empty input is itself the
  // finding. This is the tripwire for the class of bug that made this audit report "clean" from
  // the wrong directory.
  /** @type {Finding[]} */
  const sanity = [];
  for (const [what, count] of [
    ["stylesheets in the build", rules.length],
    ["pages in the build", pages.length],
    ["comments in src/styles", comments.length],
    ["timing tokens in tokens.css", tokens.durations.size],
  ]) {
    if (count === 0) {
      sanity.push({
        id: "R0",
        level: "error",
        title: `The audit found no ${what} — it is reading the wrong thing, not passing`,
        where: `dist: ${distDir} · src: ${WEB_ROOT}`,
        detail: ["Every check below returns nothing when its input is empty, so this would otherwise read as clean."],
      });
    }
  }

  /** @type {Finding[]} */
  const findings = [
    ...sanity,
    ...checkSwallowedRules(comments),
    ...checkPropertyRegistrations(registrations),
    ...checkTransitionCollisions(pages, index),
    ...checkPinnedRegisterValues(pages, index),
    ...checkCuePurity(pages),
    ...checkPressRestWeight(pages, index, tokens.restWeight),
    ...checkSettleCeiling(tokens.durations, veilDelays, ceiling),
    ...checkUngatedHiddenState(rules),
    ...checkRegisterShorthands(pages, index),
    ...checkScopedRootRules(pages, rules),
    ...checkVeilDelta(measurements),
  ];

  const registerNodes = pages.reduce(
    (total, page) => total + page.elements.filter((element) =>
      [...element.classes].some((name) => /^(reveal|reveal-rule|reveal-rule-v|reveal-light|reveal-cue|ink-press)$/.test(name))).length,
    0,
  );

  return {
    findings,
    notes,
    stats: {
      pages: pages.length,
      rules: rules.length,
      registerNodes,
      photographs: measurements.length,
    },
  };
}

/**
 * @param {Finding[]} findings
 * @param {Record<string, number>} stats
 * @param {string[]} notes
 */
export function formatReport(findings, stats, notes) {
  const lines = [];
  const errors = findings.filter((finding) => finding.level === "error");
  const warnings = findings.filter((finding) => finding.level === "warn");
  const info = findings.filter((finding) => finding.level === "info");

  lines.push(
    `[register-audit] ${stats.registerNodes} register nodes across ${stats.pages} pages, ` +
    `${stats.rules} emitted rules, ${stats.photographs} photographs.`,
  );

  const marker = { error: "✗", warn: "!", info: "·" };
  for (const finding of [...errors, ...warnings, ...info]) {
    lines.push("");
    lines.push(`  ${marker[finding.level]} ${finding.id}  ${finding.title}`);
    lines.push(`      ${finding.where}`);
    for (const detail of finding.detail) lines.push(`      ${detail}`);
    if (finding.hint) lines.push(`      → ${finding.hint}`);
  }

  for (const note of notes) lines.push(`\n  · ${note}`);

  lines.push("");
  lines.push(
    errors.length === 0 && warnings.length === 0
      ? `[register-audit] clean${info.length ? ` (${info.length} note${info.length === 1 ? "" : "s"})` : ""}.`
      : `[register-audit] ${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`,
  );
  return lines.join("\n");
}

/**
 * Astro integration. It runs after the HTML is final — the audit reads the artifact, not the
 * intention — and fails the build on an error, because every error class here is a defect that
 * ships looking correct. `VOCT_AUDIT_SOFT=1` downgrades that to a report for a bisect or a
 * deliberate intermediate state.
 * @returns {import("astro").AstroIntegration}
 */
export function registerAudit() {
  return {
    name: "voct:register-audit",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const { findings, stats, notes } = await runRegisterAudit(fileURLToPath(dir));
        const report = formatReport(findings, stats, notes);
        const errors = findings.filter((finding) => finding.level === "error");

        if (errors.length > 0 && process.env.VOCT_AUDIT_SOFT !== "1") {
          logger.error(report);
          throw new Error(
            `Register audit: ${errors.length} conformance error${errors.length === 1 ? "" : "s"}. ` +
            "Set VOCT_AUDIT_SOFT=1 to build anyway.",
          );
        }
        if (findings.some((finding) => finding.level !== "info")) {
          logger.warn(report);
          return;
        }
        // Notes are standing observations, not build output: printing six dark photographs on
        // every build trains the reader to skip the block that will one day carry an error.
        // `npm run audit:registers` prints them in full.
        const notesCount = findings.length;
        logger.info(
          `${stats.registerNodes} register nodes across ${stats.pages} pages: clean` +
          `${notesCount ? ` (${notesCount} note${notesCount === 1 ? "" : "s"} — npm run audit:registers)` : ""}.`,
        );
      },
    },
  };
}

// Standalone: audit whatever is already built, without paying for a rebuild.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const distDir = path.resolve(process.argv[2] ?? path.join(WEB_ROOT, "dist"));
  const { findings, stats, notes } = await runRegisterAudit(distDir);
  console.log(formatReport(findings, stats, notes));
  if (findings.some((finding) => finding.level === "error")) process.exitCode = 1;
}
