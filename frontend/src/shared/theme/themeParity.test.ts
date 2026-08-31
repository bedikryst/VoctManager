/**
 * @file themeParity.test.ts
 * @description The dark theme is one block of re-declared custom properties, and
 * a token left out of it does not fail — it renders one element in the light
 * theme's colour, three routes away from anything the author was looking at.
 * This reads `panel.css` AS TEXT and asserts the two halves agree.
 *
 * Text, never the compiled stylesheet, and the reason is on the record: a
 * `@theme` colour with no call site is tree-shaken out of the build, so
 * `--color-line-on-inverse` once shipped a hand-written dark half against a
 * light half that had been dropped. Reading the source sees what the author
 * wrote; reading `dist/` sees what survived Tailwind.
 *
 * The `theme-color` block is here for the same reason it is cheap: this file is
 * already parsing the stylesheet, and a meta cannot read a CSS variable — so
 * the browser-chrome colour is hard-coded in three places that have to move
 * with the ground or a seam opens along the top edge of an installed app.
 * @module shared/theme/themeParity
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string): string =>
  readFileSync(resolve(FRONTEND, path), "utf8");

const PANEL_CSS = read("src/app/styles/panel.css");

/**
 * The base `[data-theme="dark"]` block, brace-matched from its own selector.
 * The pattern deliberately does not match `[data-theme="dark"] &`, which is how
 * the two blend-mode utilities reach into the theme — those declare no tokens.
 */
const sliceDarkBlock = (css: string): string => {
  const header = /\[data-theme="dark"\]\s*\{/.exec(css);
  if (!header) throw new Error("panel.css has no [data-theme='dark'] block");
  const open = header.index + header[0].length - 1;
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error("[data-theme='dark'] block is not closed");
};

const DARK_CSS = sliceDarkBlock(PANEL_CSS);
const LIGHT_CSS = PANEL_CSS.replace(DARK_CSS, "");

const declarations = (css: string): Map<string, string> => {
  const found = new Map<string, string>();
  for (const [, name, value] of css.matchAll(
    /^[ \t]*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm,
  )) {
    found.set(name, value.trim());
  }
  return found;
};

const LIGHT = declarations(LIGHT_CSS);
const DARK = declarations(DARK_CSS);

/**
 * Tokens that MUST carry a value on both themes. Not every token belongs here —
 * gold, sage and incense are absent on purpose, because an accent holding its
 * hue through the swap is the finding the whole palette rests on, and listing
 * them would turn that decision into a failure the day someone honours it.
 *
 * What is listed is everything whose job is to MOVE: the six ladder rungs, the
 * two accents that cannot clear AA unchanged, the inverse trio, the hairlines,
 * the glass pair, the five shadow colours and the five aura colours.
 */
const MUST_FLIP = [
  "--color-ethereal-marble",
  "--color-ethereal-alabaster",
  "--color-ethereal-parchment",
  "--color-ethereal-canvas",
  "--color-ethereal-graphite",
  "--color-ethereal-ink",
  "--color-ethereal-amethyst",
  "--color-ethereal-crimson",
  "--color-ethereal-crimson-light",
  "--color-surface-inverse",
  "--color-ink-on-inverse",
  "--color-line-on-inverse",
  "--color-hairline",
  "--color-hairline-strong",
  "--color-glass-surface",
  "--color-glass-border",
  "--glass-highlight",
  "--glass-contact",
  "--glass-shade",
  "--glass-shade-lifted",
  "--glass-shade-strong",
  "--aura-light",
  "--aura-shaft",
  "--aura-shaft-soft",
  "--aura-vignette",
  "--aura-vignette-deep",
];

describe("panel.css theme parity", () => {
  it("declares no dark token the light theme has never heard of", () => {
    const orphans = [...DARK.keys()].filter((name) => !LIGHT.has(name));
    expect(orphans).toEqual([]);
  });

  it("carries every token that has to move in BOTH themes", () => {
    const missingLight = MUST_FLIP.filter((name) => !LIGHT.has(name));
    const missingDark = MUST_FLIP.filter((name) => !DARK.has(name));
    expect({ missingLight, missingDark }).toEqual({
      missingLight: [],
      missingDark: [],
    });
  });

  it("gives every flipping token a value that actually differs", () => {
    // A token copied into the dark block unchanged is the same defect as one
    // left out, wearing the shape of a decision.
    const unchanged = MUST_FLIP.filter(
      (name) => LIGHT.get(name)?.toLowerCase() === DARK.get(name)?.toLowerCase(),
    );
    expect(unchanged).toEqual([]);
  });

  it("keeps the three inverse tokens in the tailwind-merge ledger", () => {
    // A token missing from that ledger is read as an unknown colour and
    // silently DELETED by cn() at runtime — no error, and the class still
    // present in the built stylesheet.
    const ledger = read("src/shared/lib/tailwindMerge.ts");
    for (const token of ["surface-inverse", "ink-on-inverse", "line-on-inverse"]) {
      expect(ledger).toContain(`"${token}"`);
    }
  });
});

describe("theme-color parity with the ground", () => {
  const canvas = {
    light: LIGHT.get("--color-ethereal-canvas")?.toLowerCase(),
    dark: DARK.get("--color-ethereal-canvas")?.toLowerCase(),
  };

  it("matches the controller's hard-coded pair", () => {
    const controller = read("src/shared/theme/themeController.ts");
    const block = /const THEME_COLOR[^{]*\{([^}]*)\}/.exec(controller)?.[1] ?? "";
    expect(block.toLowerCase()).toContain(`light: "${canvas.light}"`);
    expect(block.toLowerCase()).toContain(`dark: "${canvas.dark}"`);
  });

  it("matches the pre-boot media-keyed metas in index.html", () => {
    const html = read("index.html").toLowerCase();
    expect(html).toContain(
      `content="${canvas.light}" media="(prefers-color-scheme: light)"`,
    );
    expect(html).toContain(
      `content="${canvas.dark}" media="(prefers-color-scheme: dark)"`,
    );
  });

  it("matches the manifest, which cannot follow a runtime preference", () => {
    // Static by nature, so it stays on the light ground; the seam it would open
    // is the installed Android window chrome rather than the iOS status bar.
    const manifest = JSON.parse(read("public/manifest.webmanifest"));
    expect(String(manifest.theme_color).toLowerCase()).toBe(canvas.light);
  });
});
