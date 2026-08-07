// @ts-check
/**
 * @file audit.test.mjs
 * @description Proof that the audit fires. A conformance gate that reports "clean" is worth
 *  exactly as much as its evidence that it would have said otherwise, so every check here is
 *  aimed at the defect it was written for, reconstructed in the shape it actually shipped in:
 *  `.path-entry-title`'s lost hover, `/koncerty`'s inert register, `/press`'s 380 against a
 *  declared 300, the ACT I comment that swallowed a rule, `--wght` registered twice.
 *
 *  Fixtures compose the REAL `styles/registers.css` with a synthetic page sheet, so a test also
 *  fails when the register language is edited into a shape the audit no longer reads correctly —
 *  which is the failure mode a hand-written stub would hide.
 *
 *  Run: `npm run test:audit` (node --test).
 * @architecture Astro islands 2026
 * @module audit/audit.test
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkVeilDelta } from "./assets.mjs";
import {
  checkCuePurity,
  checkPinnedRegisterValues,
  checkPressRestWeight,
  checkPropertyRegistrations,
  checkRegisterShorthands,
  checkSettleCeiling,
  checkSwallowedRules,
  checkTransitionCollisions,
  checkUngatedHiddenState,
  indexRules,
} from "./checks.mjs";
import { rulesFromCss, scanHtml, specificity } from "./collect.mjs";

const WEB_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const REGISTERS = await readFile(path.join(WEB_ROOT, "src/styles/registers.css"), "utf8");

/**
 * One page, styled by the real register sheet plus whatever the test is arguing about.
 * @param {string} body  Markup inside `<body>`.
 * @param {string} pageCss
 */
function fixture(body, pageCss) {
  const rules = [...rulesFromCss(REGISTERS, "registers.css"), ...rulesFromCss(pageCss, "page.css")];
  return {
    rules,
    index: indexRules(rules),
    pages: [{ page: "fixture.html", elements: scanHtml(`<html><body>${body}</body></html>`) }],
  };
}

/** @param {import("./checks.mjs").Finding[]} findings */
const ids = (findings) => findings.map((finding) => finding.id);

/* ── the register language still parses the way the audit assumes ────────────── */

test("registers.css is read as the register's own, not as page rules", () => {
  const { pages, index } = fixture(
    `<h2 class="reveal ink-press">Florent de Bazelaire</h2>`,
    "/* no page rules at all */ .unrelated { color: red }",
  );
  assert.deepEqual(ids(checkTransitionCollisions(pages, index)), []);
  assert.deepEqual(ids(checkPinnedRegisterValues(pages, index)), []);
  assert.deepEqual(ids(checkRegisterShorthands(pages, index)), []);
});

test("specificity follows the rules that decide these contests", () => {
  assert.deepEqual(specificity("html.voct-motion .reveal"), [0, 2, 1]);
  assert.deepEqual(specificity(".intro[data-astro-cid-x] .rep-row[data-astro-cid-x]"), [0, 4, 0]);
  // `:is()` takes its most specific argument, `:where()` takes nothing.
  assert.deepEqual(specificity(":is(.a.b, .c)"), [0, 2, 0]);
  assert.deepEqual(specificity(":where(.a.b)"), [0, 0, 0]);
  assert.deepEqual(specificity("html.voct-motion :is(.is-in.ink-press, .is-in .ink-press)"), [0, 3, 1]);
});

/* ── R3 · the transition collision, both directions ──────────────────────────── */

test("R3 catches a register replacing an element's own hover transition", () => {
  // `.path-entry-title` lost its weight-and-tracking hover for a month exactly this way.
  const { pages, index } = fixture(
    `<div class="path-entry"><a class="path-entry-title reveal">Wcielenie</a></div>`,
    `.path-entry-title:hover { transition: font-weight .3s, letter-spacing .3s; font-weight: 400 }`,
  );
  const findings = checkTransitionCollisions(pages, index);
  assert.deepEqual(ids(findings), ["R3"]);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].title, /register replaces this element's own transition/);
  assert.ok(findings[0].detail.some((line) => /snaps/.test(line)));
});

