/**
 * @file selection.test.ts
 * @description What the selection card's gestures write: a moved selection
 * kept whole on the page, and copies that keep their audience but never an ink
 * the writer may not use.
 *
 * The failures this guards would land quietly: a slur dragged into the margin
 * folding flat against the edge, and a copy in the conductor's reserved ink
 * that the server refuses outright, so the paste looks done and saves nothing.
 * @module features/annotations/lib/selection.test
 */

import { describe, expect, it } from "vitest";

import { clampShift, copyDrafts, duplicateShift, shiftedContent } from "./selection";
import { ANNOTATION_INKS, inksFor } from "./palette";
import type { MarkContent, ScoreAnnotation } from "../types/annotations.dto";

const row = (id: string, content: MarkContent, over: Partial<ScoreAnnotation> = {}): ScoreAnnotation =>
  ({
    id,
    edition: "edition-1",
    page_number: 3,
    color: "#2563EB",
    layer_name: "shared",
    created_by: "user-1",
    created_at: "2026-10-27T10:00:00Z",
    updated_at: "2026-10-27T10:00:00Z",
    ...content,
    ...over,
  }) as ScoreAnnotation;

const slur = row("slur", {
  annotation_type: "FH",
  payload: {
    paths: [
      [
        [0.7, 0.5],
        [0.8, 0.45],
        [0.9, 0.5],
      ],
    ],
    width: 0.004,
  },
});
const breath = row("breath", {
  annotation_type: "ST",
  payload: { x: 0.75, y: 0.4, symbol: "breath" },
});

describe("a selection moved", () => {
  it("moves where a jump link sits and never where it leads", () => {
    const link = row("ds", {
      annotation_type: "LK",
      payload: { x: 0.9, y: 0.9, target_page: 1, target_y: 0.3 },
    });
    expect(clampShift([link], { dx: 0.5, dy: 0 }).dx).toBeCloseTo(0.1);
    expect(shiftedContent(link, { dx: -0.4, dy: -0.1 })).toEqual({
      annotation_type: "LK",
      payload: { x: 0.5, y: 0.8, target_page: 1, target_y: 0.3 },
    });
  });

  it("stops whole where its outermost mark meets the page edge", () => {
    const shift = clampShift([slur, breath], { dx: 0.3, dy: -0.5 });
    expect(shift.dx).toBeCloseTo(0.1);
    expect(shift.dy).toBeCloseTo(-0.4);
  });

  it("moves every point of a stroke and the anchor of a placed mark", () => {
    const shift = { dx: -0.2, dy: 0.1 };
    expect(shiftedContent(slur, shift)).toEqual({
      annotation_type: "FH",
      payload: {
        paths: [
          [
            [0.5, 0.6],
            [0.6, 0.55],
            [0.7, 0.6],
          ],
        ],
        width: 0.004,
      },
    });
    expect(shiftedContent(breath, shift)).toEqual({
      annotation_type: "ST",
      payload: { x: 0.55, y: 0.5, symbol: "breath" },
    });
  });

  it("sets duplicates a step off, held on the page", () => {
    const shift = duplicateShift([slur], 1000, 1000);
    expect(shift.dx).toBeCloseTo(0.016);
    expect(shift.dy).toBeCloseTo(0.016);
    expect(duplicateShift([row("edge", { annotation_type: "ST", payload: { x: 1, y: 1, symbol: "breath" } })], 1000, 1000))
      .toEqual({ dx: 0, dy: 0 });
  });

  it("fans repeated pastes out a step each, until the page edge holds them", () => {
    expect(duplicateShift([slur], 1000, 1000, 3).dx).toBeCloseTo(0.048);
    expect(duplicateShift([slur], 1000, 1000, 20).dx).toBeCloseTo(0.1);
  });
});

describe("a copy", () => {
  it("lands on the page it is pasted on, with its kind, payload and audience", () => {
    const [copy] = copyDrafts([breath], 7, { dx: 0, dy: 0 }, inksFor(true));
    expect(copy).toEqual({
      annotation_type: "ST",
      payload: { x: 0.75, y: 0.4, symbol: "breath" },
      page_number: 7,
      color: "#2563EB",
      layer_name: "shared",
    });
  });

  it("is written in pencil when its ink is one this writer may not use", () => {
    const cue = row("cue", breath, { color: ANNOTATION_INKS[0].value, layer_name: "personal" });
    const [singers] = copyDrafts([cue], 3, { dx: 0, dy: 0 }, inksFor(false));
    const [conductors] = copyDrafts([cue], 3, { dx: 0, dy: 0 }, inksFor(true));
    expect(singers.color).toBe(ANNOTATION_INKS[ANNOTATION_INKS.length - 1].value);
    expect(conductors.color).toBe(ANNOTATION_INKS[0].value);
  });
});
