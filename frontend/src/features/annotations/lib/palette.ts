/**
 * @file palette.ts
 * @description The inks a marking may be written in, and which of them belong to
 * the conductor. Crimson is his: once a printed book can carry both his shared
 * marks and a singer's own, the colour is what says whose hand made which mark,
 * so a chorister's palette starts at graphite and never offers the cue colour.
 *
 * The server holds the same list in `backend/archive/annotation_palette.py` and
 * refuses a reserved ink from a non-manager; a parity test keeps the two honest,
 * because a swatch offered here and refused there is a mark that silently fails
 * to save.
 * @module features/annotations/lib
 */

export interface AnnotationInk {
  value: string;
  /** Reserved: only a manager may write it. */
  managerOnly: boolean;
}

/** Ink palette — crimson cue, ledger blue, breath green, gilt accent, pencil. */
export const ANNOTATION_INKS: readonly AnnotationInk[] = [
  { value: "#DC2626", managerOnly: true },
  { value: "#2563EB", managerOnly: false },
  { value: "#15803D", managerOnly: false },
  { value: "#B45309", managerOnly: false },
  { value: "#1F2933", managerOnly: false },
] as const;

/** The swatches this writer may actually use. */
export const inksFor = (isManager: boolean): readonly AnnotationInk[] =>
  isManager ? ANNOTATION_INKS : ANNOTATION_INKS.filter((ink) => !ink.managerOnly);

/** Where a writer's ink starts: the conductor in his cue colour, everyone else
 *  in pencil. */
export const defaultInk = (isManager: boolean): string =>
  (isManager ? ANNOTATION_INKS[0] : ANNOTATION_INKS[ANNOTATION_INKS.length - 1])
    .value;
