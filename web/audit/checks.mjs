// @ts-check
/**
 * @file checks.mjs
 * @description The conformance checks themselves. Each one exists because the defect it looks
 *  for has already shipped, is invisible in review, and produces no error at any point in the
 *  toolchain — the class of failure `docs/web-landing-guardrails.md` calls silent. Every check
 *  names the section of that file it enforces.
 *
 *  The discriminator that keeps most of these precise is OWNERSHIP: a rule whose key compound
 *  speaks only in register and runtime classes is the register talking about itself, and a rule
 *  naming a page object (`.path-entry-title`, `.station-poster`) is a page talking about a
 *  register node. The first is the language; the second is what collides with it.
 * @architecture Astro islands 2026
 * @module audit/checks
 */

import {
  REGISTER_CLASSES,
  compareSpecificity,
  describeElement,
  formatSpecificity,
  parseSelector,
  registersOn,
  selectorMatches,
  splitTopLevel,
} from "./collect.mjs";

/** The property each register animates on the element itself. The lead register is absent on
 *  purpose: its transition lives on a `::before`, so an element-level declaration cannot replace
 *  it, and the pseudo-element rules are checked in their own right.
 *  @type {Readonly<Record<string, string | undefined>>} */
const REGISTER_PROPERTY = Object.freeze({
  reveal: "opacity",
  "reveal-light": "opacity",
  "ink-press": "--wght",
});

/** Dimensions the no-motion gate does NOT neutralise. `index.astro` un-hides `opacity` and
 *  `transform` for a visitor without JS; anything else declared outside `html.voct-motion`
 *  strands its node at the start value forever. */
const UNGATED_HIDDEN_PROPERTIES = Object.freeze([
  "font-variation-settings",
  "mask-image",
  "mask-position",
  "-webkit-mask-image",
  "-webkit-mask-position",
  "clip-path",
  "filter",
  "--wght",
]);

