/**
 * @file useAnnotationHistory.ts
 * @description Undo / redo for score markup. Every gesture goes through here, so
 * each step on the timeline holds the write that put the page in its state, and
 * the next move reads that write's answer before it acts.
 *
 * The rules:
 *   · a write that was confirmed, or durably queued, counts as done — an undo
 *     made in a basement is an undo, not a failure to be retried by hand;
 *   · a write the server refused never happened: its step leaves the timeline
 *     (the mutation layer has already said why, once);
 *   · erased marks come back as THEMSELVES — the same ids, authors and stacking
 *     order — through `reviveMarks`, which cancels an erase still waiting unsent
 *     in the queue and restores anything that may have reached the server. The
 *     one exception is a mark the server never had: an erase that withdrew an
 *     unsent create from the queue is undone by queuing that create again;
 *   · steps run one after another, each waiting for its own write, so an undo
 *     of an edit can never overtake the undo of the erase in front of it;
 *   · a press acts on the step that was on top when it was pressed. Steps wait
 *     on writes, so a press can run seconds later, and by then a new stroke may
 *     be on top — the undo the reader pressed is still the one they get.
 *
 * Owns no transport: it takes the mutation layer's writers. History resets when
 * the edition changes.
 * @module features/annotations/lib
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { newMarkId, type MarkWrite } from "../api/annotations.queries";
import type { AnnotationPatch, ScoreAnnotation } from "../types/annotations.dto";

const HISTORY_LIMIT = 40;

type HistoryOp =
  | { kind: "create"; annotation: ScoreAnnotation }
  | { kind: "delete"; annotation: ScoreAnnotation }
  | { kind: "clear"; annotations: readonly ScoreAnnotation[]; clearId: string }
  | { kind: "update"; id: string; before: AnnotationPatch; after: AnnotationPatch };

/** One step of the timeline, and the write that put the page in its state. */
interface Step {
  op: HistoryOp;
  write: Promise<MarkWrite>;
}

interface Stacks {
  undo: Step[];
  redo: Step[];
}

export interface HistoryDeps {
  editionId: string | null;
  createMark: (annotation: ScoreAnnotation) => Promise<MarkWrite>;
  updateMark: (id: string, patch: AnnotationPatch) => Promise<MarkWrite>;
  eraseMark: (annotation: ScoreAnnotation) => Promise<MarkWrite>;
  clearMarks: (
    annotations: readonly ScoreAnnotation[],
    clearId: string,
  ) => Promise<MarkWrite>;
  reviveMarks: (
    annotations: readonly ScoreAnnotation[],
    clearId?: string,
  ) => Promise<MarkWrite>;
}

