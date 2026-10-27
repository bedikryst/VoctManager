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
  /** The colour's name, which is what a swatch is called to a screen reader. */
  nameKey: string;
  fallback: string;
  /**
   * Too dark to stand out on the dark tool chrome, so its swatch there is
   * outlined. The ink itself is for white paper and stays as it is.
   */
  dark: boolean;
}

/** Ink palette — crimson cue, ledger blue, breath green, gilt accent, pencil. */
export const ANNOTATION_INKS: readonly AnnotationInk[] = [
  { value: "#DC2626", managerOnly: true, nameKey: "annotations.inks.crimson", fallback: "Czerwony", dark: false },
  { value: "#2563EB", managerOnly: false, nameKey: "annotations.inks.blue", fallback: "Niebieski", dark: false },
  { value: "#15803D", managerOnly: false, nameKey: "annotations.inks.green", fallback: "Zielony", dark: false },
  { value: "#B45309", managerOnly: false, nameKey: "annotations.inks.amber", fallback: "Bursztynowy", dark: false },
  { value: "#1F2933", managerOnly: false, nameKey: "annotations.inks.graphite", fallback: "Grafitowy", dark: true },
] as const;

/** Whether the server refuses this ink from anyone but a manager. */
export const isReservedInk = (color: string): boolean =>
  ANNOTATION_INKS.some(
    (ink) => ink.managerOnly && ink.value.toLowerCase() === color.toLowerCase(),
  );

/** The swatches this writer may actually use. */
export const inksFor = (isManager: boolean): readonly AnnotationInk[] =>
  isManager ? ANNOTATION_INKS : ANNOTATION_INKS.filter((ink) => !ink.managerOnly);

/** Where a writer's ink starts: the conductor in his cue colour, everyone else
 *  in pencil. */
export const defaultInk = (isManager: boolean): string =>
  (isManager ? ANNOTATION_INKS[0] : ANNOTATION_INKS[ANNOTATION_INKS.length - 1])
    .value;
