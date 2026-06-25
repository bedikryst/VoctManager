/**
 * @file useAnnotationHistory.ts
 * @description Undo / redo for score markup. Each edit records a reversible
 * operation; undo applies its inverse against BOTH the server and the optimistic
 * cache (re-creating a deleted mark, deleting a created one, reverting an edited
 * note). Decoupled from React Query — it takes plain create/remove/update
 * primitives, so it owns no transport. History resets when the edition changes.
 * @module features/annotations/lib
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AnnotationPatch,
  NewAnnotation,
  ScoreAnnotation,
} from "../types/annotations.dto";

const HISTORY_LIMIT = 40;

type HistoryOp =
  | { kind: "create"; annotation: ScoreAnnotation }
  | { kind: "delete"; annotation: ScoreAnnotation }
  | { kind: "clear"; annotations: ScoreAnnotation[] }
  | { kind: "update"; id: string; before: AnnotationPatch; after: AnnotationPatch };

interface Stacks {
  undo: HistoryOp[];
  redo: HistoryOp[];
}

export interface HistoryDeps {
  editionId: string | null;
  createAnnotation: (payload: NewAnnotation) => Promise<ScoreAnnotation>;
  removeAnnotation: (id: string) => Promise<void>;
  updateAnnotation: (id: string, patch: AnnotationPatch) => Promise<ScoreAnnotation>;
}

export interface AnnotationHistory {
  recordCreate: (annotation: ScoreAnnotation) => void;
  recordDelete: (annotation: ScoreAnnotation) => void;
  recordClear: (annotations: ScoreAnnotation[]) => void;
  recordUpdate: (id: string, before: AnnotationPatch, after: AnnotationPatch) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const toNew = (a: ScoreAnnotation): NewAnnotation => ({
  edition: a.edition,
  page_number: a.page_number,
  annotation_type: a.annotation_type,
  payload: a.payload,
  color: a.color,
  layer_name: a.layer_name,
});

const cap = (ops: HistoryOp[]): HistoryOp[] =>
  ops.length > HISTORY_LIMIT ? ops.slice(ops.length - HISTORY_LIMIT) : ops;

export const useAnnotationHistory = ({
  editionId,
  createAnnotation,
  removeAnnotation,
  updateAnnotation,
}: HistoryDeps): AnnotationHistory => {
  const [stacks, setStacks] = useState<Stacks>({ undo: [], redo: [] });
  const ref = useRef<Stacks>(stacks);
  const busy = useRef(false);

  const commit = useCallback((next: Stacks) => {
    ref.current = next;
    setStacks(next);
  }, []);

  // Forget the timeline whenever a different score opens.
  useEffect(() => {
    commit({ undo: [], redo: [] });
  }, [editionId, commit]);

  const pushUndo = useCallback(
    (op: HistoryOp) => {
      commit({ undo: cap([...ref.current.undo, op]), redo: [] });
    },
    [commit],
  );

  const recordCreate = useCallback(
    (annotation: ScoreAnnotation) => pushUndo({ kind: "create", annotation }),
    [pushUndo],
  );
  const recordDelete = useCallback(
    (annotation: ScoreAnnotation) => pushUndo({ kind: "delete", annotation }),
    [pushUndo],
  );
  const recordClear = useCallback(
    (annotations: ScoreAnnotation[]) => {
      if (annotations.length > 0) pushUndo({ kind: "clear", annotations });
    },
    [pushUndo],
  );
  const recordUpdate = useCallback(
    (id: string, before: AnnotationPatch, after: AnnotationPatch) =>
      pushUndo({ kind: "update", id, before, after }),
    [pushUndo],
  );

  // Perform the inverse of an op; return the op to push onto the opposite stack.
  const invert = useCallback(
    async (op: HistoryOp, direction: "undo" | "redo"): Promise<HistoryOp> => {
      const undoing = direction === "undo";
      switch (op.kind) {
        case "create": {
          if (undoing) {
            await removeAnnotation(op.annotation.id);
            return op;
          }
          const created = await createAnnotation(toNew(op.annotation));
          return { kind: "create", annotation: created };
        }
        case "delete": {
          if (undoing) {
            const created = await createAnnotation(toNew(op.annotation));
            return { kind: "delete", annotation: created };
          }
          await removeAnnotation(op.annotation.id);
          return op;
        }
        case "clear": {
          if (undoing) {
            const recreated = await Promise.all(
              op.annotations.map((a) => createAnnotation(toNew(a))),
            );
            return { kind: "clear", annotations: recreated };
          }
          await Promise.all(op.annotations.map((a) => removeAnnotation(a.id)));
          return op;
        }
        case "update": {
          await updateAnnotation(op.id, undoing ? op.before : op.after);
          return op;
        }
      }
    },
    [createAnnotation, removeAnnotation, updateAnnotation],
  );

  const step = useCallback(
    async (direction: "undo" | "redo") => {
      if (busy.current) return;
      const source = direction === "undo" ? ref.current.undo : ref.current.redo;
      if (source.length === 0) return;
      const op = source[source.length - 1];
      busy.current = true;
      try {
        const inverseOp = await invert(op, direction);
        const current = ref.current;
        if (direction === "undo") {
          commit({
            undo: current.undo.slice(0, -1),
            redo: cap([...current.redo, inverseOp]),
          });
        } else {
          commit({
            undo: cap([...current.undo, inverseOp]),
            redo: current.redo.slice(0, -1),
          });
        }
      } catch {
        // Mutation onError already rolled the cache back; leave stacks intact.
      } finally {
        busy.current = false;
      }
    },
    [commit, invert],
  );

  const undo = useCallback(() => void step("undo"), [step]);
  const redo = useCallback(() => void step("redo"), [step]);

  return {
    recordCreate,
    recordDelete,
    recordClear,
    recordUpdate,
    undo,
    redo,
    canUndo: stacks.undo.length > 0,
    canRedo: stacks.redo.length > 0,
  };
};
