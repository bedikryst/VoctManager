/**
 * @file markBounds.test.ts
 * @description Pins the geometry the mark card is placed against — chiefly that
 * a stroke reports the middle of what it COVERS rather than where the hand
 * started, which is the whole reason the module exists — and what a loop drawn
 * round the music, or a tap on it, picks out.
 * @module features/annotations/lib
 */

import { describe, expect, it } from "vitest";

import {
  boundsAnchor,
  distanceToStroke,
  isInLoop,
  markBounds,
  pointInLoop,
  strokeBounds,
} from "./markBounds";
import type { MarkContent, NormPoint, ScoreAnnotation } from "../types/annotations.dto";

const annotation = (content: MarkContent): ScoreAnnotation => ({
  id: "a",
  edition: "e",
  page_number: 1,
  color: "#DC2626",
  layer_name: "shared",
  created_by: null,
  created_at: "2026-09-13T10:00:00Z",
  updated_at: "2026-09-13T10:00:00Z",
  ...content,
});

/** A square loop from (0.2, 0.2) to (0.6, 0.6), drawn as a hand draws it. */
const LOOP: NormPoint[] = [
  [0.2, 0.2],
  [0.6, 0.2],
  [0.6, 0.6],
  [0.2, 0.6],
];

describe("strokeBounds", () => {
  it("spans every point of every path", () => {
    const paths: NormPoint[][] = [
      [
        [0.2, 0.5],
        [0.4, 0.3],
      ],
      [
        [0.8, 0.9],
        [0.1, 0.6],
      ],
    ];
    expect(strokeBounds(paths)).toEqual({
      minX: 0.1,
      minY: 0.3,
      maxX: 0.8,
      maxY: 0.9,
    });
  });

  it("is null when there is nothing to bound", () => {
    expect(strokeBounds([])).toBeNull();
    expect(strokeBounds([[]])).toBeNull();
  });
});

describe("markBounds", () => {
  it("anchors a stroke at the MIDDLE of its run, not at its first point", () => {
    const bounds = markBounds(
      annotation({
        annotation_type: "FH",
        payload: {
          paths: [
            [
              [0.1, 0.4],
              [0.9, 0.4],
            ],
          ],
          width: 0.004,
        },
      }),
    );
    expect(bounds).not.toBeNull();
    // A hairpin drawn left-to-right across a system: the card belongs over its
    // centre. Anchoring on payload.paths[0][0] would open it on the drawing.
    expect(boundsAnchor(bounds!)).toEqual({ x: 0.5, y: 0.4 });
  });

  it("gives a highlighter the same treatment as ink", () => {
    const bounds = markBounds(
      annotation({
        annotation_type: "HL",
        payload: { paths: [[[0.2, 0.2], [0.6, 0.2]]], width: 0.02 },
      }),
    );
    expect(boundsAnchor(bounds!)).toEqual({ x: 0.4, y: 0.2 });
  });

  it("reports a point mark as a zero-size box at its anchor", () => {
    expect(
      markBounds(
        annotation({
          annotation_type: "ST",
          payload: { x: 0.3, y: 0.7, symbol: "breath" },
        }),
      ),
    ).toEqual({ minX: 0.3, minY: 0.7, maxX: 0.3, maxY: 0.7 });

    expect(
      markBounds(
        annotation({
          annotation_type: "CM",
          payload: { x: 0.25, y: 0.5, text: "razem", display: "inline" },
        }),
      ),
    ).toEqual({ minX: 0.25, minY: 0.5, maxX: 0.25, maxY: 0.5 });
  });

  it("is null for a payload that does not match its declared type", () => {
    // A row an older build stored badly: the types say it cannot exist.
    const malformed = { annotation_type: "FH", payload: { nonsense: true } } as unknown as MarkContent;
    expect(markBounds(annotation(malformed))).toBeNull();
  });
});

describe("a loop round the music", () => {
  it("closes itself from its last point back to its first", () => {
    expect(pointInLoop([0.4, 0.4], LOOP)).toBe(true);
    expect(pointInLoop([0.7, 0.4], LOOP)).toBe(false);
  });

  it("takes a placed mark by its anchor", () => {
    const inside = annotation({ annotation_type: "ST", payload: { x: 0.3, y: 0.3, symbol: "breath" } });
    const outside = annotation({
      annotation_type: "CM",
      payload: { x: 0.8, y: 0.3, text: "razem", display: "inline" },
    });
    expect(isInLoop(inside, LOOP)).toBe(true);
    expect(isInLoop(outside, LOOP)).toBe(false);
  });

  it("takes a stroke most of whose points it holds, and spares one it only grazes", () => {
    const slurClipped = annotation({
      annotation_type: "FH",
      payload: {
        paths: [
          [
            [0.25, 0.4],
            [0.35, 0.38],
            [0.45, 0.38],
            [0.55, 0.4],
            [0.65, 0.45],
          ],
        ],
        width: 0.004,
      },
    });
    const lineBeside = annotation({
      annotation_type: "HL",
      payload: {
        paths: [
          [
            [0.55, 0.5],
            [0.7, 0.5],
            [0.8, 0.5],
          ],
        ],
        width: 0.02,
      },
    });
    expect(isInLoop(slurClipped, LOOP)).toBe(true);
    expect(isInLoop(lineBeside, LOOP)).toBe(false);
  });

  it("takes nothing when it is not a loop at all", () => {
    const mark = annotation({ annotation_type: "ST", payload: { x: 0.3, y: 0.3, symbol: "breath" } });
    expect(isInLoop(mark, [[0.1, 0.1], [0.9, 0.9]])).toBe(false);
  });
});

describe("a tap on a stroke", () => {
  it("measures in page pixels, along the line and past its ends", () => {
    const paths: NormPoint[][] = [
      [
        [0.1, 0.5],
        [0.5, 0.5],
      ],
    ];
    // A 1000 × 500 page: the line runs at y = 250 px from x = 100 to 500.
    expect(distanceToStroke(paths, [0.3, 0.52], 1000, 500)).toBeCloseTo(10);
    expect(distanceToStroke(paths, [0.52, 0.5], 1000, 500)).toBeCloseTo(20);
  });
});
