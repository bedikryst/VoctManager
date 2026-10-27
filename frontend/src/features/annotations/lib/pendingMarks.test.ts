/**
 * @file pendingMarks.test.ts
 * @description The offline queue's arithmetic, which is the part nobody can see
 * failing until a rehearsal is already lost.
 *
 * Two properties are load-bearing. The queue must carry the reader's INTENT, not
 * their keystrokes — a mark drawn then edited has to reach the server as one
 * finished mark, and a mark drawn then rubbed out has to reach it as nothing at
 * all, because a PATCH or DELETE replayed against a row the server never
 * received is a write that dies on arrival. And the page must be composable from
 * `server rows ⊕ queue` at any moment, since that composition is what makes a
 * refetch (or a reload on the train) harmless.
 * @module features/annotations/lib/pendingMarks.test
 */

import { describe, expect, it } from "vitest";

import {
  applyPendingMarks,
  collapseClear,
  collapseCreate,
  collapseDelete,
  collapseRestore,
  collapseUpdate,
  isMarkOp,
  pendingMarkEntries,
} from "./pendingMarks";
import type { ScoreAnnotation } from "../types/annotations.dto";
import type { QueuedWrite } from "@/shared/offline/useOfflineStore";

const EDITION = "edition-1";

const mark = (id: string, overrides: Partial<ScoreAnnotation> = {}): ScoreAnnotation => ({
  id,
  edition: EDITION,
  page_number: 1,
  annotation_type: "CM",
  payload: { x: 0.5, y: 0.5, text: "oddech", display: "pin" },
  color: "#1F2933",
  layer_name: "personal",
  created_by: null,
  created_at: "2026-08-25T10:00:00Z",
  updated_at: "2026-08-25T10:00:00Z",
  ...overrides,
});

/** Replays a collapse decision against a queue, the way the store would. */
const enqueue = (
  queue: QueuedWrite[],
  collapsed: ReturnType<typeof collapseCreate>,
  at: number,
): QueuedWrite[] => {
  let next = queue.filter((write) => !collapsed.drop.includes(write.id));
  if (collapsed.replace) {
    next = next.filter(
      (write) => write.dedupeKey !== collapsed.replace!.dedupeKey,
    );
    next = [
      ...next,
      {
        id: `q-${at}`,
        kind: "annotation",
        method: collapsed.replace.method,
        url: collapsed.replace.url,
        body: collapsed.replace.body,
        dedupeKey: collapsed.replace.dedupeKey,
        label: "test",
        createdAt: at,
        attempts: 0,
        nextAttemptAt: 0,
        failingSince: null,
        userId: null,
        meta: collapsed.replace.meta,
      },
    ];
  }
  return next;
};

/** The replay loop has started this many tries of the queued write. */
const attempted = (queue: QueuedWrite[], id: string, attempts = 1): QueuedWrite[] =>
  queue.map((write) => (write.id === id ? { ...write, attempts } : write));

const entries = (queue: QueuedWrite[]) => pendingMarkEntries(queue, EDITION);
const isPersonal = (a: ScoreAnnotation) => a.layer_name === "personal";

