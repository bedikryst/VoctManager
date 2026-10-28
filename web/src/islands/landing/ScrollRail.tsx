/**
 * @file ScrollRail.tsx
 * @description The landing's scrollbar. The public site hides the native one (styles/base.css)
 *  and scrolls through Lenis, so on a desktop this rail is the only cue for where the reader
 *  stands in a page some twenty screens long.
 *
 *  It stays off the hero: the film is the page's opening composition, and the rail rises only
 *  once the reader has scrolled ~60% of a screen into the page, when the film is already leaving.
 *  From there it rests as a hairline at the window's right edge with a thumb at the scroll
 *  position.
 *
 *  A pointer on the right edge opens it: the three movements stand as notches at their own scroll
 *  positions, each with a plate carrying its Polish name and its Latin inscription, and a plate
 *  click travels there through Lenis. The thumb drags (Lenis, immediate), and a press anywhere on
 *  the rail brings the thumb under the pointer first, as a native scrollbar does. While the thumb
 *  is held it names the movement it stands in, and the name leaves ~600ms after the release.
 *  Nothing is named while the reader merely scrolls: a label that appears mid-read pulls the eye
 *  off the page and reads as a fault.
 *
 *  Each plate takes the ground of what lies under IT, probed at its own height with the bar's
 *  list of dark surfaces (lib/darkSurfaces) — not the bar's verdict, which describes the top of
 *  the screen. The probe is a hit test, so it runs only while plates are visible (rail open or
 *  thumb held), at most once a frame; at rest the scroll tick reads Lenis's own numbers and
 *  writes the thumb's transform, nothing else.
 *
 *  `aria-hidden` and unfocusable by design: the movements are landmarks (`section[aria-label]`),
 *  which is how a keyboard and a screen reader already move through the page, and a control a
 *  screen reader cannot announce must not take focus either.
 * @module islands/landing/ScrollRail
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DARK_SURFACES } from "./lib/darkSurfaces";

type MovementKey = "lumen" | "vox" | "sustinete";

interface Movement {
  readonly key: MovementKey;
  readonly latin: string;
}

/** Order and inscriptions as the page prints them (`data-movement` in LandingPage.astro). */
const MOVEMENTS: readonly Movement[] = [
  { key: "lumen", latin: "Lumen Christi" },
  { key: "vox", latin: "Vox memoriae" },
  { key: "sustinete", latin: "Sustinete nos" },
];

/** Night for a plate: the bar's dark surfaces plus the two it has no verdict for — the hero, where
 *  the bar is transparent, and the announcement band under it. */
const NIGHT = `${DARK_SURFACES}, .hero, .proximum`;

interface LenisLike {
  readonly scroll: number;
  scrollTo: (
    target: number | HTMLElement,
    opts?: { duration?: number; offset?: number; immediate?: boolean },
  ) => void;
}

interface Geometry {
  /** Track and thumb heights, px. */
  readonly track: number;
  readonly thumb: number;
  /** The scroll limit and the viewport height, px. */
  readonly limit: number;
  readonly view: number;
  /** Document offset of each movement's top, in MOVEMENTS order; NaN where a section is absent. */
  readonly tops: readonly number[];
}

interface Drag {
  /** The track's top edge in client coordinates, read once at the press. */
  readonly trackTop: number;
  /** Where on the thumb the pointer holds it, px from the thumb's top. */
  readonly grip: number;
}

/** Which plates stand on night: one per movement, and the thumb's own. */
interface Grounds {
  readonly ticks: readonly boolean[];
  readonly say: boolean;
}

/** The share of a screen the reader scrolls before the rail rises off the hero. */
const HERO_SHARE = 0.6;
/** How long the thumb's name stays after the thumb is released. */
const NAME_LINGER_MS = 600;
/** The thumb's shortest length, so it stays a target on the longest page. */
const MIN_THUMB = 28;
/** Where a tick's jump lands: the movement's top 10px under the window's top edge. */
const JUMP_OFFSET = -10;
const JUMP_DURATION = 1.2;
/** Probe column, px from the window's right edge: past the 24px pointer zone, inside every plate. */
const PROBE_INSET = 64;

const LIGHT: Grounds = { ticks: MOVEMENTS.map(() => false), say: false };

const lenisOf = (): LenisLike | undefined =>
  (window as unknown as { __lenis?: LenisLike }).__lenis;

const currentScroll = (): number => lenisOf()?.scroll ?? window.scrollY;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Rail-local px of a scroll position's thumb CENTRE, which is where a tick for it stands. */
const centreAt = (g: Geometry, scroll: number): number =>
  (g.limit > 0 ? clamp01(scroll / g.limit) : 0) * (g.track - g.thumb) + g.thumb / 2;

