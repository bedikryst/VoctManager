/**
 * @file annotations.queries.test.tsx
 * @description The score marks' writes, read where they actually fail: in the
 * request log and the cache, not on the screen.
 *
 * Two families of regression live here, and both are invisible everywhere a
 * person would look for them:
 *   · the read-back that puts a singer's own pencil into the copy on their
 *     device. The stand is right, the marks are on the page, the server has
 *     them — and three days later, in a basement with no signal, the score opens
 *     without them, because the only thing that ever writes the durable copy is
 *     a real list GET and a successful POST is not one;
 *   · the write rules: a refetch that lands mid-write must not eat the mark, a
 *     refused write must take back only its own row, a mark the queue still
 *     holds must be written through the queue, and a 502 must queue rather than
 *     lose. Each of these once cost marks without a word on screen.
 * @module features/annotations/api
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";

import { QueryClient } from "@tanstack/react-query";

import { renderHookWithPanel } from "@/test/harness";
import { server } from "@/test/server";
import { flushOfflineQueue, registerOfflineLanding } from "@/shared/offline/offlineClient";
import { ANNOTATIONS_PATH } from "@/shared/offline/swProtocol";
import { useOfflineStore, type QueuedWrite } from "@/shared/offline/useOfflineStore";

import {
  annotationKeys,
  landQueuedMark,
  useAnnotationMutations,
  useMarkSeen,
  useScoreAnnotations,
} from "./annotations.queries";
import type { ScoreAnnotation } from "../types/annotations.dto";

const LIST_URL = `*${ANNOTATIONS_PATH}`;
const MARK_URL = `*${ANNOTATIONS_PATH}:id/`;
const RESTORE_URL = `*${ANNOTATIONS_PATH}restore/`;

/** Counts the trips to the network, which is the whole subject here. */
const arrangeStand = (
  rows: ScoreAnnotation[] = [],
): { readonly reads: { count: number } } => {
  const reads = { count: 0 };

  server.use(
    http.get(LIST_URL, () => {
      reads.count += 1;
      return HttpResponse.json(rows);
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

const serverMark = (id: string, color = "#1F2933"): ScoreAnnotation => ({
  id,
  edition: "edition-1",
  page_number: 1,
  annotation_type: "CM",
  payload: { x: 0.5, y: 0.5, text: "oddech", display: "pin" },
  color,
  layer_name: "personal",
  created_by: "user-manager",
  created_at: "2026-10-20T10:00:00Z",
  updated_at: "2026-10-20T10:00:00Z",
});

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

const queued = () => useOfflineStore.getState().queue;

afterEach(() => {
  setOnline(true);
  useOfflineStore.getState().reset();
  vi.restoreAllMocks();
});

describe("markings that must survive the persisted snapshot", () => {
  it("reads the edition back from the server when the reader leaves a score they wrote on", async () => {
    const { reads } = arrangeStand();
    const { result, unmount } = openStand("edition-written-on");

    await waitFor(() => expect(reads.count).toBe(1));

    await act(async () => {
      const draft = result.current.writer.draftAnnotation(NOTE);
      if (!draft) throw new Error("the stand was handed no edition to draw on");
      await result.current.writer.createMark(draft);
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
      await result.current.writer.createMark(draft);
    });

    setOnline(false);
    unmount();
    await act(async () => {});
    // The mark is either on the server already or in the durable queue; either
    // way the read-back is worth nothing here and would only fail.
    expect(reads.count).toBe(1);
  });
});

describe("writing a mark", () => {
  it("keeps a mark that a refetch dropped while its create was in the air", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(LIST_URL, () => HttpResponse.json([])),
      http.post(LIST_URL, async ({ request }) => {
        const body = await request.json();
        await gate;
        return HttpResponse.json(body, { status: 201 });
      }),
    );
    const { result, queryClient, unmount } = openStand("edition-1");
    await waitFor(() => expect(result.current.marks.isLoaded).toBe(true));

    const draft = result.current.writer.draftAnnotation(NOTE);
    if (!draft) throw new Error("no edition");
    let write: Promise<unknown> = Promise.resolve();
    act(() => {
      write = result.current.writer.createMark(draft);
    });
    await waitFor(() =>
      expect(result.current.marks.annotations.map((row) => row.id)).toEqual([draft.id]),
    );

    // A list answered from before the write lands under it.
    act(() => queryClient.setQueryData(annotationKeys.byEdition("edition-1"), []));
    await act(async () => {
      release();
      await write;
    });

    await waitFor(() =>
      expect(result.current.marks.annotations.map((row) => row.id)).toEqual([draft.id]),
    );
    // Leaving runs the read-back while this suite's handlers still answer it.
    unmount();
    await act(async () => {});
  });

  it("takes back only its own row when the server refuses it, and says why once", async () => {
    const mine = serverMark("mine");
    const other = serverMark("other");
    server.use(
      http.get(LIST_URL, () => HttpResponse.json([mine, other])),
      http.patch(MARK_URL, () =>
        HttpResponse.json({ detail: "reserved" }, { status: 403 }),
      ),
    );
    const error = vi.spyOn(toast, "error");
    const { result, queryClient } = openStand("edition-1");
    await waitFor(() => expect(result.current.marks.annotations).toHaveLength(2));

    let write: Promise<unknown> = Promise.resolve();
    act(() => {
      write = result.current.writer.updateMark("mine", { color: "#DC2626" });
    });
    // Meanwhile another change reaches the list — it must survive the rollback.
    act(() =>
      queryClient.setQueryData<ScoreAnnotation[]>(
        annotationKeys.byEdition("edition-1"),
        (rows) => rows?.map((row) => (row.id === "other" ? { ...row, color: "#2563EB" } : row)),
      ),
    );
    await act(async () => {
      await expect(write).rejects.toBeTruthy();
    });

    await waitFor(() =>
      expect(
        Object.fromEntries(
          result.current.marks.annotations.map((row) => [row.id, row.color]),
        ),
      ).toEqual({ mine: "#1F2933", other: "#2563EB" }),
    );
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toBe(
      "Tym kolorem pisze tylko dyrygent. Oznaczenie nie zostało zapisane.",
    );
    expect(queued()).toEqual([]);
  });

  it("queues a create the server answered with a 502, and an erase keeps its DELETE", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json([])),
      http.post(LIST_URL, () => new HttpResponse(null, { status: 502 })),
    );
    const { result } = openStand("edition-1");
    await waitFor(() => expect(result.current.marks.isLoaded).toBe(true));

    const draft = result.current.writer.draftAnnotation(NOTE);
    if (!draft) throw new Error("no edition");
    await act(async () => {
      expect(await result.current.writer.createMark(draft)).toBe("queued");
    });
    await waitFor(() => expect(result.current.marks.annotations.map((row) => row.id)).toEqual([draft.id]));

    // The 502 may have come after the row was stored, so the erase cannot
    // simply withdraw the create.
    await act(async () => {
      expect(await result.current.writer.eraseMark(draft)).toBe("queued");
    });
    expect(queued().map((write) => write.method)).toEqual(["POST", "DELETE"]);
    await waitFor(() => expect(result.current.marks.annotations).toEqual([]));
  });

  it("writes an edit of a still-queued mark through the queue, not over the network", async () => {
    arrangeStand();
    const { result } = openStand("edition-1");
    await waitFor(() => expect(result.current.marks.isLoaded).toBe(true));

    const draft = result.current.writer.draftAnnotation(NOTE);
    if (!draft) throw new Error("no edition");
    setOnline(false);
    await act(async () => {
      expect(await result.current.writer.createMark(draft)).toBe("queued");
    });
    setOnline(true);

    // No PATCH handler is registered: a live write here fails the suite.
    await act(async () => {
      expect(
        await result.current.writer.updateMark(draft.id, { color: "#2563EB" }),
      ).toBe("queued");
    });

    expect(queued()).toHaveLength(1);
    expect(queued()[0]).toMatchObject({ method: "POST", body: { color: "#2563EB" } });
  });

  it("queues a second edit behind a first that failed into the queue while it waited", async () => {
    const mine = serverMark("mine");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let patches = 0;
    server.use(
      http.get(LIST_URL, () => HttpResponse.json([mine])),
      http.patch(MARK_URL, async () => {
        patches += 1;
        await gate;
        return new HttpResponse(null, { status: 502 });
      }),
    );
    const { result } = openStand("edition-1");
    await waitFor(() => expect(result.current.marks.annotations).toHaveLength(1));

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.writer.updateMark("mine", { color: "#DC2626" });
      second = result.current.writer.updateMark("mine", { color: "#2563EB" });
    });
    // Both are drawn at once; only the first is on the wire.
    await waitFor(() => expect(result.current.marks.annotations[0].color).toBe("#2563EB"));
    expect(patches).toBe(1);

    await act(async () => {
      release();
      expect(await first).toBe("queued");
      expect(await second).toBe("queued");
    });

    // The second never overtook the first: one PATCH, carrying the newer colour.
    expect(patches).toBe(1);
    expect(queued()).toHaveLength(1);
    expect(queued()[0]).toMatchObject({ method: "PATCH", body: { color: "#2563EB" } });
    await waitFor(() => expect(result.current.marks.annotations[0].color).toBe("#2563EB"));
  });
});