describe("collapsing writes to one mark", () => {
  it("folds an edit into a create the server has not seen", () => {
    const drawn = mark("m1");
    let queue = enqueue([], collapseCreate(drawn), 1);
    queue = enqueue(
      queue,
      collapseUpdate(entries(queue), EDITION, "m1", { color: "#2563EB" }),
      2,
    );

    // One write, still a POST, already carrying the new colour: the server never
    // sees a PATCH against a row it does not have.
    expect(queue).toHaveLength(1);
    expect(queue[0].method).toBe("POST");
    expect(queue[0].body).toMatchObject({ id: "m1", color: "#2563EB" });
  });

  it("cancels a create that was rubbed out before it ever sent", () => {
    let queue = enqueue([], collapseCreate(mark("m1")), 1);
    const collapsed = collapseDelete(entries(queue), EDITION, "m1");
    queue = enqueue(queue, collapsed, 2);

    expect(collapsed.replace).toBeNull();
    expect(queue).toEqual([]);
  });

  it("keeps a DELETE behind a create whose live request already left", () => {
    // The reply died, not necessarily the write: the server may hold the mark.
    let queue = enqueue([], collapseCreate(mark("m1"), { sent: true }), 1);
    const collapsed = collapseDelete(entries(queue), EDITION, "m1");
    queue = enqueue(queue, collapsed, 2);

    expect(queue.map((write) => write.method)).toEqual(["POST", "DELETE"]);
    expect(applyPendingMarks([], entries(queue), isPersonal)).toEqual([]);
  });

  it("keeps a DELETE behind a create the replay loop has tried", () => {
    let queue = enqueue([], collapseCreate(mark("m1")), 1);
    queue = attempted(queue, "q-1");
    queue = enqueue(queue, collapseDelete(entries(queue), EDITION, "m1"), 2);

    expect(queue.map((write) => write.method)).toEqual(["POST", "DELETE"]);
  });

  it("carries 'sent' through an edit folded into the create", () => {
    let queue = enqueue([], collapseCreate(mark("m1"), { sent: true }), 1);
    queue = enqueue(
      queue,
      collapseUpdate(entries(queue), EDITION, "m1", { color: "#2563EB" }),
      2,
    );
    queue = enqueue(queue, collapseDelete(entries(queue), EDITION, "m1"), 3);

    expect(queue.map((write) => write.method)).toEqual(["POST", "DELETE"]);
  });

  it("keeps a DELETE for a mark the server already holds", () => {
    const queue = enqueue([], collapseDelete([], EDITION, "server-mark"), 1);
    expect(queue).toHaveLength(1);
    expect(queue[0].method).toBe("DELETE");
    expect(queue[0].url).toContain("server-mark");
  });

  it("never lets an erase supersede an edit queued before it", () => {
    let queue = enqueue(
      [],
      collapseUpdate([], EDITION, "server-mark", { color: "#2563EB" }),
      1,
    );
    queue = enqueue(queue, collapseDelete(entries(queue), EDITION, "server-mark"), 2);
    expect(queue.map((write) => write.method)).toEqual(["PATCH", "DELETE"]);
  });

  it("merges successive edits rather than stacking them", () => {
    let queue = enqueue(
      [],
      collapseUpdate([], EDITION, "server-mark", { color: "#2563EB" }),
      1,
    );
    queue = enqueue(
      queue,
      collapseUpdate(entries(queue), EDITION, "server-mark", {
        payload: { x: 0.1, y: 0.2, text: "cisza" },
      }),
      2,
    );

    expect(queue).toHaveLength(1);
    expect(queue[0].body).toMatchObject({
      color: "#2563EB",
      payload: { text: "cisza" },
    });
  });

  it("keeps two different marks apart", () => {
    let queue = enqueue([], collapseCreate(mark("m1")), 1);
    queue = enqueue(queue, collapseCreate(mark("m2")), 2);
    expect(queue).toHaveLength(2);
  });
});