test("R3 catches a page rule replacing the register's transition", () => {
  const { pages, index } = fixture(
    `<ul class="rep-list"><li class="rep-col"><li class="rep-row reveal">Kyrie</li></li></ul>`,
    `.rep-list .rep-col .rep-row { transition: color .3s }`,
  );
  const findings = checkTransitionCollisions(pages, index);
  assert.deepEqual(ids(findings), ["R3"]);
  assert.match(findings[0].title, /A page rule replaces/);
});

test("R3 reports an equal-specificity tie as bundle order, not as a winner", () => {
  const { pages, index } = fixture(
    `<p class="lede reveal">tacet.</p>`,
    `html.voct-motion .lede { transition: color .3s }`,
  );
  const findings = checkTransitionCollisions(pages, index);
  assert.deepEqual(ids(findings), ["R3"]);
  assert.equal(findings[0].level, "warn");
  assert.match(findings[0].title, /bundle order decides/);
});

test("R3 accepts the documented fix: the element restates both lists as longhands", () => {
  const { pages, index } = fixture(
    `<div class="path-entry"><a class="path-entry-title reveal">Wcielenie</a></div>`,
    `.path-entry .path-entry-title:hover {
       transition-property: opacity, font-weight;
       transition-duration: var(--ink-in);
     }`,
  );
  assert.deepEqual(ids(checkTransitionCollisions(pages, index)), []);
});

test("R3 does not flag a reduced-motion opt-out", () => {
  const { pages, index } = fixture(
    `<p class="lede reveal">tacet.</p>`,
    `@media (prefers-reduced-motion: reduce) { .lede { transition: none } }`,
  );
  assert.deepEqual(ids(checkTransitionCollisions(pages, index)), []);
});

/* ── R4 · a page rule pinning the animated value ─────────────────────────────── */

test("R4 catches Astro's scoping attribute out-specifying the register", () => {
  // `/koncerty`: a resting dim written as `opacity` left the register observed, flipped, settled
  // and motionless. The fix is `filter: opacity()`, which composes instead of replacing.
  const { pages, index } = fixture(
    `<section class="station station--memoriam" data-astro-cid-abc>
       <img class="station-poster reveal" data-astro-cid-abc>
     </section>`,
    `.station--memoriam[data-astro-cid-abc] .station-poster[data-astro-cid-abc] { opacity: .8 }`,
  );
  const findings = checkPinnedRegisterValues(pages, index);
  assert.deepEqual(ids(findings), ["R4"]);
  assert.equal(findings[0].level, "error");
  assert.ok(findings[0].detail.some((line) => /scoping attribute/.test(line)));
  assert.match(findings[0].hint ?? "", /filter: opacity\(\)/);
});

test("R4 accepts `filter: opacity()`, which composes with the register", () => {
  const { pages, index } = fixture(
    `<section class="station station--memoriam" data-astro-cid-abc>
       <img class="station-poster reveal" data-astro-cid-abc>
     </section>`,
    `.station--memoriam[data-astro-cid-abc] .station-poster[data-astro-cid-abc] { filter: opacity(.8) }`,
  );
  assert.deepEqual(ids(checkPinnedRegisterValues(pages, index)), []);
});

/* ── R5 · a cue wearing a register ───────────────────────────────────────────── */

test("R5 catches a cue node that also wears a register", () => {
  const { pages } = fixture(`<section class="director-dark reveal-cue reveal"></section>`, "");
  const findings = checkCuePurity(pages);
  assert.deepEqual(ids(findings), ["R5"]);
  assert.match(findings[0].title, /also wears reveal/);
});

test("R5 leaves a bare cue alone", () => {
  const { pages } = fixture(`<section class="director-dark reveal-cue"></section>`, "");
  assert.deepEqual(ids(checkCuePurity(pages)), []);
});

/* ── R6 · the press's resting weight ─────────────────────────────────────────── */

