/**
 * @file offlineClient.test.ts
 * @description The replay loop's rules, which decide whether a write made with
 * no signal ever reaches the server.
 *
 * The case that earned this suite: a deploy answers 502 for a couple of
 * minutes, and a loop that drops on any 5xx loses every mark drawn in that
 * window — while a loop that keeps a write forever lets one poison entry hold
 * the whole queue behind it. Neither shows on screen until a rehearsal.
 * @module shared/offline/offlineClient.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";

const request = vi.hoisted(() => {
  // The store persists to localStorage, which Node does not have.
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
      clear: () => data.clear(),
      key: () => null,
      length: 0,
    },
  });
  return vi.fn();
});

vi.mock("@/shared/api/api", () => ({ default: { request } }));
vi.mock("@/shared/pwa/appUpdateController", () => ({ armAppUpdateWatch: vi.fn() }));

import {
  claimOfflineState,
  flushOfflineQueue,
  registerOfflineLanding,
  registerOfflineReconciler,
} from "./offlineClient";
import { GIVE_UP_AFTER_MS, RETRY_BASE_MS } from "./replayPolicy";
import {
  createOfflineStore,
  readQueuedWrites,
  useOfflineStore,
  type NewQueuedWrite,
} from "./useOfflineStore";

const NOW = Date.parse("2026-10-26T18:00:00Z");
const DAY = 24 * 60 * 60_000;
const queryClient = {} as QueryClient;
const OWNER = "user-1";

const answered = (status: number) => Object.assign(new Error(`HTTP ${status}`), {
  response: { status },
});
const networkDown = () => new Error("Network Error");

const write = (
  dedupeKey: string,
  overrides: Partial<NewQueuedWrite> = {},
): NewQueuedWrite => ({
  kind: "annotation",
  method: "POST",
  url: `/api/archive/annotations/`,
  body: { key: dedupeKey },
  dedupeKey,
  label: "test",
  ...overrides,
});

const queue = () => useOfflineStore.getState().queue;
const enqueue = (...writes: NewQueuedWrite[]) => {
  for (const item of writes) useOfflineStore.getState().enqueueWrite(item);
};
/** Which writes were sent, by the key their body carries. */
const sentKeys = () =>
  request.mock.calls.map(([config]) => (config as { data: { key: string } }).data.key);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  useOfflineStore.getState().reset();
  useOfflineStore.getState().setOwner(OWNER);
  request.mockReset();
});

describe("whose queue it is", () => {
  it("is wiped before anything is sent when a different account signs in", async () => {
    enqueue(write("their-personal-note", { kind: "note" }));
    useOfflineStore.getState().saveManifest({
      projectId: "p1", title: "Requiem", assetUrls: ["/a.pdf"], assetCount: 1, failed: 0, cachedAt: NOW,
    });

    expect(await claimOfflineState("user-2", { signedIn: true })).toBe(true);
    await flushOfflineQueue(queryClient);

    expect(request).not.toHaveBeenCalled();
    expect(queue()).toEqual([]);
    expect(useOfflineStore.getState().manifests).toEqual({});
    expect(useOfflineStore.getState().owner).toBe("user-2");
  });

  it("is kept, and replayed, when the same account signs in again", async () => {
    enqueue(write("mine"));

    expect(await claimOfflineState(OWNER, { signedIn: true })).toBe(false);
    request.mockResolvedValue({});
    await flushOfflineQueue(queryClient);

    expect(sentKeys()).toEqual(["mine"]);
  });

  it("is adopted by a continuing session when no owner was recorded", async () => {
    useOfflineStore.getState().reset();
    enqueue(write("unstamped"));

    expect(await claimOfflineState(OWNER, { signedIn: false })).toBe(false);
    expect(queue()[0].userId).toBe(OWNER);
  });

  it("is wiped by a fresh sign-in when no owner was recorded", async () => {
    useOfflineStore.getState().reset();
    enqueue(write("whose"));

    expect(await claimOfflineState(OWNER, { signedIn: true })).toBe(true);
    expect(queue()).toEqual([]);
  });

  it("never sends a write stamped for another account", async () => {
    enqueue(write("theirs"));
    useOfflineStore.setState((state) => ({
      queue: state.queue.map((item) => ({ ...item, userId: "user-2" })),
    }));

    await flushOfflineQueue(queryClient);

    expect(request).not.toHaveBeenCalled();
    expect(queue()).toEqual([]);
  });
});