const TIMING_KEYWORD = /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|normal|initial|inherit|unset)$/;
const TIME_VALUE = /^-?\d*\.?\d+m?s$/;
const TIMING_FUNCTION = /^(cubic-bezier|steps|linear)\(/;

/** @typedef {import("./collect.mjs").CssRule} CssRule */
/** @typedef {import("./collect.mjs").ElementRecord} ElementRecord */

/**
 * @typedef {object} Finding
 * @property {string} id
 * @property {"error" | "warn" | "info"} level
 * @property {string} title
 * @property {string} where
 * @property {string[]} detail
 * @property {string} [hint]
 */

/* ── shared helpers ──────────────────────────────────────────────────────────── */

/**
 * The first token of a shorthand segment that can only be a property name.
 * @param {string} segment
 */
function propertyOfSegment(segment) {
  for (const token of segment.trim().split(/\s+/)) {
    if (!token) continue;
    if (TIME_VALUE.test(token)) continue;
    if (TIMING_KEYWORD.test(token)) continue;
    if (TIMING_FUNCTION.test(token)) continue;
    if (token.startsWith("var(") || token.startsWith("calc(")) continue;
    return token;
  }
  return "all";
}

/**
 * The property list a rule's transition actually covers, longhand or shorthand, or `null` when
 * the rule says nothing about transitions.
 * @param {Map<string, string>} declarations
 * @returns {{ properties: string[], shorthand: boolean } | null}
 */
export function transitionCoverage(declarations) {
  const longhand = declarations.get("transition-property");
  if (longhand !== undefined) {
    return {
      properties: splitTopLevel(longhand, ",").map((part) => part.text.trim()).filter(Boolean),
      shorthand: false,
    };
  }
  const shorthand = declarations.get("transition");
  if (shorthand === undefined) return null;
  if (shorthand.trim() === "none") return { properties: ["none"], shorthand: true };
  return {
    properties: splitTopLevel(shorthand, ",").map((part) => propertyOfSegment(part.text)).filter(Boolean),
    shorthand: true,
  };
}

/**
 * Every class a compound names, including the ones nested in a selector-list pseudo. `registers.css`
 * leans on `:is()` throughout (`:is(.is-in.ink-press, .is-in .ink-press)`), and a compound whose
 * classes all live inside the parentheses reads as classless unless they are harvested.
 * @param {import("./collect.mjs").Compound} compound
 * @returns {string[]}
 */
function compoundClassNames(compound) {
  const names = [...compound.classes];
  for (const pseudo of compound.pseudoClasses) {
    if (!["is", "not", "where", "has", "matches", "any"].includes(pseudo.name)) continue;
    for (const alternative of splitTopLevel(pseudo.args, ",")) {
      for (const { compound: inner } of parseSelector(alternative.text).compounds) {
        names.push(...compoundClassNames(inner));
      }
    }
  }
  return names;
}

/**
 * A rule that speaks only in register and runtime classes is the register's own.
 * @param {CssRule} rule
 */
function isRegisterOwned(rule) {
  const key = rule.compounds.at(-1)?.compound;
  if (!key) return false;
  if (key.tag || key.ids.length || key.attrs.length) return false;
  const classes = compoundClassNames(key);
  if (classes.length === 0) return false;
  return classes.every(
    (name) => REGISTER_CLASSES.includes(name) || /^(is-|has-)/.test(name) || name === "voct-motion",
  );
}

/**
 * A rule that only applies while the pointer or focus is on the element, or while a state class
 * the page sets itself is present — the kind of transition a visitor triggers by hand.
 * @param {CssRule} rule
 */
function isStateRule(rule) {
  const key = rule.compounds.at(-1)?.compound;
  if (!key) return false;
  if (key.pseudoClasses.some((pseudo) => /^(hover|focus|focus-visible|focus-within|active|target|checked|open)$/.test(pseudo.name))) {
    return true;
  }
  return compoundClassNames(key).some((name) => /^(is-|has-)/.test(name));
}

/** A deliberate opt-out, not a collision: a reduced-motion block exists to strip motion.
 *  @param {CssRule} rule */
const isReducedMotionRule = (rule) =>
  rule.atRules.some((prelude) => prelude.includes("prefers-reduced-motion"));

/**
 * The properties a node's registers animate on the element itself, deduplicated — `.reveal` and
 * `.reveal-light` on one node both claim `opacity`, and that is one slot, not two.
 * @param {string[]} registers
 * @returns {string[]}
 */
function animatedProperties(registers) {
  /** @type {string[]} */
  const properties = [];
  for (const name of registers) {
    const property = REGISTER_PROPERTY[name];
    if (property && !properties.includes(property)) properties.push(property);
  }
  return properties;
}

/** @param {CssRule} rule */
const keyPseudoElement = (rule) => rule.compounds.at(-1)?.compound.pseudoElements[0] ?? null;

/** @param {CssRule} rule */
const ruleLocation = (rule) => `${rule.file}${rule.line ? `:${rule.line}` : ""}`;

/**
 * Index rules by one static class of their key compound, so an element only ever competes with
 * rules that could plausibly name it. Rules whose key compound carries no static class (tag-only,
 * attribute-only, runtime-only) go in a bucket every element checks.
 * @param {CssRule[]} rules
 */
export function indexRules(rules) {
  /** @type {Map<string, CssRule[]>} */
  const byClass = new Map();
  /** @type {CssRule[]} */
  const unkeyed = [];

  for (const rule of rules) {
    const key = rule.compounds.at(-1)?.compound;
    const anchors = key
      ? compoundClassNames(key).filter((name) => !/^(is-|has-|js-)/.test(name) && name !== "voct-motion")
      : [];
    if (anchors.length === 0) {
      unkeyed.push(rule);
      continue;
    }
    for (const anchor of anchors) {
      const bucket = byClass.get(anchor);
      if (bucket) bucket.push(rule);
      else byClass.set(anchor, [rule]);
    }
  }
  return { byClass, unkeyed };
}

/**
 * Every rule that matches this element, cheaply pre-filtered by the class index.
 * @param {ReturnType<typeof indexRules>} index
 * @param {ElementRecord[]} page
 * @param {number} elementIndex
 */
function rulesFor(index, page, elementIndex) {
  const element = page[elementIndex];
  /** @type {Set<CssRule>} */
  const candidates = new Set(index.unkeyed);
  for (const className of element.classes) {
    for (const rule of index.byClass.get(className) ?? []) candidates.add(rule);
  }
  return [...candidates].filter((rule) => selectorMatches(page, elementIndex, rule.compounds));
}

/**
 * Walk every element that wears a register, once, handing each to the per-element checks. One
 * traversal serves all of them because the expensive step is the match, not the question asked
 * of the result.
 * @param {{ page: string, elements: ElementRecord[] }[]} pages
 * @param {ReturnType<typeof indexRules>} index
 * @param {(context: { page: string, element: ElementRecord, registers: string[], rules: CssRule[] }) => void} visit
 */
export function forEachRegisterNode(pages, index, visit) {
  for (const { page, elements } of pages) {
    for (let elementIndex = 0; elementIndex < elements.length; elementIndex++) {
      const element = elements[elementIndex];
      const registers = registersOn(element);
      if (registers.length === 0) continue;
      visit({ page, element, registers, rules: rulesFor(index, elements, elementIndex) });
    }
  }
}

/**
 * Findings about the same rule on the same kind of node repeat across sixteen pages. Collapse
 * them onto one line that names how many pages carry it.
 * @param {{ key: string, page: string, finding: Finding }[]} raw
 * @returns {Finding[]}
 */
function groupFindings(raw) {
  /** @type {Map<string, Finding & { pages: Set<string> }>} */
  const grouped = new Map();
  for (const { key, page, finding } of raw) {
    const existing = grouped.get(key);
    if (existing) {
      existing.pages.add(page);
      continue;
    }
    grouped.set(key, { ...finding, pages: new Set([page]) });
  }
  return [...grouped.values()].map((finding) => {
    const pages = [...finding.pages].sort();
    const shown = pages.slice(0, 3).join(", ");
    return {
      ...finding,
      where: `${finding.where} — ${pages.length} page${pages.length === 1 ? "" : "s"}: ${shown}${pages.length > 3 ? ", …" : ""}`,
    };
  });
}

/* ── R1 · a comment that swallows a rule ─────────────────────────────────────── */

/**
 * An unclosed comment parses, builds, passes `astro check`, and eats the rule under it. The tell
 * is a block-opening brace at the END of a line inside comment text: this codebase quotes CSS in
 * prose constantly, but always balanced on one line (`.station-poster { opacity: .8 }`), never as
 * an open block.
 * @param {{ file: string, line: number, text: string }[]} comments
 * @returns {Finding[]}
 */
export function checkSwallowedRules(comments) {
  /** @type {Finding[]} */
  const findings = [];
  for (const comment of comments) {
    const lines = comment.text.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!/\{\s*$/.test(line)) continue;
      if (!/[.#:[\w-]/.test(line.replace(/\{\s*$/, ""))) continue;
      const closes = lines.slice(index + 1).some((rest) => /^\s*\}/.test(rest));
      if (!closes) continue;
      findings.push({
        id: "R1",
        level: "error",
        title: "A CSS comment contains an unclosed rule block — the rule is commented out",
        where: `${comment.file}:${comment.line + index}`,
        detail: [
          `swallowed: ${line.trim()} …`,
          "Nothing in the toolchain reports this: it parses, it builds and `astro check` is clean.",
        ],
        hint: "guardrails §2, the ACT I comment above `.site-footer-head`.",
      });
    }
  }
  return findings;
}

/* ── R2 · @property registered more than once ────────────────────────────────── */

/**
 * Two registrations of one name make the effective descriptors a function of bundle order, so a
 * property interpolates or does not depending on which sheet loaded last.
 * @param {Map<string, { file: string, line: number, descriptors: Map<string, string> }[]>} registrations
 * @returns {Finding[]}
 */
export function checkPropertyRegistrations(registrations) {
  /** @type {Finding[]} */
  const findings = [];
  for (const [name, entries] of registrations) {
    if (entries.length < 2) continue;
    const descriptorSets = entries.map((entry) =>
      [...entry.descriptors.entries()].sort().map(([key, value]) => `${key}: ${value}`).join("; "));
    const identical = new Set(descriptorSets).size === 1;
    findings.push({
      id: "R2",
      level: "error",
      title: `@property ${name} is registered ${entries.length} times`,
      where: entries.map((entry) => `${entry.file}:${entry.line}`).join(" · "),
      detail: identical
        ? ["Descriptors agree today, so only bundle order decides — and it decides silently the day they diverge."]
        : descriptorSets.map((set, index) => `${entries[index].file}: ${set}`),
      hint: "guardrails §2 — `--wght` was registered twice with different `inherits`.",
    });
  }
  return findings;
}

/* ── R3 · a transition colliding with a register ─────────────────────────────── */

/**
 * There is exactly one `transition-property` slot per element. When a page rule and a register
 * both claim it, one of them silently loses — and which one is a specificity contest neither
 * author was having. Both outcomes are defects and both are reported:
 *
 *   page rule wins   → the register never moves (the `/koncerty` `.rep-row` shape)
 *   register wins    → the element's own hover stops easing and starts snapping
 *                      (`.path-entry-title`, lost for a month)
 *
 * @param {{ page: string, elements: ElementRecord[] }[]} pages
 * @param {ReturnType<typeof indexRules>} index
 * @returns {Finding[]}
 */
export function checkTransitionCollisions(pages, index) {
  /** @type {{ key: string, page: string, finding: Finding }[]} */
  const raw = [];

  forEachRegisterNode(pages, index, ({ page, element, registers, rules }) => {
    const animated = animatedProperties(registers);
    if (animated.length === 0) return;

    const transitionRules = rules.filter(
      (rule) => !keyPseudoElement(rule)
        && !isReducedMotionRule(rule)
        && transitionCoverage(rule.declarations) !== null,
    );
    const owned = transitionRules.filter(isRegisterOwned);
    const foreign = transitionRules.filter((rule) => !isRegisterOwned(rule));
    if (foreign.length === 0 || owned.length === 0) return;

    // The register rule that actually declares the animation, not one of its `transition: none`
    // releases — a page rule is entitled to out-specify a release and the guardrails say so.
    const governing = owned
      .filter((rule) => {
        const coverage = transitionCoverage(rule.declarations);
        return coverage !== null && animated.some((property) => coverage.properties.includes(property));
      })
      .sort((a, b) => compareSpecificity(b.specificity, a.specificity))[0];
    if (!governing) return;

    for (const rule of foreign) {
      const coverage = transitionCoverage(rule.declarations);
      if (!coverage) continue;
      const covers = coverage.properties.includes("all")
        || animated.every((property) => coverage.properties.includes(property));
      if (covers) continue;

      const contest = compareSpecificity(rule.specificity, governing.specificity);
      const pageWins = contest > 0;
      const tied = contest === 0;

      raw.push({
        key: `R3|${rule.selector}|${describeElement(element)}`,
        page,
        finding: {
          id: "R3",
          level: tied ? "warn" : "error",
          title: pageWins
            ? `A page rule replaces the ${registers.join("+")} register's transition`
            : tied
              ? `A page rule ties the ${registers.join("+")} register's transition — bundle order decides`
              : `The ${registers.join("+")} register replaces this element's own transition`,
          where: `${describeElement(element)} · ${ruleLocation(rule)}`,
          detail: [
            `page:     ${rule.selector} ${formatSpecificity(rule.specificity)} → transition-property: ${coverage.properties.join(", ")}${coverage.shorthand ? "  [shorthand]" : ""}`,
            `register: ${governing.selector} ${formatSpecificity(governing.specificity)} → ${animated.join(", ")}`,
            pageWins
              ? "The register is inert on this node: observed, flipped, settled, never moved."
              : tied
                ? "Equal specificity — whichever sheet the bundler emitted last wins, and that is not a decision anyone made."
                : isStateRule(rule)
                  ? "The element's hover/state transition no longer eases; it snaps. Nothing looks wrong until someone hovers."
                  : "The element's own transition is dropped.",
          ],
          hint: "guardrails §5 — restate the element's list together with the register's, as longhands, at a specificity clearing both the register and `.is-settled`.",
        },
      });
    }
  });

  return groupFindings(raw);
}

/* ── R4 · a page rule pinning the value a register animates ──────────────────── */

/**
 * The other half of the same collision, and the one an audit of the source cannot see: Astro
 * scopes a page's styles by appending `[data-astro-cid-…]` to every compound, so a two-class page
 * rule is emitted at (0,4,0) and outranks `html.voct-motion .reveal` (0,2,1) and its `.is-in`
 * (0,3,1). A resting dim written as `opacity` therefore pins the node the register is trying to
 * ink. The fix is `filter: opacity()`, which composes instead of replacing.
 * @param {{ page: string, elements: ElementRecord[] }[]} pages
 * @param {ReturnType<typeof indexRules>} index
 * @returns {Finding[]}
 */
export function checkPinnedRegisterValues(pages, index) {
  /** @type {{ key: string, page: string, finding: Finding }[]} */
  const raw = [];

  forEachRegisterNode(pages, index, ({ page, element, registers, rules }) => {
    const animated = animatedProperties(registers);
    if (animated.length === 0) return;

    const owned = rules.filter(isRegisterOwned);
    for (const property of animated) {
      const governing = owned
        .filter((rule) => rule.declarations.has(property) && !keyPseudoElement(rule))
        .sort((a, b) => compareSpecificity(b.specificity, a.specificity))[0];
      if (!governing) continue;

      for (const rule of rules) {
        if (isRegisterOwned(rule) || keyPseudoElement(rule) || isStateRule(rule)) continue;
        if (!rule.declarations.has(property)) continue;
        if (compareSpecificity(rule.specificity, governing.specificity) < 0) continue;

        raw.push({
          key: `R4|${rule.selector}|${property}|${describeElement(element)}`,
          page,
          finding: {
            id: "R4",
            level: "error",
            title: `A page rule pins \`${property}\`, the value the ${registers.join("+")} register animates`,
            where: `${describeElement(element)} · ${ruleLocation(rule)}`,
            detail: [
              `page:     ${rule.selector} ${formatSpecificity(rule.specificity)} → ${property}: ${rule.declarations.get(property)}`,
              `register: ${governing.selector} ${formatSpecificity(governing.specificity)} → ${property}: ${governing.declarations.get(property)}`,
              rule.selector.includes("[data-astro-cid-")
                ? "Astro's scoping attribute is what won this: the source rule looks less specific than it is emitted."
                : "The register is observed, flipped and settled on this node, and never moves.",
            ],
            hint: property === "opacity"
              ? "guardrails §2 — a resting dim is `filter: opacity()`, which composes with the register."
              : "guardrails §5 — restate the register's own value, or drop the page declaration.",
          },
        });
      }
    }
  });

  return groupFindings(raw);
}

/* ── R5 · a cue wearing a register ───────────────────────────────────────────── */

/**
 * `.reveal-cue` has no appearance of its own; it fires choreography authored elsewhere. A node
 * wearing it AND a register stacks a second, unrelated motion on an authored one — the compounded
 * motion the manifest stanzas were freed from.
 * @param {{ page: string, elements: ElementRecord[] }[]} pages
 * @returns {Finding[]}
 */
export function checkCuePurity(pages) {
  /** @type {{ key: string, page: string, finding: Finding }[]} */
  const raw = [];
  for (const { page, elements } of pages) {
    for (const element of elements) {
      if (!element.classes.has("reveal-cue")) continue;
      const others = registersOn(element).filter((name) => name !== "reveal-cue");
      if (others.length === 0) continue;
      raw.push({
        key: `R5|${describeElement(element)}|${others.join("+")}`,
        page,
        finding: {
          id: "R5",
          level: "error",
          title: `A cue node also wears ${others.join(" and ")}`,
          where: describeElement(element),
          detail: ["A register stacked on an authored choreography is two motions on one node."],
          hint: "registers.css — a node wearing `.reveal-cue` must NOT also wear a register.",
        },
      });
    }
  }
  return groupFindings(raw);
}

/* ── R6 · the press's resting weight ─────────────────────────────────────────── */

/**
 * Under `html.voct-motion` the weight axis is driven by `font-variation-settings`, which overrides
 * `font-weight` outright. A gap between the element's declared weight and `--wght-rest` is
 * therefore invisible until motion is turned off — which is how `/press` shipped a 380 against a
 * declared 300 for months.
 * @param {{ page: string, elements: ElementRecord[] }[]} pages
 * @param {ReturnType<typeof indexRules>} index
 * @param {number} restWeight
 * @returns {Finding[]}
 */
export function checkPressRestWeight(pages, index, restWeight) {
  /** @type {{ key: string, page: string, finding: Finding }[]} */
  const raw = [];

  forEachRegisterNode(pages, index, ({ page, element, registers, rules }) => {
    if (!registers.includes("ink-press")) return;
    const declaring = rules
      .filter((rule) => rule.declarations.has("font-weight") && !keyPseudoElement(rule) && rule.atRules.length === 0)
      .sort((a, b) => compareSpecificity(b.specificity, a.specificity))[0];
    if (!declaring) return;

    const value = (declaring.declarations.get("font-weight") ?? "").trim();
    if (value === String(restWeight) || value === "var(--wght-rest)") return;
    if (value.startsWith("var(--wght-rest")) return;

    raw.push({
      key: `R6|${declaring.selector}|${value}`,
      page,
      finding: {
        id: "R6",
        level: "error",
        title: `An \`.ink-press\` node rests at font-weight ${value}, not --wght-rest (${restWeight})`,
        where: `${describeElement(element)} · ${ruleLocation(declaring)}`,
        detail: [
          `${declaring.selector} ${formatSpecificity(declaring.specificity)} → font-weight: ${value}`,
          "With motion on, the axis hides this. It is only visible to a visitor with motion off or JS blocked.",
        ],
        hint: "registers.css — constraint 1 of the ink press.",
      },
    });
  });

  return groupFindings(raw);
}

/* ── R7 · a choreography longer than the settle ceiling ──────────────────────── */

/**
 * `is-settled` strips the transition, so `SETTLE_FALLBACK_MS` is a hard ceiling: a register whose
 * duration plus delays exceeds it is cut off mid-gesture, and nothing reports that.
 * @param {Map<string, number>} durations  Register token → milliseconds.
 * @param {{ selector: string, file: string, line: number, delayMs: number }[]} veilDelays
 * @param {number} ceilingMs
 * @returns {Finding[]}
 */
export function checkSettleCeiling(durations, veilDelays, ceilingMs) {
  /** @type {Finding[]} */
  const findings = [];

  const cadenceMs = 360; // the largest `data-d` offset registers.css declares
  const pairingMs = 180; // the ink+lead pairing delay

  for (const [token, duration] of durations) {
    const worst = duration + cadenceMs + (token === "--veil-lift" ? Math.max(0, ...veilDelays.map((entry) => entry.delayMs)) : pairingMs);
    if (worst <= ceilingMs) continue;
    findings.push({
      id: "R7",
      level: "error",
      title: `${token} can total ${worst}ms against a ${ceilingMs}ms settle ceiling`,
      where: "styles/tokens.css",
      detail: [
        `${duration}ms duration + ${cadenceMs}ms cadence + ${worst - duration - cadenceMs}ms authored delay`,
        "`is-settled` strips the transition when the fallback fires, cutting the gesture off where it stands.",
      ],
      hint: "scripts/reveal.ts — SETTLE_FALLBACK_MS.",
    });
  }

  const headroom = Math.min(
    ...[...durations.values()].map((duration) => ceilingMs - duration - cadenceMs - pairingMs),
  );
  if (Number.isFinite(headroom) && headroom < 400 && findings.length === 0) {
    findings.push({
      id: "R7",
      level: "warn",
      title: `Only ${headroom}ms of headroom under the ${ceilingMs}ms settle ceiling`,
      where: "styles/tokens.css",
      detail: ["The next register lengthened here is the one that gets cut off."],
    });
  }
  return findings;
}

/* ── R8 · a hidden dimension outside the motion gate ─────────────────────────── */

/**
 * `index.astro`'s no-motion gate neutralises `opacity` and `transform` and nothing else. A weight,
 * a mask position or a clip declared outside `html.voct-motion` therefore strands every node it
 * touches at its start value for a visitor with no JS or reduced motion.
 * @param {CssRule[]} rules
 * @returns {Finding[]}
 */
export function checkUngatedHiddenState(rules) {
  /** @type {Finding[]} */
  const findings = [];

  for (const rule of rules) {
    const touchesRegister = rule.compounds.some(({ compound }) =>
      compound.classes.some((name) => REGISTER_CLASSES.includes(name)));
    if (!touchesRegister) continue;

    const gated = rule.compounds.some(({ compound }) => compound.classes.includes("voct-motion"));
    if (gated) continue;

    const declared = UNGATED_HIDDEN_PROPERTIES.filter((property) => rule.declarations.has(property));
    if (declared.length === 0) continue;

    findings.push({
      id: "R8",
      level: "warn",
      title: `A register node declares ${declared.join(", ")} outside \`html.voct-motion\``,
      where: ruleLocation(rule),
      detail: [
        `${rule.selector} → ${declared.map((property) => `${property}: ${rule.declarations.get(property)}`).join("; ")}`,
        "The no-motion gate un-hides opacity and transform only; this dimension stays at its start value with JS off.",
      ],
      hint: "guardrails §5 — anything the register hides or offsets must be declared inside the gate.",
    });
  }
  return findings;
}

/* ── R9 · a register rule adding a bare shorthand ────────────────────────────── */

/**
 * `transition` is a shorthand. A node carrying two register dimensions (`.section-title` is the
 * ink node AND the press node) that gets a second shorthand declaration has the first REPLACED —
 * the heading snaps to full ink instead of inking. Longhands are the contract, and they also
 * leave `transition-delay` alone so an ink+lead node keeps its 0.18s.
 * @param {{ page: string, elements: ElementRecord[] }[]} pages
 * @param {ReturnType<typeof indexRules>} index
 * @returns {Finding[]}
 */
export function checkRegisterShorthands(pages, index) {
  /** @type {{ key: string, page: string, finding: Finding }[]} */
  const raw = [];

  forEachRegisterNode(pages, index, ({ page, element, registers, rules }) => {
    if (registers.length < 2) return;

    const declaring = rules.filter((rule) => {
      if (keyPseudoElement(rule)) return false;
      const coverage = transitionCoverage(rule.declarations);
      return coverage !== null && !coverage.properties.includes("none");
    });
    if (declaring.length < 2) return;

    const shorthands = declaring.filter((rule) => transitionCoverage(rule.declarations)?.shorthand);
    if (shorthands.length === 0) return;

    // A shorthand is only a defect where a SECOND declaration exists to be replaced.
    const properties = new Set(declaring.flatMap((rule) => transitionCoverage(rule.declarations)?.properties ?? []));
    if (properties.size < 2) return;

    for (const rule of shorthands) {
      raw.push({
        key: `R9|${rule.selector}`,
        page,
        finding: {
          id: "R9",
          level: "error",
          title: `A bare \`transition\` shorthand on a node carrying ${registers.join("+")}`,
          where: `${describeElement(element)} · ${ruleLocation(rule)}`,
          detail: [
            `${rule.selector} → transition: ${rule.declarations.get("transition")}`,
            `The node's registers animate ${[...properties].join(", ")}; a shorthand replaces the others rather than adding to them.`,
          ],
          hint: "registers.css — declare the pair as longhands (`transition-property: opacity, --wght`).",
        },
      });
    }
  });

  return groupFindings(raw);
}

/* ── R11 · a scoped rule reaching <html> or <body> ───────────────────────────── */

/** Astro's scoping attribute, appended to EVERY compound of a non-`is:global` `<style>`. */
const SCOPE_ATTR = /^data-astro-cid-/;

/** @param {import("./collect.mjs").Compound} compound */
const isScoped = (compound) => compound.attrs.some((attr) => SCOPE_ATTR.test(attr.name));

/**
 * The compound as its author wrote it: the scoping attribute removed, nothing else touched.
 * @param {import("./collect.mjs").Compound} compound
 */
const asAuthored = (compound) => ({
  ...compound,
  attrs: compound.attrs.filter((attr) => !SCOPE_ATTR.test(attr.name)),
});

/** One compound wrapped as a whole selector, so `selectorMatches` can test it against one element.
 *  @param {import("./collect.mjs").Compound} compound
 *  @param {string} text */
const asStep = (compound, text) => [{ combinator: "", compound, text }];

/**
 * Could this compound be addressing the document root? A tag of `html`/`body` or a `:root` says so
 * outright; a bare class or id might, and only the emitted page decides. Universal and pseudo-only
 * compounds are excluded: `*` covers the root the way it covers everything, which is not the same
 * as being aimed at it.
 * @param {import("./collect.mjs").Compound} compound
 */
function couldNameRoot(compound) {
  if (compound.universal) return false;
  if (compound.tag) return compound.tag === "html" || compound.tag === "body";
  if (compound.pseudoClasses.some((pseudo) => pseudo.name === "root")) return true;
  return compound.classes.length > 0 || compound.ids.length > 0;
}

/**
 * `<html>` and `<body>` are rendered by BaseLayout, so they carry no other file's cid — and a
 * page's scoped rule for its own ground therefore compiles to a selector that cannot match
 * anything, ever. `.page-obrazy { background: …; color: var(--paper) }` was emitted as
 * `.page-obrazy[data-astro-cid-zuxexoyc]`, and `/obrazy` stood on parchment with every line of its
 * copy set in the colour of its own background for the whole life of the page. Three pages had it,
 * and the `:global()` sibling two lines below the broken rule was right all along.
 *
 * It is this audit's own failure class from every side: `astro check` sees valid CSS, the build is
 * green, the source reads as correct, and the register checks above examine the cascade they own
 * rather than the ground under it. It was found by eye, months late.
 *
 * Decided against the emitted HTML rather than by pattern, because a cid on the root is not
 * impossible — merely absent — and a rule that does reach its element is no defect.
 * @param {{ page: string, elements: ElementRecord[] }[]} pages
 * @param {CssRule[]} rules
 * @returns {Finding[]}
 */
export function checkScopedRootRules(pages, rules) {
  const rooted = pages.map(({ page, elements }) => ({
    page,
    elements,
    roots: elements.flatMap((element, index) => (element.tag === "html" || element.tag === "body" ? [index] : [])),
  }));

  /** @type {{ key: string, page: string, finding: Finding }[]} */
  const raw = [];

  for (const rule of rules) {
    for (const step of rule.compounds) {
      if (!isScoped(step.compound) || !couldNameRoot(step.compound)) continue;

      const emitted = asStep(step.compound, step.text);
      const authored = asStep(asAuthored(step.compound), step.text);

      /** @type {{ page: string, element: ElementRecord } | null} */
      let intended = null;
      let reachable = false;
      for (const { page, elements, roots } of rooted) {
        for (const index of roots) {
          if (selectorMatches(elements, index, emitted)) {
            reachable = true;
            break;
          }
          if (!intended && selectorMatches(elements, index, authored)) intended = { page, element: elements[index] };
        }
        if (reachable) break;
      }
      // A compound that reaches no root even unscoped was naming a page object all along.
      if (reachable || !intended) continue;

      const cid = step.compound.attrs.find((attr) => SCOPE_ATTR.test(attr.name))?.name ?? "data-astro-cid-…";
      const properties = [...rule.declarations.keys()];
      raw.push({
        key: `R11|${rule.selector}`,
        page: intended.page,
        finding: {
          id: "R11",
          level: "error",
          title: "A scoped rule reaches the document root, where its scope attribute never exists — the rule is dead",
          where: ruleLocation(rule),
          detail: [
            `emitted:  ${rule.selector}`,
            `element:  ${describeElement(intended.element)} — rendered by BaseLayout, so it carries no [${cid}]`,
            `${properties.length} declaration${properties.length === 1 ? "" : "s"} never applied: ${properties.slice(0, 4).join(", ")}${properties.length > 4 ? ", …" : ""}`,
          ],
          hint: "Wrap it — `:global(body.page-…) { … }`. Any rule reaching <body> or <html> from a scoped <style> needs it.",
        },
      });
      break;
    }
  }

  return groupFindings(raw);
}
