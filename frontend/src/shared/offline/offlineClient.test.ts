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

import { flushOfflineQueue, registerOfflineReconciler } from "./offlineClient";
import { GIVE_UP_AFTER_MS, RETRY_BASE_MS } from "./replayPolicy";
import {
  readQueuedWrites,
  useOfflineStore,
  type NewQueuedWrite,
} from "./useOfflineStore";

const NOW = Date.parse("2026-10-26T18:00:00Z");
const queryClient = {} as QueryClient;

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
  request.mockReset();
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
});

describe("a write the server answered for good", () => {
  it("is dropped and reported on a 4xx, and the queue moves on", async () => {
    enqueue(write("refused"), write("next"));
    request.mockRejectedValueOnce(answered(403)).mockResolvedValueOnce({});

    const summary = await flushOfflineQueue(queryClient);

    expect(summary).toEqual({ flushed: 1, rejected: 1, remaining: 0 });
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
});
