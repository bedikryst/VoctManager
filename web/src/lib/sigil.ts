/**
 * @file sigil.ts
 * @description Per-visit deterministic sigil — always an octogram (8-pointed star, the
 *  geometry of Voct's 8 voices), with seed-driven variation only in decoration: rotation,
 *  ring count, point-tip style, micro-dots, cardinal ornaments. Same seed = same sigil.
 *  Recognizable as Voct's seal across all visits; uniquely turned per session.
 *
 *  Seed lives in `sessionStorage` (not localStorage) — the sigil is the pieczęć of THIS
 *  visit, not of identity. Each returning visit = new pilgrimage. Side benefit: no
 *  persistent client-side identifier, no privacy-policy update needed under RODO.
 * @architecture Astro islands 2026
 * @module lib/sigil
 */

/** Cheap deterministic PRNG (mulberry32). Input: 32-bit seed integer; output: [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ROMAN_UNITS: ReadonlyArray<readonly [number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function roman(n: number): string {
  let value = Math.max(1, Math.floor(n));
  let out = "";
  for (const [v, sym] of ROMAN_UNITS) {
    while (value >= v) {
      out += sym;
      value -= v;
    }
  }
  return out;
}

export interface SigilOptions {
  /** Size in viewBox units; sigil is centered on (size/2, size/2). Default 220. */
  size?: number;
  /** Date stamped along the upper arc. Default: now. */
  date?: Date;
}

const POINTS = 8;

export function buildSigilSvg(seed: string, options: SigilOptions = {}): string {
  const size = options.size ?? 220;
  const date = options.date ?? new Date();
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.40;

  const rng = mulberry32(hashString(seed));

  // Seed-driven decoration:
  const rotation = rng() * (Math.PI * 2);
  const ringCount = 1 + Math.floor(rng() * 3); // 1, 2, or 3 outer rings
  const tipStyle = Math.floor(rng() * 3); // 0 = bare, 1 = cross, 2 = dot
  const microDots = rng() > 0.45;
  const cornerOrnaments = rng() > 0.55;

  const parts: string[] = [];

  // Outer rings (1-3, slightly stepped outward, lighter as they go out)
  const ringRadii: number[] = [];
  for (let i = 0; i < ringCount; i += 1) {
    const r = R * (1 + i * 0.08);
    ringRadii.push(r);
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" stroke-width="${(0.6 - i * 0.12).toFixed(2)}" stroke-opacity="${(0.5 - i * 0.12).toFixed(2)}" />`,
    );
  }

  // Inner ring — always present, holds the central candle
  const innerR = R * 0.18;
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${innerR.toFixed(2)}" stroke-width="0.5" stroke-opacity="0.7" />`,
  );

  // 8 rays — alternating weight (4 strong cardinal + 4 lighter intercardinal) so the
  // shape reads as a star not a wheel.
  for (let i = 0; i < POINTS; i += 1) {
    const angle = rotation + (i / POINTS) * Math.PI * 2;
    const startR = innerR + 2;
    const endR = R * 0.95;
    const x1 = cx + Math.cos(angle) * startR;
    const y1 = cy + Math.sin(angle) * startR;
    const x2 = cx + Math.cos(angle) * endR;
    const y2 = cy + Math.sin(angle) * endR;
    const w = i % 2 === 0 ? 0.85 : 0.5;
    const op = i % 2 === 0 ? 0.82 : 0.6;
    parts.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke-width="${w}" stroke-opacity="${op}" />`,
    );

    // Tip decoration
    if (tipStyle === 1) {
      // Cross-stroke at the tip (small horizontal arms perpendicular to the ray)
      const perp = angle + Math.PI / 2;
      const len = R * 0.045;
      const mx = cx + Math.cos(angle) * endR * 0.93;
      const my = cy + Math.sin(angle) * endR * 0.93;
      const cx1 = mx + Math.cos(perp) * len;
      const cy1 = my + Math.sin(perp) * len;
      const cx2 = mx - Math.cos(perp) * len;
      const cy2 = my - Math.sin(perp) * len;
      parts.push(
        `<line x1="${cx1.toFixed(2)}" y1="${cy1.toFixed(2)}" x2="${cx2.toFixed(2)}" y2="${cy2.toFixed(2)}" stroke-width="0.4" stroke-opacity="0.55" />`,
      );
    } else if (tipStyle === 2) {
      // Dot at the tip
      const dx = cx + Math.cos(angle) * endR;
      const dy = cy + Math.sin(angle) * endR;
      parts.push(`<circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="1" fill="currentColor" stroke="none" />`);
    }
  }

  // Micro-dots between rays (8 small dots at midangles, sitting on a ring at 0.65R)
  if (microDots) {
    for (let i = 0; i < POINTS; i += 1) {
      const angle = rotation + ((i + 0.5) / POINTS) * Math.PI * 2;
      const r = R * 0.65;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      parts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="0.7" fill="currentColor" stroke="none" />`);
    }
  }

  // Cardinal ornaments — 4 dots at N/E/S/W (independent of star rotation, so they read
  // as "of the page" rather than "of the star")
  if (cornerOrnaments) {
    const outerR = ringRadii[ringRadii.length - 1] + size * 0.018;
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      const x = cx + Math.cos(angle) * outerR;
      const y = cy + Math.sin(angle) * outerR;
      parts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.2" fill="currentColor" stroke="none" />`);
    }
  }

  // Central candle dot
  parts.push(`<circle cx="${cx}" cy="${cy}" r="1.5" fill="currentColor" stroke="none" />`);

  // Inscription along upper arc — roman date as AD · MO · DI (year · month · day). Local
  // fields, not UTC: this is the stamp of THE VISITOR'S visit, so an evening guest west of
  // UTC should see today's date, not tomorrow's.
  const inscription = [
    roman(date.getFullYear()),
    roman(date.getMonth() + 1),
    roman(date.getDate()),
  ].join("  ·  ");
  const arcR = ringRadii[ringRadii.length - 1] + size * 0.058;
  const arcPath = `M ${cx - arcR},${cy} A ${arcR},${arcR} 0 0,1 ${cx + arcR},${cy}`;
  // Unique ID per-render so multiple sigils on a page do not collide.
  const arcId = `sigil-arc-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
  const text = `
    <defs><path id="${arcId}" d="${arcPath}" /></defs>
    <text font-family="IBM Plex Mono, ui-monospace, monospace" font-size="${(size * 0.048).toFixed(1)}" letter-spacing="0.16em" fill="currentColor" stroke="none" opacity="0.55">
      <textPath href="#${arcId}" startOffset="50%" text-anchor="middle">${inscription}</textPath>
    </text>
  `;

  // Pad the viewBox so the upper arc inscription has headroom — the text sits ABOVE the path
  // and was previously clipping at the SVG top edge. Internal coordinates unchanged; the SVG
  // just renders into a slightly taller canvas.
  const pad = Math.max(14, size * 0.07);
  const vbW = size + pad * 2;
  const vbH = size + pad * 2;
  return `
<svg viewBox="${-pad} ${-pad} ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-label="Pieczęć wizyty">
  ${parts.join("\n  ")}
  ${text}
</svg>
  `.trim();
}

/** Build or reuse a per-visit seed in sessionStorage. Resets when the browser tab closes. */
export function getOrCreateVisitSeed(): string {
  const KEY = "voct.visit.seed";
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;
    const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    window.sessionStorage.setItem(KEY, seed);
    return seed;
  } catch (_) {
    return `${Date.now().toString(36)}`;
  }
}
