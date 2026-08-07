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
  /** Photographer, held apart from the caption so the two can be set in different voices. */
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
