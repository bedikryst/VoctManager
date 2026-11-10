/**
 * @file paperTone.ts
 * @description The paper colour a cover takes, so that on a scanned page, whose
 * ground is grey or cream, the cover reads as paper rather than a white patch.
 *
 * Read from the rendered page just outside the cover's edges, when a cover is
 * placed and again when one is moved, and stored with it (`payload.tone`), so
 * every screen and print paint the same colour. What lies round a printed sign
 * is mostly paper crossed by staff lines and stems, so the tone is a high
 * percentile of each channel, never the mean: the mean is pulled grey by the
 * very ink the cover sits among. A tone near white is white and is not stored,
 * and a dark one is never a paper (the server's `PAPER_TONE_FLOOR`).
 *
 * The stand works without this: a cover with no tone is white.
 * @module features/annotations/lib
 */

import type { PdfPagePixels, PdfPageRegion } from "@/shared/ui/composites/PdfViewer";

import type { CoverPayload, MarkContent } from "../types/annotations.dto";

/** Reads the rendered page's own pixels in a region, or null. */
export type PageReader = (region: PdfPageRegion) => PdfPagePixels | null;

/** How far round the cover the paper is read, in page pixels. */
const RING_PX = 6;
/** Which share of the ring is darker than the tone taken, per channel. */
const PAPER_PERCENTILE = 0.9;
/** The darkest channel a paper may have: the server's `PAPER_TONE_FLOOR`. */
const PAPER_TONE_FLOOR = 0xc0;
/** A tone with every channel at least this light is white, and is not stored. */
const WHITE_FROM = 0xfb;

const hex = (value: number): string => value.toString(16).padStart(2, "0").toUpperCase();

/**
 * The paper's colour in the ring round `cover` on a page `width` × `height`
 * px, as `#RRGGBB`; null for white, for a ground too dark to be paper, and when
 * the page gives no pixels.
 */
export const paperToneAround = (
  cover: CoverPayload,
  read: PageReader,
  width: number,
  height: number,
): string | null => {
  if (width <= 0 || height <= 0) return null;
  const rx = RING_PX / width;
  const ry = RING_PX / height;
  const x0 = Math.max(0, cover.x - rx);
  const y0 = Math.max(0, cover.y - ry);
  const x1 = Math.min(1, cover.x + cover.w + rx);
  const y1 = Math.min(1, cover.y + cover.h + ry);
  const region = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const image = read(region);
  if (!image || image.width === 0 || image.height === 0) return null;

  const histograms = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let count = 0;
  for (let row = 0; row < image.height; row++) {
    const y = region.y + ((row + 0.5) / image.height) * region.h;
    const insideRow = y >= cover.y && y <= cover.y + cover.h;
    for (let column = 0; column < image.width; column++) {
      if (insideRow) {
        const x = region.x + ((column + 0.5) / image.width) * region.w;
        if (x >= cover.x && x <= cover.x + cover.w) continue;
      }
      const at = (row * image.width + column) * 4;
      // Only what the page painted: a pixel it left clear is not paper.
      if (image.data[at + 3] < 255) continue;
      histograms[0][image.data[at]] += 1;
      histograms[1][image.data[at + 1]] += 1;
      histograms[2][image.data[at + 2]] += 1;
      count += 1;
    }
  }
  if (count === 0) return null;

  const rank = Math.ceil(count * PAPER_PERCENTILE);
  const channels = histograms.map((histogram) => {
    let seen = 0;
    for (let value = 0; value < 256; value++) {
      seen += histogram[value];
      if (seen >= rank) return value;
    }
    return 255;
  });
  if (channels.some((value) => value < PAPER_TONE_FLOOR)) return null;
  if (channels.every((value) => value >= WHITE_FROM)) return null;
  return `#${channels.map(hex).join("")}`;
};

/** A cover with the tone of the paper round it now; without one on white paper. */
export const withPaperTone = (
  cover: CoverPayload,
  read: PageReader | undefined,
  width: number,
  height: number,
): CoverPayload => {
  const box: CoverPayload = { x: cover.x, y: cover.y, w: cover.w, h: cover.h };
  const tone = read ? paperToneAround(box, read, width, height) : null;
  return tone ? { ...box, tone } : box;
};

type CoverContent = Extract<MarkContent, { annotation_type: "CV" }>;

const isCoverContent = (content: MarkContent): content is CoverContent =>
  content.annotation_type === "CV";

/** A mark's content with a cover's tone read afresh where it now lies; any other kind as it is. */
export const tonedContent = <T extends MarkContent>(
  content: T,
  read: PageReader | undefined,
  width: number,
  height: number,
): T =>
  isCoverContent(content)
    ? { ...content, payload: withPaperTone(content.payload, read, width, height) }
    : content;