describe("two tabs on one storage", () => {
  it("keeps both tabs' writes when each saves after the other", () => {
    const first = createOfflineStore();
    const second = createOfflineStore();
    first.getState().reset();

    first.getState().enqueueWrite(write("from-the-app"));
    second.getState().enqueueWrite(write("from-the-tab"));
    const landed = first.getState().queue.find((item) => item.dedupeKey === "from-the-app");
    if (!landed) throw new Error("the first tab lost its own write");
    first.getState().dequeueWrite(landed.id);

    void second.persist.rehydrate();
    expect(second.getState().queue.map((item) => item.dedupeKey)).toEqual(["from-the-tab"]);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a write the server could not take yet", () => {
  it("is kept through a 502, holds the writes behind it, and backs off", async () => {
    enqueue(write("first"), write("second"));
    request.mockRejectedValueOnce(answered(502));

    const summary = await flushOfflineQueue(queryClient);

    expect(sentKeys()).toEqual(["first"]);
    expect(summary).toEqual({ flushed: 0, rejected: 0, remaining: 2 });
    expect(queue()[0]).toMatchObject({
      attempts: 1,
      nextAttemptAt: NOW + RETRY_BASE_MS,
      failingSince: NOW,
    });
  });

  it("waits out its backoff unless the reader asks", async () => {
    enqueue(write("first"));
    request.mockRejectedValueOnce(answered(503));
    await flushOfflineQueue(queryClient);

    request.mockResolvedValue({});
    await flushOfflineQueue(queryClient);
    expect(request).toHaveBeenCalledTimes(1);

    await flushOfflineQueue(queryClient, { force: true });
    expect(request).toHaveBeenCalledTimes(2);
    expect(queue()).toEqual([]);
  });

  it("never starts the give-up clock on a network error", async () => {
    enqueue(write("first"));
    request.mockRejectedValueOnce(networkDown());

    await flushOfflineQueue(queryClient);

    expect(queue()[0]).toMatchObject({ attempts: 1, failingSince: null });
  });

  it("survives a deploy's minutes of errors however many tries they take", async () => {
    enqueue(write("first"));
    request.mockRejectedValue(answered(502));
    for (let tick = 0; tick < 30; tick += 1) {
      await flushOfflineQueue(queryClient, { force: true });
      vi.setSystemTime(Date.now() + 10_000);
    }
    expect(queue()).toHaveLength(1);
    expect(queue()[0].attempts).toBe(30);
  });

  it("is given up on once the server has failed it for a whole day", async () => {
    enqueue(write("first"), write("second"));
    useOfflineStore.setState((state) => ({
      queue: state.queue.map((item, index) =>
        index === 0 ? { ...item, failingSince: NOW - GIVE_UP_AFTER_MS } : item,
      ),
    }));
    request.mockRejectedValueOnce(answered(500)).mockResolvedValueOnce({});

    const summary = await flushOfflineQueue(queryClient);

    expect(summary).toEqual({ flushed: 1, rejected: 1, remaining: 0 });
    expect(sentKeys()).toEqual(["first", "second"]);
  });

  it("restarts the give-up clock when the network fails it in between", async () => {
    enqueue(write("first"));
    request.mockRejectedValueOnce(answered(502));
    await flushOfflineQueue(queryClient);

    // Three days with no signal, then one more server error.
    request.mockRejectedValueOnce(networkDown());
    vi.setSystemTime(NOW + DAY);
    await flushOfflineQueue(queryClient, { force: true });
    expect(queue()[0].failingSince).toBeNull();

    request.mockRejectedValueOnce(answered(503));
    vi.setSystemTime(NOW + 3 * DAY);
    await flushOfflineQueue(queryClient, { force: true });

    expect(queue()).toHaveLength(1);
    expect(queue()[0].failingSince).toBe(NOW + 3 * DAY);
  });

  it("gives up on a background write without reporting it as refused", async () => {
    enqueue(write("seen", { kind: "annotation_seen", background: true }));
    useOfflineStore.setState((state) => ({
      queue: state.queue.map((item) => ({ ...item, failingSince: NOW - GIVE_UP_AFTER_MS })),
    }));
    request.mockRejectedValueOnce(answered(500));

    expect(await flushOfflineQueue(queryClient)).toEqual({
      flushed: 0,
      rejected: 0,
      remaining: 0,
    });
  });

  it("holds only its own kind, and a background write holds nothing", async () => {
    enqueue(
      write("seen", { kind: "annotation_seen", background: true }),
      write("readiness", { kind: "readiness" }),
      write("readiness-after", { kind: "readiness" }),
      write("mark"),
    );
    request
      .mockRejectedValueOnce(answered(500))
      .mockRejectedValueOnce(answered(500))
      .mockResolvedValueOnce({});

    const summary = await flushOfflineQueue(queryClient);

    expect(sentKeys()).toEqual(["seen", "readiness", "mark"]);
    expect(summary).toEqual({ flushed: 1, rejected: 0, remaining: 3 });
  });

  it("ends the drain on a network error, which no write behind it would get past", async () => {
    enqueue(write("readiness", { kind: "readiness" }), write("mark"));
    request.mockRejectedValueOnce(networkDown());

    await flushOfflineQueue(queryClient);

    expect(sentKeys()).toEqual(["readiness"]);
  });
});

describe("a write the server answered for good", () => {
  it("is dropped and reported on a 4xx, and the queue moves on", async () => {
    enqueue(write("refused"), write("next"));
    request.mockRejectedValueOnce(answered(403)).mockResolvedValueOnce({});

    const summary = await flushOfflineQueue(queryClient);

    expect(summary).toEqual({ flushed: 1, rejected: 1, remaining: 0 });
  });

  it("settles a background write without counting it either way", async () => {
    enqueue(
      write("seen", { kind: "annotation_seen", background: true }),
      write("seen-gone", { kind: "annotation_seen", background: true }),
    );
    request.mockResolvedValueOnce({}).mockRejectedValueOnce(answered(404));

    expect(await flushOfflineQueue(queryClient)).toEqual({
      flushed: 0,
      rejected: 0,
      remaining: 0,
    });
  });

  it("counts a 410 on a replayed create as done, not refused", async () => {
    enqueue(write("erased-elsewhere"));
    request.mockRejectedValueOnce(answered(410));

    expect(await flushOfflineQueue(queryClient)).toEqual({
      flushed: 1,
      rejected: 0,
      remaining: 0,
    });
  });

  it("counts a 404 on an erase as done", async () => {
    enqueue(write("gone", { method: "DELETE" }));
    request.mockRejectedValueOnce(answered(404));

    expect(await flushOfflineQueue(queryClient)).toEqual({
      flushed: 1,
      rejected: 0,
      remaining: 0,
    });
  });

  it("does not forgive a 404 on anything but an erase", async () => {
    enqueue(write("edit", { method: "PATCH" }));
    request.mockRejectedValueOnce(answered(404));

    expect((await flushOfflineQueue(queryClient)).rejected).toBe(1);
  });
});

describe("landing a write", () => {
  it("hands the feature the answer before the write leaves the queue", async () => {
    const seenInQueue: boolean[] = [];
    registerOfflineLanding("note", (_client, landed, data) => {
      seenInQueue.push(queue().some((item) => item.id === landed.id));
      return (data as { whole?: boolean } | undefined)?.whole ?? true;
    });
    enqueue(write("whole", { kind: "note" }), write("partial", { kind: "note" }));
    request
      .mockResolvedValueOnce({ data: { whole: true } })
      .mockResolvedValueOnce({ data: { whole: false } });

    const summary = await flushOfflineQueue(queryClient);

    expect(seenInQueue).toEqual([true, true]);
    expect(summary).toEqual({ flushed: 1, rejected: 1, remaining: 0 });
  });
});

describe("reconciling after a flush", () => {
  it("re-reads only the features whose writes left the queue", async () => {
    const marks = vi.fn(() => Promise.resolve());
    const notes = vi.fn(() => Promise.resolve());
    registerOfflineReconciler("annotation", marks);
    registerOfflineReconciler("note", notes);

    enqueue(write("mark"), write("note", { kind: "note" }));
    request.mockResolvedValueOnce({}).mockRejectedValueOnce(networkDown());

    await flushOfflineQueue(queryClient);

    expect(marks).toHaveBeenCalledTimes(1);
    expect(notes).not.toHaveBeenCalled();
  });
});

describe("reading the queue back from storage", () => {
  it("drops entries that cannot be replayed and fills retry state for old ones", () => {
    const restored = readQueuedWrites([
      { id: "a", kind: "annotation", method: "POST", url: "/x/", dedupeKey: "k", label: "", createdAt: 1 },
      { id: "b", kind: "annotation", method: "TELEPORT", url: "/x/", dedupeKey: "k", createdAt: 2 },
      { id: "c", kind: "annotation", method: "POST", dedupeKey: "k", createdAt: 3 },
      "garbage",
    ]);
    expect(restored).toEqual([
      expect.objectContaining({ id: "a", attempts: 0, nextAttemptAt: 0, failingSince: null }),
    ]);
    expect(readQueuedWrites(null)).toEqual([]);
  });

  it("keeps a background write in the background after a reload", () => {
    const [restored] = readQueuedWrites([
      {
        id: "s", kind: "annotation_seen", method: "POST", url: "/x/seen/",
        dedupeKey: "k", label: "", createdAt: 1, background: true,
      },
    ]);
    expect(restored).toMatchObject({ kind: "annotation_seen", background: true });
  });
});
