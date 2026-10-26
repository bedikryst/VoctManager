/**
 * @file useIncomingMarks.test.tsx
 * @description The baseline behind "new marks · p. N".
 *
 * The defect this pins: a singer opening a score for the first time was told
 * that every mark already on it had just been written, because the baseline was
 * taken from the empty page shown before the list arrived.
 * @module features/annotations/lib/useIncomingMarks.test
 */

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { useIncomingMarks } from "./useIncomingMarks";
import type { ScoreAnnotation } from "../types/annotations.dto";

const READER = "user-artist";

const mark = (
  id: string,
  overrides: Partial<ScoreAnnotation> = {},
): ScoreAnnotation => ({
  id,
  edition: "edition-1",
  page_number: 4,
  annotation_type: "CM",
  payload: { x: 0.5, y: 0.5, text: "piano", display: "pin" },
  color: "#DC2626",
  layer_name: "shared",
  created_by: "user-manager",
  created_at: "2026-10-26T10:00:00Z",
  updated_at: "2026-10-26T10:00:00Z",
  ...overrides,
});

interface Props {
  annotations: ScoreAnnotation[];
  isLoaded: boolean;
}

const watch = (initial: Props) =>
  renderHook(
    ({ annotations, isLoaded }: Props) =>
      useIncomingMarks({
        annotations,
        isLoaded,
        editionId: "edition-1",
        watching: true,
        userId: READER,
      }),
    { initialProps: initial },
  );

describe("the incoming-marks baseline", () => {
  it("takes the first real list as the score, not as news", () => {
    const { result, rerender } = watch({ annotations: [], isLoaded: false });

    rerender({ annotations: [mark("a"), mark("b")], isLoaded: true });

    expect(result.current.marks).toBeNull();
  });

  it("ignores what this device queued before the list arrived", () => {
    const queuedHere = mark("mine", { layer_name: "personal", created_by: READER });
    const { result, rerender } = watch({ annotations: [queuedHere], isLoaded: false });

    rerender({ annotations: [queuedHere, mark("a")], isLoaded: true });

    expect(result.current.marks).toBeNull();
  });

  it("announces a mark that arrives after the baseline, on its page", () => {
    const { result, rerender } = watch({ annotations: [mark("a")], isLoaded: true });

    rerender({
      annotations: [mark("a"), mark("b", { page_number: 7 }), mark("c", { page_number: 2 })],
      isLoaded: true,
    });

    expect(result.current.marks).toEqual({ count: 2, page: 2 });
  });

  it("never announces the reader's own hand", () => {
    const { result, rerender } = watch({ annotations: [], isLoaded: true });

    rerender({ annotations: [mark("mine", { created_by: READER })], isLoaded: true });

    expect(result.current.marks).toBeNull();
  });
});
