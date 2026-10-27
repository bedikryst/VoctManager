/**
 * @file useAnnotationHistory.test.tsx
 * @description Undo and redo against a writer that answers the way the
 * mutation layer does: "saved", "queued", "discarded", or a rejection.
 *
 * The failures this guards were all silent: an undo made without signal that
 * drew a copy of the mark under a new id every time it was pressed; an erase
 * undone as a fresh mark in the undoer's hand, its author and place in the
 * stack lost; and one refused write wedging the whole timeline behind it. And a
 * gesture over a selection taking as many undos as it touched marks.
 * @module features/annotations/lib/useAnnotationHistory.test
 */

import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useAnnotationHistory, type HistoryDeps } from "./useAnnotationHistory";
import type { MarkWrite } from "../api/annotations.queries";
import type { ScoreAnnotation } from "../types/annotations.dto";

const EDITION = "edition-1";

const mark = (id: string): ScoreAnnotation => ({
  id,
  edition: EDITION,
  page_number: 1,
  annotation_type: "CM",
  payload: { x: 0.5, y: 0.5, text: "oddech", display: "pin" },
  color: "#1F2933",
  layer_name: "personal",
  created_by: "user-artist",
  created_at: "2026-08-25T10:00:00Z",
  updated_at: "2026-08-25T10:00:00Z",
});

const refused = () =>
  Promise.reject(Object.assign(new Error("HTTP 403"), { response: { status: 403 } }));

const writers = (answer: MarkWrite = "queued") => ({
  createMark: vi.fn<HistoryDeps["createMark"]>(() => Promise.resolve(answer)),
  updateMark: vi.fn<HistoryDeps["updateMark"]>(() => Promise.resolve(answer)),
  eraseMark: vi.fn<HistoryDeps["eraseMark"]>(() => Promise.resolve(answer)),
  clearMarks: vi.fn<HistoryDeps["clearMarks"]>(() => Promise.resolve(answer)),
  reviveMarks: vi.fn<HistoryDeps["reviveMarks"]>(() => Promise.resolve(answer)),
});

const mount = (deps: ReturnType<typeof writers>) =>
  renderHook(() => useAnnotationHistory({ editionId: EDITION, ...deps }));

/** Lets the step chain and the writes it awaits run to the end. */
const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("undo without signal", () => {
  it("brings an erased mark back as itself, however often it is pressed", async () => {
    const deps = writers("queued");
    const { result } = mount(deps);
    const erased = mark("m1");

    act(() => result.current.erase(erased));
    act(() => result.current.undo());
    act(() => result.current.undo());
    await settle();

    expect(deps.reviveMarks).toHaveBeenCalledTimes(1);
    expect(deps.reviveMarks).toHaveBeenCalledWith([erased]);
    expect(deps.createMark).not.toHaveBeenCalled();
    expect(result.current.canRedo).toBe(true);
    expect(result.current.canUndo).toBe(false);
  });

  it("queues the create again when the erase only withdrew an unsent one", async () => {
    const deps = writers("queued");
    deps.eraseMark.mockResolvedValue("discarded");
    const { result } = mount(deps);
    const drawn = mark("m1");

    act(() => result.current.erase(drawn));
    act(() => result.current.undo());
    await settle();

    expect(deps.createMark).toHaveBeenCalledWith(drawn);
    expect(deps.reviveMarks).not.toHaveBeenCalled();
  });

  it("hands an undone clear its own id, so a queued one is cancelled in place", async () => {
    const deps = writers("queued");
    const { result } = mount(deps);
    const wiped = [mark("m1"), mark("m2")];

    act(() => result.current.clear(wiped));
    act(() => result.current.undo());
    await settle();

    const clearId = deps.clearMarks.mock.calls[0][1];
    expect(deps.reviveMarks).toHaveBeenCalledWith(wiped, clearId);
  });
});

describe("a press waiting its turn", () => {
  it("undoes the step on top when it was pressed, not a stroke drawn while it waited", async () => {
    const deps = writers("saved");
    const { result } = mount(deps);
    let release: (answer: MarkWrite) => void = () => {};

    act(() => result.current.create(mark("a")));
    act(() => result.current.create(mark("b")));
    await settle();
    deps.eraseMark.mockImplementationOnce(
      () => new Promise<MarkWrite>((resolve) => (release = resolve)),
    );
    act(() => result.current.undo()); // erases b; its write hangs
    await settle();
    act(() => result.current.undo()); // meant for a
    act(() => result.current.create(mark("c")));
    await act(async () => release("saved"));
    await settle();

    expect(deps.eraseMark.mock.calls.map(([erased]) => erased.id)).toEqual(["b", "a"]);
  });
});

describe("redo", () => {
  it("restores the same mark rather than drawing a new one", async () => {
    const deps = writers("saved");
    const { result } = mount(deps);
    const drawn = mark("m1");

    act(() => result.current.create(drawn));
    act(() => result.current.undo());
    act(() => result.current.redo());
    await settle();

    expect(deps.eraseMark).toHaveBeenCalledWith(drawn);
    expect(deps.reviveMarks).toHaveBeenCalledWith([drawn]);
    expect(deps.createMark).toHaveBeenCalledTimes(1);
  });

  it("re-queues a create that its undo withdrew before it was sent", async () => {
    const deps = writers("queued");
    deps.eraseMark.mockResolvedValue("discarded");
    const { result } = mount(deps);
    const drawn = mark("m1");

    act(() => result.current.create(drawn));
    act(() => result.current.undo());
    act(() => result.current.redo());
    await settle();

    expect(deps.createMark).toHaveBeenCalledTimes(2);
    expect(deps.createMark).toHaveBeenLastCalledWith(drawn);
  });
});

