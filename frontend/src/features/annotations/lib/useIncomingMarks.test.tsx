/**
 * @file useIncomingMarks.test.tsx
 * @description What a reader is told is new, and when their pointer moves.
 *
 * The defects this pins: a singer opening a score was told that every mark
 * already on it had just been written (the baseline was taken from the empty
 * page shown before the list arrived), and on the day "what's new" ships nobody
 * may be shown the whole score as new. New is `content_at` against the reader's
 * `seen_at`, summed up once from a settled list, then announced as it arrives.
 * @module features/annotations/lib/useIncomingMarks.test
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useIncomingMarks } from "./useIncomingMarks";
import type { ScoreAnnotation } from "../types/annotations.dto";

const READER = "user-artist";
const SEEN = "2026-10-26T12:00:00Z";
const BEFORE = "2026-10-26T10:00:00Z";
const AFTER = "2026-10-26T14:00:00Z";

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
  created_at: BEFORE,
  updated_at: BEFORE,
  content_at: BEFORE,
  ...overrides,
});

interface Props {
  annotations: ScoreAnnotation[];
  isLoaded?: boolean;
  isSettled?: boolean;
  seenAt?: string | null;
  editionId?: string;
  watching?: boolean;
}

const watch = (initial: Props, onSeen = vi.fn()) => {
  const view = renderHook(
    ({
      annotations,
      isLoaded = true,
      isSettled = true,
      seenAt,
      editionId = "edition-1",
      watching = true,
    }: Props) =>
      useIncomingMarks({
        annotations,
        isLoaded,
        isSettled,
        editionId,
        watching,
        userId: READER,
        seenAt,
        onSeen,
      }),
    { initialProps: initial },
  );
  return { ...view, onSeen };
};

describe("what is new since the reader's last visit", () => {
  it("sums up marks whose content changed after the pointer, with their pages", () => {
    const { result } = watch({
      annotations: [
        mark("old"),
        mark("a", { content_at: AFTER, page_number: 7 }),
        mark("b", { content_at: AFTER, page_number: 3, layer_name: "leader" }),
      ],
      seenAt: SEEN,
    });

    expect(result.current.notice).toEqual({ kind: "since", count: 2, pages: [3, 7] });
    expect(result.current.newMarks.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("never counts the reader's own hand, or their private layer", () => {
    const { result } = watch({
      annotations: [
        mark("mine", { content_at: AFTER, created_by: READER }),
        mark("pencil", { content_at: AFTER, layer_name: "personal" }),
      ],
      seenAt: SEEN,
    });

    expect(result.current.notice).toBeNull();
    expect(result.current.newMarks).toEqual([]);
  });

  it("treats a row without content_at (an older cache) as not new", () => {
    const { result } = watch({
      annotations: [mark("cached", { content_at: undefined })],
      seenAt: SEEN,
    });

    expect(result.current.newMarks).toEqual([]);
  });

  it("waits for the fingerprint before deciding anything", () => {
    const { result, rerender } = watch({
      annotations: [mark("a", { content_at: AFTER })],
      seenAt: undefined,
    });
    expect(result.current.newMarks).toEqual([]);
    expect(result.current.notice).toBeNull();

    rerender({ annotations: [mark("a", { content_at: AFTER })], seenAt: SEEN });

    expect(result.current.notice).toEqual({ kind: "since", count: 1, pages: [4] });
  });

  it("sums up from a settled list, not from a snapshot still being refreshed", () => {
    const { result, rerender } = watch({
      annotations: [mark("a", { content_at: AFTER })],
      seenAt: SEEN,
      isSettled: false,
    });
    expect(result.current.notice).toBeNull();

    rerender({
      annotations: [mark("a", { content_at: AFTER }), mark("b", { content_at: AFTER })],
      seenAt: SEEN,
      isSettled: true,
    });

    expect(result.current.notice).toEqual({ kind: "since", count: 2, pages: [4] });
  });

  it("shows nothing when the edition is gone (no pointer at all)", () => {
    const { result } = watch({
      annotations: [mark("a", { content_at: AFTER })],
      seenAt: null,
    });

    expect(result.current.newMarks).toEqual([]);
    expect(result.current.notice).toBeNull();
  });
});

describe("marks that arrive while the stand is open", () => {
  it("announces an arrival on its page and keeps both marks new for the session", () => {
    const { result, rerender } = watch({
      annotations: [mark("a", { content_at: AFTER })],
      seenAt: SEEN,
    });

    rerender({
      annotations: [
        mark("a", { content_at: AFTER }),
        mark("b", { content_at: "2026-10-26T15:00:00Z", page_number: 9 }),
      ],
      seenAt: SEEN,
    });

    expect(result.current.notice).toEqual({ kind: "live", count: 1, pages: [9] });
    expect(result.current.newMarks.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("does not announce a mark that was only moved", () => {
    const { result, rerender } = watch({ annotations: [mark("a")], seenAt: SEEN });

    rerender({
      annotations: [mark("a", { payload: { x: 0.9, y: 0.1, text: "piano" }, updated_at: AFTER })],
      seenAt: SEEN,
    });

    expect(result.current.notice).toBeNull();
  });

  it("keeps the session's baseline when the pointer moves on another device", () => {
    const { result, rerender } = watch({
      annotations: [mark("a", { content_at: AFTER })],
      seenAt: SEEN,
    });

    rerender({ annotations: [mark("a", { content_at: AFTER })], seenAt: AFTER });

    expect(result.current.newMarks.map((m) => m.id)).toEqual(["a"]);
  });
});

describe("leaving the edition", () => {
  it("sends the newest content the device drew, as the server spelled it", () => {
    const { unmount, onSeen } = watch({
      annotations: [
        mark("a", { content_at: AFTER }),
        mark("b", { content_at: "2026-10-26T13:00:00.123456Z" }),
        mark("mine", { content_at: "2026-10-27T09:00:00Z", created_by: READER }),
      ],
      seenAt: SEEN,
    });

    unmount();

    expect(onSeen).toHaveBeenCalledExactlyOnceWith("edition-1", AFTER);
  });

  it("sends nothing when nothing newer than the pointer was drawn", () => {
    const { unmount, onSeen } = watch({ annotations: [mark("a")], seenAt: SEEN });

    unmount();

    expect(onSeen).not.toHaveBeenCalled();
  });

  it("moves only the edition that was on screen when the book turns to the next", () => {
    const { rerender, onSeen } = watch({
      annotations: [mark("a", { content_at: AFTER })],
      seenAt: SEEN,
    });

    rerender({
      annotations: [mark("z", { edition: "edition-2", content_at: AFTER })],
      seenAt: undefined,
      editionId: "edition-2",
    });

    expect(onSeen).toHaveBeenCalledExactlyOnceWith("edition-1", AFTER);
  });

  it("sends when the stand closes, and a reopen does not show the same marks as new", () => {
    const { result, rerender, onSeen } = watch({
      annotations: [mark("a", { content_at: AFTER })],
      seenAt: SEEN,
    });

    rerender({ annotations: [mark("a", { content_at: AFTER })], seenAt: SEEN, watching: false });
    expect(onSeen).toHaveBeenCalledExactlyOnceWith("edition-1", AFTER);

    // The stale fingerprint answer is all a reopened stand has at first.
    rerender({ annotations: [mark("a", { content_at: AFTER })], seenAt: SEEN, watching: true });

    expect(result.current.newMarks).toEqual([]);
    expect(result.current.notice).toBeNull();
  });
});