describe("a queued mark landing", () => {
  it("stays drawn in every frame of the drain", async () => {
    const answered: ScoreAnnotation[] = [];
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(answered)),
      http.post(LIST_URL, async ({ request }) => {
        // A create body: the row less its author and stamps, set below.
        const body = (await request.json()) as ScoreAnnotation;
        const row: ScoreAnnotation = {
          ...body,
          created_by: "user-1",
          created_at: "2026-10-27T10:00:00Z",
          updated_at: "2026-10-27T10:00:00Z",
        };
        answered.push(row);
        return HttpResponse.json(row, { status: 201 });
      }),
    );
    registerOfflineLanding("annotation", landQueuedMark);
    useOfflineStore.getState().setOwner("user-1");
    const { result, queryClient, unmount } = openStand("edition-1");
    await waitFor(() => expect(result.current.marks.isLoaded).toBe(true));

    const draft = result.current.writer.draftAnnotation(NOTE);
    if (!draft) throw new Error("no edition");
    setOnline(false);
    await act(async () => {
      expect(await result.current.writer.createMark(draft)).toBe("queued");
    });
    setOnline(true);

    // The moment the write leaves the queue, the list must already hold it.
    const listedWhenDequeued: boolean[] = [];
    const stop = useOfflineStore.subscribe((state) => {
      if (state.queue.length > 0) return;
      const rows = queryClient.getQueryData<ScoreAnnotation[]>(
        annotationKeys.byEdition("edition-1"),
      );
      listedWhenDequeued.push(!!rows?.some((row) => row.id === draft.id));
    });
    await act(async () => {
      await flushOfflineQueue(queryClient);
    });
    stop();

    expect(listedWhenDequeued[0]).toBe(true);
    expect(result.current.marks.annotations.map((row) => row.id)).toEqual([draft.id]);
    unmount();
    await act(async () => {});
  });

  it("reports a restore the server met only in part", () => {
    const queryClient = new QueryClient();
    const kept = serverMark("kept");
    const refused = serverMark("refused");
    const write = {
      meta: { op: "restore", editionId: "edition-1", annotations: [kept, refused] },
    } as unknown as QueuedWrite;

    expect(landQueuedMark(queryClient, write, { restored: [kept] })).toBe(false);
    expect(landQueuedMark(queryClient, write, { restored: [kept, refused] })).toBe(true);
  });
});

