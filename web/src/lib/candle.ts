/**
 * @file candle.ts
 * @description Per-concert candlelight. Derives the detail-page `--candle` tint from a
 *  station's `accent` hex so each concert page carries its own light (steel for Hymn,
 *  sage for Wołanie Gór…) without touching layout. The accent hue is kept but its OKLCH
 *  lightness is normalized to the base gold's, so cool hues stay readable at the same
 *  small sizes the gold manages today. Computed at BUILD time (plain hex out) — no
 *  relative-color-syntax browser risk, graceful everywhere.
 * @architecture Astro assets 2026
 * @module lib/candle
 */

/** The site-wide candle gold from landing/01-foundation.css (`--candle`). */
const BASE_CANDLE = "#c6a45b";

/** The candle as INK (`--candle-ink`, tokens.css) — the lightest value of this hue that clears
 *  WCAG AA for small text on EVERY parchment the site has. Gold that has to be READ rather than
 *  seen.
 *
 *  THIS LITERAL MIRRORS A TOKEN AND MUST BE CHANGED WITH IT. It is the one place the ink is
 *  spelled out in TypeScript instead of taken from CSS, and it has already drifted once: tokens.css
 *  darkened the ink from 64% to 58% of the candle when 64% was found to fail on the deeper papers,
 *  and this copy stayed at the old `#7f693a`, so the concert pages went on deriving every station's
 *  ink from a value the site had retired. Nothing shows when that happens — the colour is still
 *  gold, still plausible, just under the bar. The footer note in landing/06-footer.css records the
 *  same trap from the other end. */
const BASE_CANDLE_INK = "#735f35";

/** Max OKLab chroma for the derived candle — keeps a saturated future accent from
 *  reading neon next to the parchment/night palette. Base gold sits near 0.10. */
const MAX_CHROMA = 0.12;

type Oklab = { L: number; a: number; b: number };

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((ch) => ch + ch).join("") : h;
  const n = Number.parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

const rgbToOklab = ([r, g, b]: [number, number, number]): Oklab => {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

const oklabToHex = ({ L, a, b }: Oklab): string => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const to255 = (c: number): number =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255);
  return `#${[lr, lg, lb].map((c) => to255(c).toString(16).padStart(2, "0")).join("")}`;
};

/**
 * The station's own light: the accent hue at the candle's luminance. The base gold
 * accent passes through unchanged, so pages that already burn gold keep burning gold.
 */
export const candleFrom = (accentHex: string, baseHex: string = BASE_CANDLE): string => {
  if (accentHex.toLowerCase() === baseHex.toLowerCase()) return baseHex;
  const base = rgbToOklab(hexToRgb(baseHex));
  const acc = rgbToOklab(hexToRgb(accentHex));
  const chroma = Math.hypot(acc.a, acc.b);
  const k = chroma > MAX_CHROMA ? MAX_CHROMA / chroma : 1;
  return oklabToHex({ L: base.L, a: acc.a * k, b: acc.b * k });
};

/**
 * The station's light as INK — the same hue, dropped to the luminance small gold text needs on
 * parchment. A page that re-tones `--candle` per concert cannot fall back to the static
 * `--candle-ink`: the two would then be different hues on the same band, which is exactly the
 * seam the whole per-station tint exists to avoid. So the ink is derived from the same accent,
 * and it is a SECOND custom property rather than a replacement — `--candle` still carries the
 * rules, marks and display gold, where the contrast minimum does not apply.
 *
 * The gold stations return the hand-tuned `--candle-ink` verbatim (as `candleFrom` returns the
 * base gold verbatim), so a page burning plain gold stays byte-identical with /o-nas and
 * /kolofon.
 *
 * Measured across the six station accents, the derived inks land at 5.34–5.59 : 1 on `--paper`
 * and 4.84–5.07 on `--paper-soft`, which is the ground the concert page's reading bands actually
 * stand on. `--paper-deep` is where it runs out: three of the six fall to 4.41–4.49 there, just
 * under the bar, so a band on the deepest parchment may carry gold RULES and MARKS but no gold
 * that has to be read. The concert page's pullquote is that band and holds none.
 */
export const candleInkFrom = (accentHex: string): string =>
  accentHex.toLowerCase() === BASE_CANDLE.toLowerCase()
    ? BASE_CANDLE_INK
    : candleFrom(accentHex, BASE_CANDLE_INK);