/** The movement spanning the viewport's centre line; -1 above movement I. */
const movementAt = (g: Geometry, scroll: number): number => {
  const probe = scroll + g.view / 2;
  let found = -1;
  g.tops.forEach((top, i) => {
    if (probe >= top) found = i;
  });
  return found;
};

/** Whether the page under a client point is a night surface, looking through the rail itself. */
const nightAt = (rail: HTMLElement, x: number, y: number): boolean => {
  for (const el of document.elementsFromPoint(x, y)) {
    if (rail.contains(el)) continue;
    return el.closest(NIGHT) !== null;
  }
  return false;
};

const sameGrounds = (a: Grounds, b: Grounds): boolean =>
  a.say === b.say && a.ticks.every((v, i) => v === b.ticks[i]);

interface ScrollRailProps {
  /** The movements' names in the page's language (a chrome triple, `railNames`). */
  readonly names: Readonly<Record<MovementKey, string>>;
}

export function ScrollRail({ names }: ScrollRailProps): React.JSX.Element {
  const railRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const geo = useRef<Geometry>({ track: 0, thumb: MIN_THUMB, limit: 0, view: 0, tops: [] });
  const tickRef = useRef<readonly (number | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const openRef = useRef(false);
  const activeRef = useRef(-1);
  const pastRef = useRef(false);
  const namingRef = useRef(false);
  const lingerRef = useRef<number | null>(null);
  const groundFrame = useRef<number | null>(null);

  // Tick centres stay null until the first measurement, so the server's markup carries none and
  // hydration matches it.
  const [ticks, setTicks] = useState<readonly (number | null)[] | null>(null);
  const [active, setActive] = useState(-1);
  const [past, setPast] = useState(false);
  const [naming, setNaming] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [grounds, setGrounds] = useState<Grounds>(LIGHT);

  const paint = useCallback((scroll: number): void => {
    const g = geo.current;
    const thumb = thumbRef.current;
    if (thumb) {
      const y = centreAt(g, scroll) - g.thumb / 2;
      thumb.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    }
    const idx = movementAt(g, scroll);
    if (idx !== activeRef.current) {
      activeRef.current = idx;
      setActive(idx);
    }
    const beyond = scroll > g.view * HERO_SHARE;
    if (beyond !== pastRef.current) {
      pastRef.current = beyond;
      setPast(beyond);
    }
  }, []);

  const readGrounds = useCallback((): void => {
    groundFrame.current = null;
    const rail = railRef.current;
    if (!rail) return;
    const top = rail.getBoundingClientRect().top;
    const x = window.innerWidth - PROBE_INSET;
    const next: Grounds = {
      ticks: MOVEMENTS.map((_, i) => {
        const y = tickRef.current[i];
        return y != null && nightAt(rail, x, top + y);
      }),
      say: nightAt(rail, x, top + centreAt(geo.current, currentScroll())),
    };
    setGrounds((prev) => (sameGrounds(prev, next) ? prev : next));
  }, []);

  const groundSoon = useCallback((): void => {
    if (groundFrame.current === null) {
      groundFrame.current = window.requestAnimationFrame(readGrounds);
    }
  }, [readGrounds]);

  const name = useCallback((on: boolean): void => {
    if (on === namingRef.current) return;
    namingRef.current = on;
    setNaming(on);
  }, []);

  useEffect(() => {
    let frame: number | null = null;

    const measure = (): void => {
      frame = null;
      const track = trackRef.current;
      const thumbEl = thumbRef.current;
      if (!track || !thumbEl) return;
      const view = window.innerHeight;
      const height = document.documentElement.scrollHeight;
      const trackHeight = track.clientHeight;
      const thumb = Math.min(
        trackHeight,
        Math.max(MIN_THUMB, Math.round((trackHeight * view) / Math.max(height, 1))),
      );
      const y = window.scrollY;
      const tops = MOVEMENTS.map((m) => {
        const el = document.querySelector<HTMLElement>(`[data-movement="${m.key}"]`);
        return el ? el.getBoundingClientRect().top + y : Number.NaN;
      });
      const g: Geometry = { track: trackHeight, thumb, limit: Math.max(0, height - view), view, tops };
      geo.current = g;
      thumbEl.style.height = `${thumb}px`;
      const centres = tops.map((top) => (Number.isFinite(top) ? centreAt(g, top) : null));
      tickRef.current = centres;
      setTicks(centres);
      paint(currentScroll());
      if (openRef.current || drag.current) groundSoon();
    };
    const schedule = (): void => {
      if (frame === null) frame = window.requestAnimationFrame(measure);
    };

    // Body size covers late images, reveals that change height and font swaps; the window's
    // covers the viewport, which the body's box does not follow.
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    void document.fonts.ready.then(schedule);
    schedule();

    const onScroll = (): void => {
      paint(currentScroll());
      // The page moves under visible plates, so their grounds are read again; a closed rail
      // shows no plate and reads nothing.
      if (openRef.current || drag.current) groundSoon();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("load", schedule);
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (groundFrame.current !== null) window.cancelAnimationFrame(groundFrame.current);
      if (lingerRef.current !== null) window.clearTimeout(lingerRef.current);
    };
  }, [paint, groundSoon]);

  const seek = (clientY: number): void => {
    const d = drag.current;
    const g = geo.current;
    if (!d || g.track <= g.thumb) return;
    const target = clamp01((clientY - d.trackTop - d.grip) / (g.track - g.thumb)) * g.limit;
    const lenis = lenisOf();
    if (lenis) lenis.scrollTo(target, { immediate: true });
    else window.scrollTo(0, target);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    const g = geo.current;
    if (event.button !== 0 || g.track <= g.thumb || g.limit <= 0) return;
    event.preventDefault();
    const trackTop = event.currentTarget.getBoundingClientRect().top;
    const thumbTop = centreAt(g, currentScroll()) - g.thumb / 2;
    const local = event.clientY - trackTop;
    const onThumb = local >= thumbTop && local <= thumbTop + g.thumb;
    drag.current = { trackTop, grip: onThumb ? local - thumbTop : g.thumb / 2 };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (lingerRef.current !== null) window.clearTimeout(lingerRef.current);
    setDragging(true);
    name(true);
    groundSoon();
    if (!onThumb) seek(event.clientY);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (drag.current) seek(event.clientY);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    lingerRef.current = window.setTimeout(() => {
      lingerRef.current = null;
      name(false);
    }, NAME_LINGER_MS);
  };

  const onEnter = (): void => {
    openRef.current = true;
    groundSoon();
  };

  const onLeave = (): void => {
    openRef.current = false;
  };

  const onJump = (key: MovementKey): void => {
    const target = document.querySelector<HTMLElement>(`[data-movement="${key}"]`);
    if (!target) return;
    const lenis = lenisOf();
    if (lenis) {
      lenis.scrollTo(target, { duration: JUMP_DURATION, offset: JUMP_OFFSET });
    } else {
      // No Lenis on a fine pointer means reduced motion: the jump is a cut.
      window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY + JUMP_OFFSET);
    }
  };

  const current = active >= 0 ? MOVEMENTS[active] : undefined;
  // A held thumb keeps the rail up even when dragged back onto the hero.
  const shown = ticks !== null && (past || dragging);

  return (
    <div
      ref={railRef}
      className={`scroll-rail${shown ? " is-shown" : ""}${dragging ? " is-dragging" : ""}${naming && current ? " is-naming" : ""}`}
      aria-hidden="true"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <div
        ref={trackRef}
        className="scroll-rail-track"
        data-cursor="no-snap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="scroll-rail-line" />
        {MOVEMENTS.map((m, i) => {
          const y = ticks?.[i];
          return y == null ? null : (
            <span
              key={m.key}
              className={`scroll-rail-notch${i === active ? " is-active" : ""}`}
              style={{ top: `${y.toFixed(1)}px` }}
            />
          );
        })}
        <div ref={thumbRef} className="scroll-rail-thumb">
          <span className="scroll-rail-bar" />
          {current && (
            <span className={`scroll-rail-plate scroll-rail-say${grounds.say ? " is-night" : ""}`}>
              <span className="scroll-rail-name">{names[current.key]}</span>
              <span className="scroll-rail-dot">·</span>
              <span className="scroll-rail-latin">{current.latin}</span>
            </span>
          )}
        </div>
      </div>
      {MOVEMENTS.map((m, i) => {
        const y = ticks?.[i];
        return y == null ? null : (
          <button
            key={m.key}
            type="button"
            tabIndex={-1}
            className={`scroll-rail-plate scroll-rail-tick${i === active ? " is-active" : ""}${grounds.ticks[i] ? " is-night" : ""}`}
            style={{ top: `${y.toFixed(1)}px` }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onJump(m.key)}
          >
            <span className="scroll-rail-name">{names[m.key]}</span>
            <span className="scroll-rail-dot">·</span>
            <span className="scroll-rail-latin">{m.latin}</span>
          </button>
        );
      })}
    </div>
  );
}