describe("undoing an erase", () => {
  it("cancels an erase that is still waiting unsent in the queue", async () => {
    const existing = serverMark("existing");
    arrangeStand([existing]);
    const { result } = openStand("edition-1");
    await waitFor(() => expect(result.current.marks.annotations).toHaveLength(1));

    setOnline(false);
    await act(async () => {
      expect(await result.current.writer.eraseMark(existing)).toBe("queued");
    });
    await waitFor(() => expect(result.current.marks.annotations).toEqual([]));

    await act(async () => {
      expect(await result.current.writer.reviveMarks([existing])).toBe("discarded");
    });
    expect(queued()).toEqual([]);
    await waitFor(() => expect(result.current.marks.annotations.map((row) => row.id)).toEqual(["existing"]));
  });

  it("restores a landed erase as the same row", async () => {
    const existing = serverMark("existing");
    const restored = { ...existing, updated_at: "2026-10-26T18:00:00Z" };
    const restoreBodies: unknown[] = [];
    arrangeStand([existing]);
    server.use(
      http.delete(MARK_URL, () => new HttpResponse(null, { status: 204 })),
      http.post(RESTORE_URL, async ({ request }) => {
        restoreBodies.push(await request.json());
        return HttpResponse.json({ restored: [restored] });
      }),
    );
    const { result, unmount } = openStand("edition-1");
    await waitFor(() => expect(result.current.marks.annotations).toHaveLength(1));

    await act(async () => {
      expect(await result.current.writer.eraseMark(existing)).toBe("saved");
    });
    await act(async () => {
      expect(await result.current.writer.reviveMarks([existing])).toBe("saved");
    });

    expect(restoreBodies).toEqual([{ ids: ["existing"] }]);
    await waitFor(() => expect(result.current.marks.annotations).toEqual([restored]));
    unmount();
    await act(async () => {});
  });
});

describe("the reader's pointer", () => {
  const SEEN_URL = `*${ANNOTATIONS_PATH}seen/`;
  const AT = "2026-10-27T09:00:00Z";

  it("goes straight to the queue when the app is leaving, without waiting on the network", () => {
    const sent = { count: 0 };
    server.use(
      http.post(SEEN_URL, () => {
        sent.count += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { result } = renderHookWithPanel(() => useMarkSeen());

    act(() => result.current("edition-1", AT, true));

    expect(sent.count).toBe(0);
    expect(queued()).toEqual([
      expect.objectContaining({
        kind: "annotation_seen",
        body: { edition: "edition-1", at: AT },
        background: true,
      }),
    ]);
  });

  it("lets a 403 go: the reader may no longer open that edition", async () => {
    const answered = { count: 0 };
    server.use(
      http.post(SEEN_URL, () => {
        answered.count += 1;
        return HttpResponse.json({ detail: "forbidden" }, { status: 403 });
      }),
    );
    const error = vi.spyOn(toast, "error");
    const { result } = renderHookWithPanel(() => useMarkSeen());

    act(() => result.current("edition-gone", AT));

    await waitFor(() => expect(answered.count).toBe(1));
    await act(async () => {});
    expect(queued()).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });
});