export interface AnnotationHistory {
  create: (annotation: ScoreAnnotation) => void;
  update: (id: string, before: AnnotationPatch, after: AnnotationPatch) => void;
  erase: (annotation: ScoreAnnotation) => void;
  /** Wipes exactly these marks — what the page showed as clearable. */
  clear: (annotations: readonly ScoreAnnotation[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const cap = (steps: Step[]): Step[] =>
  steps.length > HISTORY_LIMIT ? steps.slice(steps.length - HISTORY_LIMIT) : steps;

export const useAnnotationHistory = (deps: HistoryDeps): AnnotationHistory => {
  const { editionId } = deps;
  const [stacks, setStacks] = useState<Stacks>({ undo: [], redo: [] });
  const ref = useRef<Stacks>(stacks);
  // Steps run later than the render that queued them; they write through the
  // writers of the edition that is open when they run. The writers and the
  // generation change together, in the commit, so a resumed step never sees
  // the new edition's writers under the old edition's generation.
  const writers = useRef(deps);
  const generation = useRef(0);
  const openEdition = useRef(editionId);
  const chain = useRef<Promise<void>>(Promise.resolve());
  /** Steps a press still in the chain is bound to; the next press reaches past them. */
  const claimed = useRef(new Set<Step>());
  /** Presses still in the chain, per direction. */
  const pending = useRef({ undo: 0, redo: 0 });

  const commit = useCallback((next: Stacks) => {
    ref.current = next;
    setStacks(next);
  }, []);

  useLayoutEffect(() => {
    writers.current = deps;
    if (openEdition.current === editionId) return;
    // A different score is open: forget the timeline.
    openEdition.current = editionId;
    generation.current += 1;
    commit({ undo: [], redo: [] });
  });

  /** A step whose write the server refused never happened. */
  const forget = useCallback(
    (step: Step) => {
      const { undo, redo } = ref.current;
      if (!undo.includes(step) && !redo.includes(step)) return;
      commit({
        undo: undo.filter((candidate) => candidate !== step),
        redo: redo.filter((candidate) => candidate !== step),
      });
    },
    [commit],
  );

  const track = useCallback(
    (step: Step): Step => {
      step.write.catch(() => forget(step));
      return step;
    },
    [forget],
  );

  const push = useCallback(
    (op: HistoryOp, write: Promise<MarkWrite>) => {
      const step = track({ op, write });
      commit({ undo: cap([...ref.current.undo, step]), redo: [] });
    },
    [commit, track],
  );

  const create = useCallback(
    (annotation: ScoreAnnotation) =>
      push({ kind: "create", annotation }, writers.current.createMark(annotation)),
    [push],
  );

  const update = useCallback(
    (id: string, before: AnnotationPatch, after: AnnotationPatch) =>
      push({ kind: "update", id, before, after }, writers.current.updateMark(id, after)),
    [push],
  );

  const erase = useCallback(
    (annotation: ScoreAnnotation) =>
      push({ kind: "delete", annotation }, writers.current.eraseMark(annotation)),
    [push],
  );

  const clear = useCallback(
    (annotations: readonly ScoreAnnotation[]) => {
      if (annotations.length === 0) return;
      const clearId = newMarkId();
      push(
        { kind: "clear", annotations, clearId },
        writers.current.clearMarks(annotations, clearId),
      );
    },
    [push],
  );

  /**
   * The write that reverses `step` (undo) or replays it (redo). `answer` is
   * what the step's own write came to: for an erase, whether it only withdrew
   * an unsent create.
   */
  const inverse = useCallback(
    (step: Step, answer: MarkWrite, undoing: boolean): Step => {
      const { createMark, updateMark, eraseMark, clearMarks, reviveMarks } =
        writers.current;
      const bringBack = (annotation: ScoreAnnotation, erased: MarkWrite) =>
        erased === "discarded" ? createMark(annotation) : reviveMarks([annotation]);
      const { op } = step;
      switch (op.kind) {
        case "create":
          return {
            op,
            write: undoing ? eraseMark(op.annotation) : bringBack(op.annotation, answer),
          };
        case "delete":
          return {
            op,
            write: undoing ? bringBack(op.annotation, answer) : eraseMark(op.annotation),
          };
        case "clear": {
          if (undoing) return { op, write: reviveMarks(op.annotations, op.clearId) };
          const clearId = newMarkId();
          return {
            op: { ...op, clearId },
            write: clearMarks(op.annotations, clearId),
          };
        }
        case "update":
          return { op, write: updateMark(op.id, undoing ? op.before : op.after) };
      }
    },
    [],
  );

  /**
   * `bound` is the step the press chose; without one (see `run`) the step on
   * top when the chain reaches this press.
   */
  const step = useCallback(
    async (direction: "undo" | "redo", era: number, bound: Step | undefined) => {
      const undoing = direction === "undo";
      if (era !== generation.current) return;
      const source = undoing ? ref.current.undo : ref.current.redo;
      const current = bound ?? source[source.length - 1];
      if (!current) return;

      let answer: MarkWrite;
      try {
        answer = await current.write;
      } catch {
        return; // refused — `forget` has already taken it off the timeline
      }
      if (era !== generation.current) return;
      const { undo, redo } = ref.current;
      if (!(undoing ? undo : redo).includes(current)) return;

      const next = track(inverse(current, answer, undoing));
      // The timeline moves at once; the write lands behind it.
      commit(
        undoing
          ? { undo: undo.filter((s) => s !== current), redo: cap([...redo, next]) }
          : { undo: cap([...undo, next]), redo: redo.filter((s) => s !== current) },
      );
      await next.write.catch(() => {});
    },
    [commit, inverse, track],
  );

  /**
   * Binds the press to its step now. Only while a press the other way is still
   * in the chain is there nothing to bind to: the step it will put on this
   * stack does not exist yet, so this press takes whatever is on top when its
   * turn comes — an undo and a redo pressed together still cancel out.
   */
  const run = useCallback(
    (direction: "undo" | "redo") => {
      const opposite = direction === "undo" ? "redo" : "undo";
      const era = generation.current;
      let bound: Step | undefined;
      if (pending.current[opposite] === 0) {
        const source = direction === "undo" ? ref.current.undo : ref.current.redo;
        bound = [...source].reverse().find((candidate) => !claimed.current.has(candidate));
        if (!bound) return;
        claimed.current.add(bound);
      }
      pending.current[direction] += 1;
      chain.current = chain.current
        .then(() => step(direction, era, bound))
        .finally(() => {
          pending.current[direction] -= 1;
          if (bound) claimed.current.delete(bound);
        });
    },
    [step],
  );

  const undo = useCallback(() => run("undo"), [run]);
  const redo = useCallback(() => run("redo"), [run]);

  return {
    create,
    update,
    erase,
    clear,
    undo,
    redo,
    canUndo: stacks.undo.length > 0,
    canRedo: stacks.redo.length > 0,
  };
};
