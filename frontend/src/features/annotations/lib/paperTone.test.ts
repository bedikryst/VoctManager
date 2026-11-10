/**
 * @file paperTone.test.ts
 * @description The paper colour read round a cover: the paper's, not the ink's
 * that crosses it, nothing for white, and never a dark one.
 * @module features/annotations/lib/paperTone.test
 */

import { describe, expect, it } from "vitest";

import type { PdfPagePixels, PdfPageRegion } from "@/shared/ui/composites/PdfViewer";

import { paperToneAround, tonedContent, type PageReader } from "./paperTone";
import type { CoverPayload, MarkDraft } from "../types/annotations.dto";

/** A page of `width` × `height` px, every pixel painted by `paint`. */
const pageOf =
  (width: number, height: number, paint: (x: number, y: number) => readonly [number, number, number]): PageReader =>
  (region: PdfPageRegion): PdfPagePixels => {
    const left = Math.floor(region.x * width);
    const top = Math.floor(region.y * height);
    const w = Math.ceil((region.x + region.w) * width) - left;
    const h = Math.ceil((region.y + region.h) * height) - top;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      for (let column = 0; column < w; column++) {
        const [r, g, b] = paint(left + column, top + row);
        data.set([r, g, b, 255], (row * w + column) * 4);
      }
    }
    return { data, width: w, height: h };
  };

const CREAM = [0xf4, 0xec, 0xd8] as const;
const INK = [0x20, 0x20, 0x20] as const;
const box: CoverPayload = { x: 0.4, y: 0.4, w: 0.2, h: 0.1 };

describe("paperToneAround", () => {
  it("takes the paper's colour, not the staff lines crossing it", () => {
    // A staff line every fifth row, through the box and the ring alike.
    const page = pageOf(200, 200, (_x, y) => (y % 5 === 0 ? INK : CREAM));
    expect(paperToneAround(box, page, 200, 200)).toBe("#F4ECD8");
  });

  it("ignores what lies under the cover itself", () => {
    const page = pageOf(200, 200, (x, y) =>
      x >= 80 && x < 120 && y >= 80 && y < 100 ? INK : CREAM,
    );
    expect(paperToneAround(box, page, 200, 200)).toBe("#F4ECD8");
  });

  it("stores nothing on white paper", () => {
    const page = pageOf(200, 200, () => [255, 255, 255]);
    expect(paperToneAround(box, page, 200, 200)).toBeNull();
  });

  it("never takes a ground too dark to be paper", () => {
    const page = pageOf(200, 200, () => [0x90, 0x90, 0x90]);
    expect(paperToneAround(box, page, 200, 200)).toBeNull();
  });

  it("says nothing when the page gives no pixels", () => {
    expect(paperToneAround(box, () => null, 200, 200)).toBeNull();
  });
});

describe("tonedContent", () => {
  const draft = (payload: CoverPayload): MarkDraft => ({
    annotation_type: "CV",
    payload,
    page_number: 1,
    color: "#1F2933",
    layer_name: "personal",
  });

  it("drops a tone the cover no longer lies on", () => {
    const moved = tonedContent(draft({ ...box, tone: "#F4ECD8" }), () => null, 200, 200);
    expect(moved.payload).toEqual(box);
  });

  it("leaves any other kind as it is", () => {
    const stamp: MarkDraft = {
      annotation_type: "ST",
      payload: { x: 0.5, y: 0.5, symbol: "breath" },
      page_number: 1,
      color: "#1F2933",
      layer_name: "personal",
    };
    expect(tonedContent(stamp, pageOf(10, 10, () => CREAM), 10, 10)).toBe(stamp);
  });
});