describe("drawing the queue back onto the page", () => {
  it("puts an unsent mark back after a refetch wiped it", () => {
    const queue = enqueue([], collapseCreate(mark("m1")), 1);
    const page = applyPendingMarks([], entries(queue), isPersonal);
    expect(page.map((row) => row.id)).toEqual(["m1"]);
  });

  it("never doubles a mark the server turned out to have after all", () => {
    // The write landed; only its reply died. The queue still holds the create.
    const queue = enqueue([], collapseCreate(mark("m1")), 1);
    const page = applyPendingMarks([mark("m1")], entries(queue), isPersonal);
    expect(page).toHaveLength(1);
  });

  it("hides a mark whose erase is still waiting", () => {
    const queue = enqueue([], collapseDelete([], EDITION, "m1"), 1);
    const page = applyPendingMarks([mark("m1")], entries(queue), isPersonal);
    expect(page).toEqual([]);
  });

  it("wipes exactly the marks a pending clear names", () => {
    const queue = enqueue([], collapseClear(EDITION, "clear-1", ["mine"]), 1);
    const page = applyPendingMarks(
      [mark("mine"), mark("also-mine"), mark("theirs", { layer_name: "shared" })],
      entries(queue),
      isPersonal,
    );
    expect(page.map((row) => row.id)).toEqual(["also-mine", "theirs"]);
  });

  it("falls back to the reader's scope for a clear an older build queued", () => {
    const legacy: QueuedWrite = {
      id: "legacy",
      kind: "annotation",
      method: "POST",
      url: "/api/archive/annotations/clear/",
      body: { edition: EDITION },
      dedupeKey: `annotation-clear:${EDITION}`,
      label: "test",
      createdAt: 1,
      attempts: 0,
      nextAttemptAt: 0,
      failingSince: null,
      userId: null,
      meta: { op: "clear", editionId: EDITION },
    };
    const page = applyPendingMarks(
      [mark("mine"), mark("theirs", { layer_name: "shared" })],
      entries([legacy]),
      isPersonal,
    );
    expect(page.map((row) => row.id)).toEqual(["theirs"]);
  });

  it("respects the order a clear was made in", () => {
    // Drawn, then everything wiped, then drawn again: only the last one stands.
    let queue = enqueue([], collapseCreate(mark("before")), 1);
    queue = enqueue(queue, collapseClear(EDITION, "clear-1", ["before"]), 2);
    queue = enqueue(queue, collapseCreate(mark("after")), 3);

    const page = applyPendingMarks([], entries(queue), isPersonal);
    expect(page.map((row) => row.id)).toEqual(["after"]);
  });

  it("puts restored marks back where they stood in the stack", () => {
    const first = mark("first", { created_at: "2026-08-25T10:00:00Z" });
    const middle = mark("middle", { created_at: "2026-08-25T11:00:00Z" });
    const last = mark("last", { created_at: "2026-08-25T12:00:00Z" });
    const queue = enqueue([], collapseRestore(EDITION, "restore-1", [middle]), 1);

    const page = applyPendingMarks([first, last], entries(queue), isPersonal);
    expect(page.map((row) => row.id)).toEqual(["first", "middle", "last"]);
  });

  it("ignores queued writes belonging to another score", () => {
    const queue = enqueue([], collapseCreate(mark("m1")), 1);
    expect(pendingMarkEntries(queue, "some-other-edition")).toEqual([]);
  });

  it("leaves the page untouched when nothing is queued", () => {
    const rows = [mark("m1")];
    expect(applyPendingMarks(rows, [], isPersonal)).toBe(rows);
  });
});

describe("reading a queued echo back from storage", () => {
  it("accepts every shape this build writes", () => {
    const writes = [
      collapseCreate(mark("m1")),
      collapseUpdate([], EDITION, "m1", { color: "#2563EB" }),
      collapseDelete([], EDITION, "m1"),
      collapseClear(EDITION, "clear-1", ["m1"]),
      collapseRestore(EDITION, "restore-1", [mark("m1")]),
    ];
    for (const collapsed of writes) {
      expect(isMarkOp(collapsed.replace?.meta)).toBe(true);
    }
  });

  it("refuses an echo it could not draw", () => {
    expect(isMarkOp({ op: "create", editionId: EDITION, annotationId: "m1" })).toBe(false);
    expect(
      isMarkOp({
        op: "create",
        editionId: EDITION,
        annotationId: "m1",
        annotation: { ...mark("m1"), payload: null },
      }),
    ).toBe(false);
    expect(isMarkOp({ op: "clear", editionId: EDITION, ids: [1, 2] })).toBe(false);
    expect(isMarkOp({ op: "restore", editionId: EDITION, annotations: [{}] })).toBe(false);
    expect(isMarkOp({ op: "teleport", editionId: EDITION })).toBe(false);
  });

  it("keeps a damaged entry off the page instead of throwing", () => {
    const damaged: QueuedWrite = {
      id: "damaged",
      kind: "annotation",
      method: "POST",
      url: "/api/archive/annotations/",
      body: {},
      dedupeKey: "annotation:m1",
      label: "test",
      createdAt: 1,
      attempts: 0,
      nextAttemptAt: 0,
      failingSince: null,
      userId: null,
      meta: { op: "update", editionId: EDITION, annotationId: "m1", patch: null },
    };
    expect(pendingMarkEntries([damaged], EDITION)).toEqual([]);
  });
});