describe("a write the server refused", () => {
  it("never reaches the timeline", async () => {
    const deps = writers("saved");
    deps.createMark.mockImplementation(refused);
    const { result } = mount(deps);

    act(() => result.current.create(mark("m1")));
    await settle();

    expect(result.current.canUndo).toBe(false);
  });

  it("drops a refused undo instead of wedging the steps before it", async () => {
    const deps = writers("saved");
    const { result } = mount(deps);
    const first = mark("first");
    const second = mark("second");

    act(() => result.current.create(first));
    act(() => result.current.create(second));
    deps.eraseMark.mockImplementationOnce(refused);
    act(() => result.current.undo());
    await settle();

    // The refused step is gone from both stacks; the next undo reaches `first`.
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    await settle();
    expect(deps.eraseMark).toHaveBeenLastCalledWith(first);
    expect(result.current.canUndo).toBe(false);
  });
});

describe("one step at a time", () => {
  it("does not start an undo before the write in front of it has settled", async () => {
    const deps = writers("saved");
    let finishRevive: (answer: MarkWrite) => void = () => {};
    deps.reviveMarks.mockImplementation(
      () => new Promise<MarkWrite>((resolve) => (finishRevive = resolve)),
    );
    const { result } = mount(deps);
    const target = mark("m1");

    act(() => result.current.update(target.id, { color: "#1F2933" }, { color: "#2563EB" }));
    act(() => result.current.erase(target));
    act(() => result.current.undo()); // revive, held open
    act(() => result.current.undo()); // the edit's undo must wait for it
    await settle();

    expect(deps.updateMark).toHaveBeenCalledTimes(1);
    await act(async () => finishRevive("saved"));
    await settle();
    expect(deps.updateMark).toHaveBeenLastCalledWith(target.id, { color: "#1F2933" });
  });
});

describe("one gesture over many marks", () => {
  it("is undone in one step, last part first, and redone in one", async () => {
    const deps = writers("saved");
    const { result } = mount(deps);

    act(() =>
      result.current.group([
        { kind: "update", id: "a", before: { color: "#1F2933" }, after: { color: "#2563EB" } },
        { kind: "update", id: "b", before: { color: "#15803D" }, after: { color: "#2563EB" } },
      ]),
    );
    await settle();
    act(() => result.current.undo());
    await settle();

    expect(deps.updateMark.mock.calls.slice(2)).toEqual([
      ["b", { color: "#15803D" }],
      ["a", { color: "#1F2933" }],
    ]);
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    await settle();
    expect(deps.updateMark.mock.calls.slice(4)).toEqual([
      ["a", { color: "#2563EB" }],
      ["b", { color: "#2563EB" }],
    ]);
    expect(result.current.canUndo).toBe(true);
  });

  it("brings duplicates back as themselves after their undo", async () => {
    const deps = writers("saved");
    const { result } = mount(deps);
    const copies = [mark("c1"), mark("c2")];

    act(() => result.current.group(copies.map((annotation) => ({ kind: "create", annotation }))));
    act(() => result.current.undo());
    act(() => result.current.redo());
    await settle();

    expect(deps.eraseMark.mock.calls.map(([erased]) => erased.id)).toEqual(["c2", "c1"]);
    expect(deps.reviveMarks.mock.calls.map(([revived]) => revived[0].id)).toEqual([
      "c1",
      "c2",
    ]);
    expect(deps.createMark).toHaveBeenCalledTimes(2);
  });

  it("undoes only the parts that landed, and leaves when none did", async () => {
    const deps = writers("saved");
    deps.updateMark.mockImplementationOnce(refused);
    const { result } = mount(deps);

    act(() =>
      result.current.group([
        { kind: "update", id: "a", before: { color: "#1F2933" }, after: { color: "#2563EB" } },
        { kind: "update", id: "b", before: { color: "#15803D" }, after: { color: "#2563EB" } },
      ]),
    );
    await settle();
    act(() => result.current.undo());
    await settle();
    expect(deps.updateMark).toHaveBeenLastCalledWith("b", { color: "#15803D" });
    expect(deps.updateMark).toHaveBeenCalledTimes(3);

    deps.createMark.mockImplementation(refused);
    act(() =>
      result.current.group([
        { kind: "create", annotation: mark("x") },
        { kind: "create", annotation: mark("y") },
      ]),
    );
    await settle();
    expect(result.current.canUndo).toBe(false);
  });
});

describe("marks put aside", () => {
  it("ends the timeline, and a press already waiting does nothing", async () => {
    const deps = writers("saved");
    let finishCreate: (answer: MarkWrite) => void = () => {};
    deps.createMark.mockImplementationOnce(
      () => new Promise<MarkWrite>((resolve) => (finishCreate = resolve)),
    );
    const { result } = mount(deps);

    act(() => result.current.create(mark("m1")));
    act(() => result.current.undo()); // waits on the create
    act(() => result.current.reset(EDITION));
    await act(async () => finishCreate("saved"));
    await settle();

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    // The row is archived now: an erase would answer 404.
    expect(deps.eraseMark).not.toHaveBeenCalled();
  });

  it("leaves another edition's timeline alone", () => {
    const deps = writers("saved");
    const { result } = mount(deps);

    act(() => result.current.create(mark("m1")));
    act(() => result.current.reset("edition-other"));

    expect(result.current.canUndo).toBe(true);
  });
});
