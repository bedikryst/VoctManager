/**
 * @file imageFrame.ts
 * @description The `[data-image-open]` contract, held in one place: what a trigger publishes and
 *  what the ImageLightbox island receives. Two modules speak it — `scripts/image-triggers.ts`,
 *  which reads the attributes off the static DOM, and `islands/landing/ImageLightbox.tsx`, which
 *  renders them — and the detail grew from five fields to eleven when the frame gained a
 *  protocol, which is the size at which two hand-kept copies of an interface start to drift.
 *
 *  A SET is always dispatched, never a lone frame. One photograph is a one-item set, so the
 *  island has exactly one shape to render, and arrow navigation needed no surface migrated to
 *  reach it: a trigger without `data-image-group` simply publishes itself.
 *
 *  TWO WAYS A TRIGGER NAMES ITS SET, and which one a surface uses is decided by whether the
 *  photographs are ON the page:
 *
 *  - `data-image-group` — membership by DOM order. The gallery surfaces (`/obrazy`, a concert
 *    page) use it because every frame in the set is already rendered as its own trigger, and the
 *    reading order IS the set's order.
 *  - `data-image-set` — an authored `ImageFrameItem[]` as JSON on the ONE element that opens it,
 *    pressed at index 0. For a surface that names photographs it does not show: the colophon's
 *    `Imagines` opens a photographer's frames from her name, and there is no frame on that page to
 *    hang a group off. The alternative was a row of hidden `[data-image-open]` carriers to satisfy
 *    the DOM walk, i.e. inventing markup so a lookup mechanism would work — which is the tail
 *    wagging the dog, and unreadable six months later.
 *
 *  A trigger carrying both is answered by `data-image-set`: the authored set is the specific claim.
 *  Neither form reaches the island differently — both arrive as an `ImageFrameSet`, and the room
 *  cannot tell them apart, which is the property that keeps this an extension and not a mode.
 *
 *  Types only, plus the two event names. Nothing here may import `astro:assets` or any other
 *  virtual module — `image-triggers.ts` is a browser script and pulls whatever this file pulls.
 * @architecture Astro islands 2026
 * @module lib/imageFrame
 */

/** One photograph, as its trigger publishes it. */
export interface ImageFrameItem {
  /** Largest rendition, and the `src` fallback where `srcset` is ignored (lib/galleryFrame). */
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
  readonly alt: string;
  readonly caption?: string;
  /** Provenance, held apart from the caption so the two can be set in different voices. A
   *  FINISHED line, label included ("fot. …", "źródło: …"): the TRIGGER resolves it, because only
   *  a surface reading the concert gallery knows whether a frame has a photographer, an outlet or
   *  the ensemble itself behind it (lib/photoCredit). The room prints what it is handed and
   *  claims nothing on a caller's behalf. */
  readonly credit?: string;
  /** Intrinsic pixels of the rendition — reserves the frame's ratio before the bytes land. */
  readonly width?: number;
  readonly height?: number;
  /**
   * The rendition ALREADY on screen in the trigger, taken from its `<img>`'s `currentSrc` at
   * press time: decoded, in cache, and therefore paintable in the same frame the room opens.
   * It stands under the full photograph, blurred, until that one lands. Absent when the trigger's
   * own image has not loaded yet (a lazy frame below the fold), and the room then opens dark —
   * which is the behaviour this field exists to make rare rather than impossible.
   */
  readonly thumb?: string;
  /** Where this photograph's own evening lives. Without it the frame is a dead end. */
  readonly href?: string;
  /** What to call that destination, in the visitor's language — the exit prints it verbatim. */
  readonly hrefLabel?: string;
}

/** A set of photographs and which one was pressed. `index` is clamped by the island. */
export interface ImageFrameSet {
  readonly items: readonly ImageFrameItem[];
  readonly index: number;
}

/** Trigger → island. Carries an `ImageFrameSet`. */
export const OPEN_IMAGE_EVENT = "voct:open-image";
/** Island → triggers: the island is listening, so a press held from before hydration may fire. */
export const IMAGE_READY_EVENT = "voct:image-ready";
