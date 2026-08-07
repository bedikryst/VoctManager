/**
 * @file ImageLightbox.tsx
 * @description Full-screen frame for the ensemble's documentary photographs — the twin of
 *  VideoLightbox, on the same machinery. Opens on `voct:open-image` with an `ImageFrameSet`
 *  (lib/imageFrame): the set the pressed frame belongs to, plus its index. Closes on ✕ / Escape /
 *  backdrop / the mobile back button (open pushes a history entry; back pops it → close). Sets
 *  `window.__voctImageReady` and emits `voct:image-ready` so a static-DOM trigger can queue a
 *  press made before hydration.
 *
 *  It holds the INDEX, and everything the set makes possible follows from that: ← → Home End,
 *  a swipe where there is no keyboard, chevrons over the two halves of the frame, wrapping at
 *  both ends, and the neighbours warmed so the next press is a repaint. A one-item set simply
 *  renders none of it.
 *
 *  Two things that are corrections rather than features. The caption row is a LIVE REGION and is
 *  therefore always in the DOM, empty or not: a region created by the change it is meant to
 *  announce announces nothing, and moving between frames would otherwise be silent. And every
 *  frame carries an EXIT to its own evening — a lightbox that can only be closed is the dead end
 *  docs/web-imagines-spec.md §1 opens with, one layer up. The exit goes through
 *  `navigateFromOverlay`, never a bare `<a>`: pushed on top of the overlay's own entry, the
 *  destination leaves a shadow entry that eats the first back press.
 *
 *  It carries NO entrance register, and that is the rule rather than an omission: a register's
 *  half-lit rest state is justified by a node holding layout on a surface the reader is already
 *  looking at. This surface does not exist until it is asked for, so there is no hole to keep
 *  open — see the apparition clause in docs/web-landing-guardrails.md §5. The frame gets a plain
 *  authored entrance in its own stylesheet instead.
 * @architecture Astro islands 2026
 * @module islands/landing/ImageLightbox
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  IMAGE_READY_EVENT,
  OPEN_IMAGE_EVENT,
  type ImageFrameItem,
  type ImageFrameSet,
} from "../../lib/imageFrame";
import {
  dismissOverlayEntry,
  isOverlayEntry,
  navigateFromOverlay,
  pushOverlayEntry,
} from "../../lib/overlayHistory";
import { useBodyClass } from "./hooks/useBodyClass";
import { useFocusTrap } from "./hooks/useFocusTrap";

/** Stable empty set, so the effects below don't re-run on every render of a closed frame. */
const NO_ITEMS: readonly ImageFrameItem[] = [];

/** A horizontal travel shorter than this is a tap that wandered, not a swipe. */
const SWIPE_MIN_PX = 44;
/** …and one this much steeper than it is wide is the visitor trying to scroll, not to turn. */
const SWIPE_AXIS_BIAS = 1.4;

const ROMAN_STEPS = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
] as const;

/** Every number this site prints is a roman one — the register's entries, the series heads on
 *  /obrazy, the numerals under the band. The counter in the frame is the same numbering seen from
 *  inside, so it is set the same way. Local because the counter is its only caller; the numerals
 *  elsewhere are authored, not computed. */
function roman(n: number): string {
  let rest = n;
  let out = "";
  for (const [value, sign] of ROMAN_STEPS) {
    while (rest >= value) {
      out += sign;
      rest -= value;
    }
  }
  return out;
}

/** Ask for a rendition without rendering it — the browser keeps it, the next press paints it. */
function warm(item: ImageFrameItem | undefined): void {
  if (!item) return;
  const img = new Image();
  img.decoding = "async";
  if (item.sizes) img.sizes = item.sizes;
  if (item.srcset) img.srcset = item.srcset;
  img.src = item.src;
}

