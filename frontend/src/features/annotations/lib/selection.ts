/**
 * @file selection.ts
 * @description What the selection card does to the marks it holds, as data:
 * where a moved selection may go, what a moved mark's payload becomes, and what
 * a copy of a mark is. The overlay sends the results through the ordinary
 * per-mark writes. The keyboard reaches the selection through `SelectionKeys`.
 *
 * A selection moves as one piece. Each point is never clamped on its own: a
 * slur dragged into the margin would fold flat against the page edge. The shift
 * itself is held back instead, so the whole selection stops where its outermost
 * mark meets the edge.
 * @module features/annotations/lib
 */

import {
  isStroke,
  type AnnotationPatch,
  type MarkContent,
  type MarkDraft,
  type ScoreAnnotation,
} from "../types/annotations.dto";
import { pageFraction, unionBounds } from "./markBounds";
import { isReservedInk, type AnnotationInk } from "./palette";

/** How far a duplicate lands from its original, in page pixels, each way. */
const DUPLICATE_OFFSET_PX = 16;

/** One mark's edit within a gesture over many, with what undoes it. */
export interface MarkEdit {
  id: string;
  before: AnnotationPatch;
  after: AnnotationPatch;
}

/**
 * Marks copied from one page of the edition open, waiting to be pasted onto
 * another. Held by the stand, so it outlives the page it was taken on.
 */
export interface MarkClipboard {
  editionId: string;
  page: number;
  marks: readonly ScoreAnnotation[];
}

/** What the stand's keyboard may do to the selection on screen. */
export interface SelectionKeys {
  /** Delete or Backspace: the marks go, as one step. */
  remove: () => void;
  /**
   * An arrow key: move the marks by this many screen pixels. False when the
   * arrows are not the selection's (performance mode, where they come from a
   * page-turn pedal): the key then goes on to turn the page.
   */
  nudge: (dxPx: number, dyPx: number) => boolean;
  /**
   * Write now a nudge still waiting for the keys to rest. Undo, redo and a
   * change of tool call this first, so the nudge is a step of its own before
   * they act, never one pushed after them.
   */
  flush: () => void;
}

/** A shift of the page, 0..1 per axis. */
export interface PageShift {
  dx: number;
  dy: number;
}

/** The shift held back so that every mark in the selection stays on the page. */
export const clampShift = (
  annotations: readonly ScoreAnnotation[],
  { dx, dy }: PageShift,
): PageShift => {
  const bounds = unionBounds(annotations);
  if (!bounds) return { dx: 0, dy: 0 };
  return {
    dx: Math.min(1 - bounds.maxX, Math.max(-bounds.minX, dx)),
    dy: Math.min(1 - bounds.maxY, Math.max(-bounds.minY, dy)),
  };
};

/** A mark's kind and payload once moved by `shift`. */
export const shiftedContent = (
  annotation: ScoreAnnotation,
  { dx, dy }: PageShift,
): MarkContent => {
  if (isStroke(annotation)) {
    return {
      annotation_type: annotation.annotation_type,
      payload: {
        ...annotation.payload,
        paths: annotation.payload.paths.map((path) =>
          path.map(([x, y]) => [pageFraction(x + dx), pageFraction(y + dy)] as const),
        ),
      },
    };
  }
  switch (annotation.annotation_type) {
    case "CM":
      return {
        annotation_type: "CM",
        payload: {
          ...annotation.payload,
          x: pageFraction(annotation.payload.x + dx),
          y: pageFraction(annotation.payload.y + dy),
        },
      };
    case "ST":
      return {
        annotation_type: "ST",
        payload: {
          ...annotation.payload,
          x: pageFraction(annotation.payload.x + dx),
          y: pageFraction(annotation.payload.y + dy),
        },
      };
    // A link moves where it sits, never where it leads.
    case "LK":
      return {
        annotation_type: "LK",
        payload: {
          ...annotation.payload,
          x: pageFraction(annotation.payload.x + dx),
          y: pageFraction(annotation.payload.y + dy),
        },
      };
    default:
      return annotation;
  }
};

/**
 * The ink a copy is written in. A copy keeps its original's, except an ink this
 * writer may not use: the server would refuse the copy outright, so it is
 * written in pencil, the last swatch of every palette.
 */
const copyInk = (color: string, inks: readonly AnnotationInk[]): string => {
  if (!isReservedInk(color)) return color;
  if (inks.some((ink) => ink.value.toLowerCase() === color.toLowerCase())) return color;
  return inks[inks.length - 1]?.value ?? color;
};

/**
 * New marks copied from `annotations` onto `page`, moved by `shift`. Each keeps
 * its kind, its payload and its audience, voices included; only the page, the
 * place and an ink the writer may not use change.
 */
export const copyDrafts = (
  annotations: readonly ScoreAnnotation[],
  page: number,
  shift: PageShift,
  inks: readonly AnnotationInk[],
): MarkDraft[] =>
  annotations.map((annotation) => ({
    ...shiftedContent(annotation, shift),
    page_number: page,
    color: copyInk(annotation.color, inks),
    layer_name: annotation.layer_name,
    ...(annotation.voices?.length ? { voices: [...annotation.voices] } : {}),
  }));

/**
 * Where duplicates go: `steps` steps down and to the right, so they read at
 * once as a second set, and held on the page when the originals touch its
 * edge. A paste repeated on one page takes a step more each time, so the
 * copies fan out instead of landing on top of each other.
 */
export const duplicateShift = (
  annotations: readonly ScoreAnnotation[],
  width: number,
  height: number,
  steps = 1,
): PageShift =>
  clampShift(annotations, {
    dx: width > 0 ? (DUPLICATE_OFFSET_PX * steps) / width : 0,
    dy: height > 0 ? (DUPLICATE_OFFSET_PX * steps) / height : 0,
  });
