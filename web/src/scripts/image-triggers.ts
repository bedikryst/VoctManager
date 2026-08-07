/**
 * @file image-triggers.ts
 * @description Page glue for the photograph frame: a press on any `[data-image-open]` element
 *  dispatches `voct:open-image` with a SET of photographs and the index of the one pressed, which
 *  the page's ImageLightbox island consumes. The set is the trigger's `data-image-group` in DOM
 *  order — the whole document on /obrazy, one evening's gallery on a concert page. Those two are
 *  the only surfaces: the landing mounts neither this module nor the island, because its Imagines
 *  panels are doors to their evening rather than triggers. A trigger with no group publishes
 *  itself as a one-item set (lib/imageFrame states the contract).
 *
 *  One delegated listener on the document in the CAPTURE phase, as vault-triggers.ts uses:
 *  ClientRouter's own click handler sits on the document too (bubbling, registered earlier in
 *  <head>), so anything that has to win the event must run before the bubble phase starts.
 *
 *  A click can land before the island hydrates (`client:idle` on a page whose gallery is the
 *  first thing a visitor reaches). The trigger is then HELD rather than dropped, and released on
 *  `voct:image-ready` — one slot, because a second press before hydration means the visitor
 *  changed their mind about which frame they wanted.
 *
 *  The import below is what makes this file a MODULE. A `.ts` file with neither an import nor an
 *  export is a script to TypeScript and its top-level names are global, where `onClick` collides
 *  with vault-triggers.ts's identically named handler; `astro check` catches it, a plain build
 *  does not. If the contract import ever goes, an `export {}` has to take its place.
 * @architecture Astro islands 2026
 * @module scripts/image-triggers
 */

import {
  IMAGE_READY_EVENT,
  OPEN_IMAGE_EVENT,
  type ImageFrameItem,
  type ImageFrameSet,
} from "../lib/imageFrame";

let pending: ImageFrameSet | null = null;

const dispatch = (detail: ImageFrameSet): void => {
  window.dispatchEvent(new CustomEvent<ImageFrameSet>(OPEN_IMAGE_EVENT, { detail }));
};

/** `undefined` rather than `NaN` for an absent dimension — the island passes it straight to the
 *  `<img>`, and a NaN attribute is invalid where a missing one is merely unstated. */
const px = (value: string | undefined): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const read = (el: HTMLElement): ImageFrameItem | null => {
  const src = el.dataset.imageSrc;
  if (!src) return null;
  return {
    src,
    srcset: el.dataset.imageSrcset,
    sizes: el.dataset.imageSizes,
    alt: el.dataset.imageAlt ?? "",
    caption: el.dataset.imageCaption,
    credit: el.dataset.imageCredit,
    width: px(el.dataset.imageW),
    height: px(el.dataset.imageH),
    // `currentSrc` is the candidate the browser actually chose and decoded, so this is a repaint
    // rather than a request. It is empty until a candidate is picked — a lazy frame the visitor
    // has not scrolled to has none, and a neighbour collected here may legitimately have none.
    thumb: el.querySelector("img")?.currentSrc || undefined,
    href: el.dataset.imageHref,
    hrefLabel: el.dataset.imageHrefLabel,
  };
};

/**
 * The set this press belongs to. Membership is `data-image-group`, order is the document's own,
 * which is also the order the reader sees — so ← and → move the way the page reads.
 *
 * Compared as a dataset value rather than matched with an attribute selector: the group names are
 * authored slugs today, and an interpolated selector would be one editorial slip away from a
 * malformed query. If the trigger is somehow not in its own group's result, it opens alone —
 * never at someone else's index, which would open a photograph nobody pressed.
 */
const collect = (trigger: HTMLElement): ImageFrameSet => {
  const own = read(trigger);
  const alone: ImageFrameSet = { items: own ? [own] : [], index: 0 };
  const group = trigger.dataset.imageGroup;
  if (!group) return alone;

  const items: ImageFrameItem[] = [];
  let index = -1;
  for (const el of document.querySelectorAll<HTMLElement>("[data-image-open]")) {
    if (el.dataset.imageGroup !== group) continue;
    const item = read(el);
    if (!item) continue;
    if (el === trigger) index = items.length;
    items.push(item);
  }
  return index < 0 ? alone : { items, index };
};

/** The full renditions already asked for, so an idle hand over a line of frames asks once. */
const preloaded = new Set<string>();

/**
 * Warm the 1920 rendition while the pointer is still on the panel. The press then paints from
 * cache instead of opening a dark room and popping — which, with the trigger's own decoded
 * rendition standing under it (`thumb`), is the difference between a frame that opens and one
 * that loads. Hover only: on touch the equivalent moment is the press itself, and the fetch would
 * be a second copy of bytes already on their way.
 */
const preload = (el: HTMLElement): void => {
  const src = el.dataset.imageSrc;
  if (!src || preloaded.has(src)) return;
  preloaded.add(src);
  const img = new Image();
  img.decoding = "async";
  // `sizes` before `srcset` before `src`: the candidate is chosen when the source set is set, and
  // an unset `sizes` at that moment means it is chosen against a 100vw default.
  if (el.dataset.imageSizes) img.sizes = el.dataset.imageSizes;
  if (el.dataset.imageSrcset) img.srcset = el.dataset.imageSrcset;
  img.src = src;
};

function onClick(event: MouseEvent): void {
  if (event.defaultPrevented) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const trigger = target.closest<HTMLElement>("[data-image-open]");
  if (!trigger) return;
  if (!trigger.dataset.imageSrc) return;
  event.preventDefault();

  const detail = collect(trigger);
  if (!detail.items.length) return;

  if (!(window as Window & { __voctImageReady?: boolean }).__voctImageReady) {
    pending = detail;
    return;
  }
  dispatch(detail);
}

function onOver(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const trigger = target.closest<HTMLElement>("[data-image-open]");
  if (trigger) preload(trigger);
}

function flush(): void {
  if (!pending) return;
  const detail = pending;
  pending = null;
  dispatch(detail);
}

document.addEventListener("click", onClick, true);
window.addEventListener(IMAGE_READY_EVENT, flush);
if (window.matchMedia("(hover: hover)").matches) {
  document.addEventListener("mouseover", onOver, { passive: true });
}
