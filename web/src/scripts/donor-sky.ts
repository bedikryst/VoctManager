/**
 * @file donor-sky.ts
 * @description The sky round the gift on `/zaproszenie`: `STAR_COUNT` stars drawn into the band of
 *  sky round the foundation, under the sentence that names the donors. They stand for the donors
 *  and count none of them: the number is fixed, so the sky reads as full whatever the collection
 *  holds, and nothing on the page explains them. Drawn by script because their dimming depends on
 *  where the text falls; without JavaScript the band stays empty and the act keeps its candle glow.
 *
 *  STAR k ALWAYS STANDS IN THE SAME PLACE. Its position is the k-th point of the R2 low-discrepancy
 *  sequence, nudged by a hash of k, as fractions of the band, so the sky neither clumps nor settles
 *  into a grid and is the same sky on every visit. Its size and brightness are hashed from k too,
 *  most of them faint and a few bright, as a real sky's are.
 *
 *  THE TEXT KEEPS ITS GROUND. A star over the foundation's column is dimmed (`is-dim`), so none
 *  sits bright on a line of text, and a star on the act or within its light is not drawn
 *  (`is-veiled`). Both are read again whenever the band or the act changes size, because the
 *  column wraps with the viewport.
 *
 *  THE STARS LIGHT AS THE FOUNDATION ARRIVES. Once the section's top passes the lower fifth of the
 *  viewport, `data-sky-lit` is set and `styles/zaproszenie.css` lights the stars one after another
 *  (`--d`, over `LIGHTING_MS`), well before the act is reached; the act then kindles with the bar's
 *  WESPRZYJ (scripts/give-kindle.ts), not after the stars. Opacity only and once: they hold
 *  afterwards and never twinkle.
 * @module scripts/donor-sky
 */

/** How many stars the sky holds. */
const STAR_COUNT = 70;

/** The span over which the stars light, first to last. */
const LIGHTING_MS = 1400;

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

/** Star k of the sky. It depends on k alone. */
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

  const sky = Array.from({ length: STAR_COUNT }, (_, k) => {
    const star = starAt(k);
    const node = document.createElement("span");
    node.className = star.bright ? "zap-donor-star is-bright" : "zap-donor-star";
    node.style.setProperty("--x", star.x.toFixed(4));
    node.style.setProperty("--y", star.y.toFixed(4));
    node.style.setProperty("--s", `${star.size}px`);
    node.style.setProperty("--a", star.alpha.toFixed(3));
    node.style.setProperty("--d", `${Math.round((k / (STAR_COUNT - 1)) * LIGHTING_MS)}ms`);
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
  column.dataset.sky = "";
  // The first report arrives before the stars are painted, so none shows unclassified.
  const sizes = new ResizeObserver(classify);
  sizes.observe(layer);
  sizes.observe(act);

  // Reached = on screen, or already above it: a back navigation restores the scroll position past
  // the section, and the observer's first report then says "not intersecting".
  const arrival = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting || entry.boundingClientRect.top < 0)) return;
      column.dataset.skyLit = "";
      arrival.disconnect();
    },
    { rootMargin: "0px 0px -20% 0px" },
  );
  arrival.observe(column);

  return () => {
    sizes.disconnect();
    arrival.disconnect();
  };
}
