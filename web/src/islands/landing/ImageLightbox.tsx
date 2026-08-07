/**
 * @file ImageLightbox.tsx
 * @description Full-screen frame for one documentary photograph — the twin of VideoLightbox,
 *  on the same machinery. Opens on `voct:open-image` ({ src, srcset?, sizes?, alt, caption?,
 *  credit?, width?, height? }), closes on ✕ / Escape / backdrop / the mobile back button (open
 *  pushes a history entry; back pops it → close). Sets `window.__voctImageReady` and emits
 *  `voct:image-ready` so a static-DOM trigger can queue a click made before hydration.
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

import { dismissOverlayEntry, isOverlayEntry, pushOverlayEntry } from "../../lib/overlayHistory";
import { useBodyClass } from "./hooks/useBodyClass";
import { useFocusTrap } from "./hooks/useFocusTrap";

interface OpenDetail {
  readonly src: string;
  /** Responsive candidates for the full-size rendition; the grid thumbnail's set is too small. */
  readonly srcset?: string;
  readonly sizes?: string;
  readonly alt: string;
  readonly caption?: string;
  /** Photographer, held apart from the caption so the two can be set in different voices. */
  readonly credit?: string;
  /** Intrinsic pixels of the rendition — reserves the frame's ratio before the bytes land. */
  readonly width?: number;
  readonly height?: number;
}

export function ImageLightbox(): React.JSX.Element | null {
  const [open, setOpen] = useState<OpenDetail | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((): void => setOpen(null), []);
  const isOpen = open !== null;

  // User-initiated close routes through `dismiss`: pop the entry we pushed on open (→ popstate →
  // close) so no "swallowed" back press lingers; a genuine back / edge-swipe lands straight in the
  // popstate handler. Falls back to a direct close if our entry isn't on top (defensive).
  const dismiss = useCallback((): void => {
    dismissOverlayEntry("imageOpen", close);
  }, [close]);

  useBodyClass(open ? "image-open" : null);
  useFocusTrap(panelRef, isOpen, { onEscape: dismiss });

  useEffect(() => {
    (window as Window & { __voctImageReady?: boolean }).__voctImageReady = true;
    window.dispatchEvent(new Event("voct:image-ready"));
    const onOpen = (event: Event): void => {
      const detail = (event as CustomEvent<OpenDetail>).detail;
      if (!detail?.src) return;
      setOpen(detail);
    };
    window.addEventListener("voct:open-image", onOpen);
    return () => {
      (window as Window & { __voctImageReady?: boolean }).__voctImageReady = false;
      window.removeEventListener("voct:open-image", onOpen);
    };
  }, []);

  // History integration: open → push a hash-marked entry via ClientRouter's navigate() (see
  // overlayHistory.ts — a raw pushState made the router re-swap the whole document on back), so
  // the mobile back button / edge-swipe dismisses the frame instead of leaving the page. The
  // popstate gate is NOT optional: the router can dispatch a synthetic popstate right after our
  // own push, and a forward re-traversal onto a stranded entry fires one too — neither is a
  // dismissal, and without the gate the frame closes the instant it opens. No #obraz element
  // exists, so nothing scrolls on open.
  useEffect(() => {
    if (!isOpen) return;
    pushOverlayEntry("imageOpen", "obraz");
    const onPop = (): void => {
      if (!isOverlayEntry("imageOpen")) close();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen, close]);

  if (!open) return null;

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
          <img
            className="image-lightbox-img"
            src={open.src}
            srcSet={open.srcset}
            sizes={open.sizes}
            width={open.width}
            height={open.height}
            alt={open.alt}
            decoding="async"
          />
          {(open.caption || open.credit) && (
            <figcaption className="image-lightbox-caption">
              {open.caption && <span className="image-lightbox-place">{open.caption}</span>}
              {open.credit && <span className="image-lightbox-credit">fot. {open.credit}</span>}
            </figcaption>
          )}
        </figure>
      </div>
    </div>
  );
}
