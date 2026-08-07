/**
 * @file image-triggers.ts
 * @description Subpage glue for the photograph frame: a click on any `[data-image-open]` element
 *  dispatches `voct:open-image` with that shot's own data attributes, which the page's
 *  ImageLightbox island consumes. Same contract as `data-video-open` on the landing, moved into a
 *  standalone module because the galleries are static Astro on pages that run no landing script.
 *
 *  One delegated listener on the document in the CAPTURE phase, as vault-triggers.ts uses:
 *  ClientRouter's own click handler sits on the document too (bubbling, registered earlier in
 *  <head>), so anything that has to win the event must run before the bubble phase starts.
 *
 *  A click can land before the island hydrates (`client:idle` on a page whose gallery is the
 *  first thing a visitor reaches). The trigger is then HELD rather than dropped, and released on
 *  `voct:image-ready` — one slot, because a second press before hydration means the visitor
 *  changed their mind about which frame they wanted.
 * @architecture Astro islands 2026
 * @module scripts/image-triggers
 */

interface ImageDetail {
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
  readonly alt: string;
  readonly caption?: string;
  readonly credit?: string;
  readonly width?: number;
  readonly height?: number;
}

let pending: ImageDetail | null = null;

const dispatch = (detail: ImageDetail): void => {
  window.dispatchEvent(new CustomEvent<ImageDetail>("voct:open-image", { detail }));
};

/** `undefined` rather than `NaN` for an absent dimension — the island passes it straight to the
 *  `<img>`, and a NaN attribute is invalid where a missing one is merely unstated. */
const px = (value: string | undefined): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function onClick(event: MouseEvent): void {
  if (event.defaultPrevented) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const trigger = target.closest<HTMLElement>("[data-image-open]");
  if (!trigger) return;
  const src = trigger.dataset.imageSrc;
  if (!src) return;
  event.preventDefault();

  const detail: ImageDetail = {
    src,
    srcset: trigger.dataset.imageSrcset,
    sizes: trigger.dataset.imageSizes,
    alt: trigger.dataset.imageAlt ?? "",
    caption: trigger.dataset.imageCaption,
    credit: trigger.dataset.imageCredit,
    width: px(trigger.dataset.imageW),
    height: px(trigger.dataset.imageH),
  };

  if (!(window as Window & { __voctImageReady?: boolean }).__voctImageReady) {
    pending = detail;
    return;
  }
  dispatch(detail);
}

function flush(): void {
  if (!pending) return;
  const detail = pending;
  pending = null;
  dispatch(detail);
}

document.addEventListener("click", onClick, true);
window.addEventListener("voct:image-ready", flush);

// A .ts file with no import or export is a SCRIPT to TypeScript, and its top-level names then sit
// in the global scope — where `onClick` collides with vault-triggers.ts's identically named
// handler. This marks the file a module; there is nothing to export.
export {};