test("R6 catches a press resting off --wght-rest", () => {
  // `/press` declared 300 everywhere and ended its keyframes at 380 for months. With motion on,
  // the axis hides the gap completely.
  const { pages, index } = fixture(
    `<h1 class="press-title ink-press">Materiały</h1>`,
    `.press-title { font-weight: 380 }`,
  );
  const findings = checkPressRestWeight(pages, index, 300);
  assert.deepEqual(ids(findings), ["R6"]);
  assert.match(findings[0].title, /rests at font-weight 380/);
});

test("R6 accepts a press declared at the token", () => {
  const { pages, index } = fixture(
    `<h1 class="press-title ink-press">Materiały</h1>`,
    `.press-title { font-weight: var(--wght-rest) }`,
  );
  assert.deepEqual(ids(checkPressRestWeight(pages, index, 300)), []);
});

/* ── R9 · a bare shorthand on a two-dimension node ───────────────────────────── */

test("R9 catches a shorthand replacing one of two register dimensions", () => {
  const { pages, index } = fixture(
    `<h2 class="section-title reveal ink-press">Sacrum nie zdobi.</h2>`,
    `html.voct-motion .section-title.reveal { transition: opacity .9s }`,
  );
  const findings = checkRegisterShorthands(pages, index);
  assert.deepEqual(ids(findings), ["R9"]);
  assert.match(findings[0].detail.join(" "), /--wght/);
});

/* ── R1 · R2 · R7 · R8 · R10, the checks that read something other than a page ── */

test("R1 catches a comment that swallowed a rule, and spares quoted CSS in prose", () => {
  const swallowed = checkSwallowedRules([{
    file: "styles/landing/06-footer.css",
    line: 100,
    text: " ACT I — the running head\n.site-footer-head {\n  text-align: center;\n}",
  }]);
  assert.deepEqual(ids(swallowed), ["R1"]);

  const prose = checkSwallowedRules([{
    file: "docs-in-css.css",
    line: 10,
    text: " The fix for a resting dim is `.station-poster { opacity: .8 }` written as a filter.",
  }]);
  assert.deepEqual(ids(prose), []);
});

test("R2 catches a property registered twice, agreeing descriptors included", () => {
  const findings = checkPropertyRegistrations(new Map([["--wght", [
    { file: "styles/tokens.css", line: 211, descriptors: new Map([["inherits", "true"], ["initial-value", "300"]]) },
    { file: "styles/landing/09-kinetic.css", line: 17, descriptors: new Map([["inherits", "false"], ["initial-value", "580"]]) },
  ]]]));
  assert.deepEqual(ids(findings), ["R2"]);
  assert.match(findings[0].title, /registered 2 times/);
});

test("R7 catches a choreography that outruns the settle ceiling", () => {
  const over = checkSettleCeiling(new Map([["--veil-lift", 3200]]), [{ selector: ".x", file: "a", line: 1, delayMs: 400 }], 3400);
  assert.deepEqual(ids(over), ["R7"]);
  assert.equal(over[0].level, "error");

  const within = checkSettleCeiling(new Map([["--ink-in", 900]]), [], 3400);
  assert.deepEqual(ids(within), []);
});

test("R8 catches a hidden dimension the no-motion gate cannot un-hide", () => {
  const findings = checkUngatedHiddenState(rulesFromCss(
    `.reveal.manifest-line { mask-image: linear-gradient(100deg, #000 0%, transparent 60%) }`,
    "page.css",
  ));
  assert.deepEqual(ids(findings), ["R8"]);
  assert.equal(findings[0].level, "warn");

  const gated = checkUngatedHiddenState(rulesFromCss(
    `html.voct-motion .reveal.manifest-line { mask-image: linear-gradient(100deg, #000 0%, transparent 60%) }`,
    "page.css",
  ));
  assert.deepEqual(ids(gated), []);
});

test("R10 reports a photograph the veil cannot move, and stays advisory", () => {
  const findings = checkVeilDelta([
    { file: "a.jpg", bright: 200, delta: 111 },
    { file: "night.jpg", bright: 20, delta: 7 },
  ]);
  assert.deepEqual(ids(findings), ["R10"]);
  assert.equal(findings[0].level, "info", "a dark photograph is a note, never a build failure");
});