export function ImageLightbox(): React.JSX.Element | null {
  const [set, setSet] = useState<ImageFrameSet | null>(null);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  // A swipe that lifts off over a half also fires that half's click — no scroll happened, so the
  // browser synthesises one — and the frame would turn twice for one gesture. The gesture claims
  // the press; the next touchstart hands it back.
  const swipedRef = useRef(false);

  const close = useCallback((): void => setSet(null), []);
  const isOpen = set !== null;
  const items = set?.items ?? NO_ITEMS;
  const count = items.length;
  const current = items[index];
  const many = count > 1;

  // Wrapping is deliberate: a set is a line of frames from one evening (or one archive), and a
  // line the reader can fall off the end of asks them to remember where the end was.
  const go = useCallback(
    (delta: number): void => {
      setIndex((i) => (count > 0 ? (i + delta + count) % count : 0));
    },
    [count],
  );

  // User-initiated close routes through `dismiss`: pop the entry we pushed on open (→ popstate →
  // close) so no "swallowed" back press lingers; a genuine back / edge-swipe lands straight in the
  // popstate handler. Falls back to a direct close if our entry isn't on top (defensive).
  const dismiss = useCallback((): void => {
    dismissOverlayEntry("imageOpen", close);
  }, [close]);

  useBodyClass(isOpen ? "image-open" : null);
  useFocusTrap(panelRef, isOpen, { onEscape: dismiss });

  useEffect(() => {
    (window as Window & { __voctImageReady?: boolean }).__voctImageReady = true;
    window.dispatchEvent(new Event(IMAGE_READY_EVENT));
    const onOpen = (event: Event): void => {
      const detail = (event as CustomEvent<ImageFrameSet>).detail;
      if (!detail?.items?.length) return;
      setSet(detail);
      setIndex(Math.min(Math.max(detail.index, 0), detail.items.length - 1));
    };
    window.addEventListener(OPEN_IMAGE_EVENT, onOpen);
    return () => {
      (window as Window & { __voctImageReady?: boolean }).__voctImageReady = false;
      window.removeEventListener(OPEN_IMAGE_EVENT, onOpen);
    };
  }, []);

  // The full rendition arrives after the room does, so the frame starts on the trigger's own
  // decoded thumbnail and turns over when the real one lands. `complete` is checked as well as
  // `onLoad` because a rendition already in cache — every neighbour, and anything hovered before
  // the press — can finish loading before React attaches the handler, and that press is exactly
  // the one that must not stay blurred.
  useEffect(() => {
    setLoaded(imgRef.current?.complete === true);
  }, [isOpen, current?.src]);

  // Both neighbours, so a walk in either direction is a repaint. Two files, asked for once each
  // per step, against a set whose whole point is that the visitor keeps pressing →.
  useEffect(() => {
    if (!isOpen || count < 2) return;
    warm(items[(index + 1) % count]);
    warm(items[(index - 1 + count) % count]);
  }, [isOpen, index, count, items]);

  useEffect(() => {
    if (!isOpen || count < 2) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "Home") setIndex(0);
      else if (event.key === "End") setIndex(count - 1);
      else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, count, go]);

  // History integration: open → push a hash-marked entry via ClientRouter's navigate() (see
  // overlayHistory.ts — a raw pushState made the router re-swap the whole document on back), so
  // the mobile back button / edge-swipe dismisses the frame instead of leaving the page. The
  // popstate gate is NOT optional: the router can dispatch a synthetic popstate right after our
  // own push, and a forward re-traversal onto a stranded entry fires one too — neither is a
  // dismissal, and without the gate the frame closes the instant it opens. No #obraz element
  // exists, so nothing scrolls on open. Walking the set pushes NOTHING: forty-three history
  // entries for one visit to /obrazy would make the back button useless, and the frame is one
  // surface however many photographs pass through it.
  useEffect(() => {
    if (!isOpen) return;
    pushOverlayEntry("imageOpen", "obraz");
    const onPop = (): void => {
      if (!isOverlayEntry("imageOpen")) close();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen, close]);

  const onTouchStart = useCallback((event: React.TouchEvent): void => {
    swipedRef.current = false;
    const touch = event.touches[0];
    touchRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, []);

  const onTouchEnd = useCallback(
    (event: React.TouchEvent): void => {
      const start = touchRef.current;
      touchRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch || count < 2) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_BIAS) return;
      swipedRef.current = true;
      // Carried leftwards means the next frame comes in from the right — the page's own direction.
      go(dx < 0 ? 1 : -1);
    },
    [count, go],
  );

  /** What the two halves call. A press the swipe already spent is swallowed here, once. */
  const step = useCallback(
    (delta: number): void => {
      if (swipedRef.current) {
        swipedRef.current = false;
        return;
      }
      go(delta);
    },
    [go],
  );

  const leave = useCallback((event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const href = event.currentTarget.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    void navigateFromOverlay("imageOpen", href);
  }, []);

  if (!set || !current) return null;

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Powiększone zdjęcie">
      {/* data-cursor="no-snap": full-viewport surface — the magnetic cursor snap would
          yank the cursor toward the screen centre everywhere around the frame. */}
      <button
        type="button"
        className="image-lightbox-backdrop"
        aria-label="Zamknij"
        data-cursor="no-snap"
        onClick={dismiss}
        tabIndex={-1}
      />
      <div className="image-lightbox-panel" data-lenis-prevent ref={panelRef}>
        <button type="button" className="image-lightbox-close" aria-label="Zamknij" onClick={dismiss}>
          ✕
        </button>
        <figure className="image-lightbox-figure">
          {/* The stage is the photograph's own box — `width: fit-content` tracks the rendered
              width, height cap included, which is what the panel around it already relies on to
              hang the ✕ at the frame's corner. Everything else here is absolute inside it: the
              backdrop thumbnail so it cannot size anything, the two halves so they cover the
              photograph exactly and nothing else.

              The swipe is bound HERE and not to the panel: a horizontal drag that lifted off over
              the exit link would otherwise both turn the frame and follow the link. Over the
              photograph the only things under the finger are the two halves, and the gesture
              knows how to disarm those (`step`). */}
          <div
            className="image-lightbox-stage"
            data-loaded={loaded ? "true" : "false"}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {current.thumb && (
              <img
                className="image-lightbox-thumb"
                src={current.thumb}
                alt=""
                aria-hidden="true"
                decoding="sync"
              />
            )}
            {/* Keyed by src: without it React keeps the node and swaps the attribute, and the
                previous photograph stays painted under a `loaded` flag that has already gone
                false — a frame showing one image while the caption names another. */}
            <img
              key={current.src}
              ref={imgRef}
              className="image-lightbox-img"
              src={current.src}
              srcSet={current.srcset}
              sizes={current.sizes}
              width={current.width}
              height={current.height}
              alt={current.alt}
              decoding="async"
              onLoad={() => setLoaded(true)}
              // A rendition that fails leaves the blurred ground standing over nothing. Turning
              // the frame over anyway prints the browser's broken-image box and, with it, the alt
              // — which is the only honest thing left to show.
              onError={() => setLoaded(true)}
            />
            {many && (
              <>
                {/* The two halves of the frame ARE the controls — a chevron pinned to an edge
                    would be a small target on the one surface where the whole photograph is
                    already under the hand, and the cursor states the direction across the entire
                    half (data-cursor, cursor.css). Buttons rather than a click handler on the
                    image, so the keyboard reaches them and a screen reader is told what they do. */}
                <button
                  type="button"
                  className="image-lightbox-nav is-prev"
                  data-cursor="frame-prev"
                  aria-label="Poprzedni kadr"
                  onClick={() => step(-1)}
                >
                  <span className="image-lightbox-chevron" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="image-lightbox-nav is-next"
                  data-cursor="frame-next"
                  aria-label="Następny kadr"
                  onClick={() => step(1)}
                >
                  <span className="image-lightbox-chevron" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          {/* Always rendered, even with nothing in it: a live region has to be in the document
              BEFORE the change it announces, or the first move between frames is silent. The alt
              is repeated into it for the same reason — a screen reader does not re-read an `alt`
              that changed under it, so "IV / IX" alone would be the whole of what a reader who
              cannot see the photograph is told about the new one. */}
          <figcaption className="image-lightbox-caption" aria-live="polite">
            {many && (
              <span className="image-lightbox-count">
                {roman(index + 1)} / {roman(count)}
              </span>
            )}
            {current.caption && <span className="image-lightbox-place">{current.caption}</span>}
            {current.credit && <span className="image-lightbox-credit">fot. {current.credit}</span>}
            {current.alt && <span className="sr-only">{current.alt}</span>}
          </figcaption>
        </figure>
        {current.href && (
          <div className="image-lightbox-foot">
            {/* Instrumented, because the question this exit was built to answer is whether it is
                used at all — the frame's dead end was found by reading the markup, and only a
                number says whether closing it changed anything. */}
            <a
              className="image-lightbox-exit plausible-event-name=obraz+wyjscie"
              href={current.href}
              onClick={leave}
            >
              {current.hrefLabel ?? "Zobacz wieczór"} <span aria-hidden="true">→</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
