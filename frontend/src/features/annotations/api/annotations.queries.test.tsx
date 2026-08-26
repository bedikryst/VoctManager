/**
 * @file annotations.queries.test.tsx
 * @description The read-back that puts a singer's own pencil into the copy on
 * their device.
 *
 * This is the fifth flow in the suite and it earns its place the same way the
 * other four do: the regression is invisible everywhere a person would look for
 * it. The stand is right, the marks are on the page, the server has them — and
 * three days later, in a basement with no signal, the score opens without them,
 * because the only thing that ever writes the durable copy is a real list GET
 * and a successful POST is not one. Neither `tsc`, nor a build, nor looking at
 * the screen can tell that apart from working; the request log can.
 * @architecture Enterprise SaaS 2026
 * @module features/annotations/api
 */

import { afterEach, describe, expect, it } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { renderHookWithPanel } from "@/test/harness";
import { server } from "@/test/server";
import { ANNOTATIONS_PATH } from "@/shared/offline/swProtocol";

import {
  useAnnotationMutations,
  useScoreAnnotations,
} from "./annotations.queries";

const LIST_URL = `*${ANNOTATIONS_PATH}`;

/** Counts the trips to the network, which is the whole subject here. */
const arrangeStand = (): { readonly reads: { count: number } } => {
  const reads = { count: 0 };

  server.use(
    http.get(LIST_URL, () => {
      reads.count += 1;
      return HttpResponse.json([]);
    }),
    http.post(LIST_URL, async ({ request }) =>
      HttpResponse.json(await request.json()),
    ),
  );

  return { reads };
};

const NOTE = {
  page_number: 3,
  annotation_type: "CM",
  payload: { x: 0.5, y: 0.5, text: "wdech", display: "pin" },
  color: "#8a6f3c",
  layer_name: "personal",
} as const;

const openStand = (editionId: string) =>
  renderHookWithPanel(() => ({
    marks: useScoreAnnotations(editionId),
    writer: useAnnotationMutations(editionId),
  }));

/** jsdom reports the tab online; a suite that says otherwise must put it back. */
const setOnline = (online: boolean): void => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

afterEach(() => setOnline(true));

describe("markings that must survive the persisted snapshot", () => {
  it("reads the edition back from the server when the reader leaves a score they wrote on", async () => {
    const { reads } = arrangeStand();
    const { result, unmount } = openStand("edition-written-on");

    await waitFor(() => expect(reads.count).toBe(1));

    await act(async () => {
      const draft = result.current.writer.draftAnnotation(NOTE);
      if (!draft) throw new Error("the stand was handed no edition to draw on");
      await result.current.writer.create.mutateAsync(draft);
    });

    // Still one: the write patched the cache in place, which is what keeps the
    // stroke under the hand — and is exactly why the copy on disk is now behind.
    expect(reads.count).toBe(1);

    unmount();
    await waitFor(() => expect(reads.count).toBe(2));
  });

  it("costs nothing to leave a score nobody wrote on", async () => {
    const { reads } = arrangeStand();
    const { unmount } = openStand("edition-only-read");

    await waitFor(() => expect(reads.count).toBe(1));

    unmount();
    await act(async () => {});
    expect(reads.count).toBe(1);
  });

  it("does not spend a doomed request when the signal is already gone", async () => {
    const { reads } = arrangeStand();
    const { result, unmount } = openStand("edition-written-offline");

    await waitFor(() => expect(reads.count).toBe(1));

    await act(async () => {
      const draft = result.current.writer.draftAnnotation(NOTE);
      if (!draft) throw new Error("the stand was handed no edition to draw on");
      await result.current.writer.create.mutateAsync(draft);
    });

    setOnline(false);
    unmount();
    await act(async () => {});
    // The mark is either on the server already or in the durable queue; either
    // way the read-back is worth nothing here and would only fail.
    expect(reads.count).toBe(1);
  });
});
