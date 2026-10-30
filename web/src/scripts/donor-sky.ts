/**
 * @file donor-sky.ts
 * @description The donors' sky on `/zaproszenie`: one star for each donor the collection counts
 *  (`fetchDonationProgress`: settled gateway donations plus the offline tallies), drawn into the
 *  band of sky round the foundation. Nothing on the page names or counts them, no caption and no
 *  number: a reader may guess what they are, and the rest see a sky. The figure is asked for once
 *  per page load. A failed request or no donors leaves the band empty and the sheet as it reads
 *  without it; there is no stand-in figure.
 *
 *  STAR k ALWAYS STANDS IN THE SAME PLACE. Its position is the k-th point of the R2 low-discrepancy
 *  sequence, nudged by a hash of k, as fractions of the band: a new donor adds one star and moves
 *  none, and no prefix of the sequence clumps or settles into a grid. Its size and brightness are
 *  hashed from k too, most of them faint and a few bright, as a real sky's are. Past `MAX_STARS`
 *  the sky draws no more.
 *
 *  THE TEXT KEEPS ITS GROUND. A star over the foundation's column is dimmed (`is-dim`), so none
 *  sits bright on a line of text, and a star on the act or within its light is not drawn
 *  (`is-veiled`). Both are read again whenever the band or the act changes size, because the
 *  column wraps with the viewport.
 *
 *  THE STARS LIGHT WITH THE GIFT. Each star carries its moment in a stagger (`--d`, oldest donor
 *  first) and the section the time the act waits for them (`--sky-span`). `styles/zaproszenie.css`
 *  lights them one after another when the act is reached (`body.give-kindled`,
 *  scripts/give-kindle.ts) and kindles the act after the last. Opacity only and once: they hold
 *  afterwards and never twinkle.
 * @module scripts/donor-sky
 */

import { fetchDonationProgress } from "../islands/landing/api/progress";

/** Past this many donors the sky draws no more stars. */
const MAX_STARS = 150;

/** The gap between two stars lighting, and the most the whole stagger may take. */
const STAGGER_STEP_MS = 120;
const STAGGER_MAX_MS = 1800;

/** How long after the last star begins the act takes its light (each star fades in over 800ms). */
const ACT_AFTER_MS = 500;

/** The R2 sequence's two generators, the inverse powers of the plastic number. */
const PLASTIC = 1.324717957244746;
const R2_X = 1 / PLASTIC;
const R2_Y = 1 / (PLASTIC * PLASTIC);

/** How far a hash may nudge a star off its sequence point, as a fraction of the band. */
const JITTER = 0.022;

/** The share of the band's height over which the sky fades out at its top and bottom edges. */
const EDGE_FADE = 0.18;

/** How far round the act a star stays undrawn, in px: clear of its halo and its flare. */
const ACT_CLEARANCE_X = 40;
const ACT_CLEARANCE_Y = 28;

/** How far beyond the column's box a star still counts as over the text, in px. */
const COLUMN_MARGIN = 10;

interface Star {
  /** Its place, as fractions of the band's width and height. */
  readonly x: number;
  readonly y: number;
  /** Its diameter in px. */
  readonly size: number;
  readonly alpha: number;
  readonly bright: boolean;
}

/** A 32-bit integer hash (lowbias32), as a fraction in [0, 1). */
function hash(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const fraction = (value: number): number => value - Math.floor(value);

const smoothstep = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Star k of the sky. It depends on k alone, so adding a donor never moves another star. */
function starAt(k: number): Star {
  const nudgeX = (hash(k * 4 + 1) - 0.5) * 2 * JITTER;
  const nudgeY = (hash(k * 4 + 2) - 0.5) * 2 * JITTER;
  const x = 0.02 + 0.96 * fraction(0.5 + R2_X * (k + 1) + nudgeX);
  const y = 0.03 + 0.94 * fraction(0.5 + R2_Y * (k + 1) + nudgeY);
  const magnitude = hash(k * 4 + 3);
  const bright = magnitude >= 0.88;
  const edge = smoothstep(Math.min(y, 1 - y) / EDGE_FADE);
  return {
    x,
    y,
    size: bright ? 2.75 : magnitude >= 0.6 ? 2 : 1.5,
    alpha: (bright ? 0.95 : 0.6 + 0.3 * hash(k * 4 + 4)) * edge,
    bright,
  };
}

export function setupDonorSky(): (() => void) | undefined {
  const layer = document.querySelector<HTMLElement>("[data-donor-sky]");
  const column = layer?.parentElement;
  const act = column?.querySelector<HTMLElement>(".zap-give-act");
  if (!layer || !column || !act) return;

  let active = true;
  let observer: ResizeObserver | undefined;

  void fetchDonationProgress().then(({ donors }) => {
    const count = Math.min(Math.floor(donors), MAX_STARS);
    if (!active || !layer.isConnected || count <= 0) return;

    const span = Math.min(STAGGER_MAX_MS, STAGGER_STEP_MS * (count - 1));
    const sky = Array.from({ length: count }, (_, k) => {
      const star = starAt(k);
      const node = document.createElement("span");
      node.className = star.bright ? "zap-donor-star is-bright" : "zap-donor-star";
      node.style.setProperty("--x", star.x.toFixed(4));
      node.style.setProperty("--y", star.y.toFixed(4));
      node.style.setProperty("--s", `${star.size}px`);
      node.style.setProperty("--a", star.alpha.toFixed(3));
      node.style.setProperty("--d", `${count > 1 ? Math.round((k / (count - 1)) * span) : 0}ms`);
      return { star, node };
    });

    const classify = (): void => {
      const band = layer.getBoundingClientRect();
      const text = column.getBoundingClientRect();
      const light = act.getBoundingClientRect();
      for (const { star, node } of sky) {
        const x = band.left + star.x * band.width;
        const y = band.top + star.y * band.height;
        const veiled =
          x > light.left - ACT_CLEARANCE_X &&
          x < light.right + ACT_CLEARANCE_X &&
          y > light.top - ACT_CLEARANCE_Y &&
          y < light.bottom + ACT_CLEARANCE_Y;
        const dim =
          !veiled &&
          x > text.left - COLUMN_MARGIN &&
          x < text.right + COLUMN_MARGIN &&
          y > text.top - COLUMN_MARGIN &&
          y < text.bottom + COLUMN_MARGIN;
        node.classList.toggle("is-veiled", veiled);
        node.classList.toggle("is-dim", dim);
      }
    };

    layer.replaceChildren(...sky.map(({ node }) => node));
    column.style.setProperty("--sky-span", `${span + ACT_AFTER_MS}ms`);
    column.dataset.sky = "";
    // The first report arrives before the stars are painted, so none shows unclassified.
    observer = new ResizeObserver(classify);
    observer.observe(layer);
    observer.observe(act);
  });

  return () => {
    active = false;
    observer?.disconnect();
  };
}
