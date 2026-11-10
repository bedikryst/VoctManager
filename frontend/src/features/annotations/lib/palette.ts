/**
 * @file palette.ts
 * @description The inks a marking may be written in, which of them belong to the
 * conductor, and the highlighter's own colours.
 *
 * Crimson is his: once a printed book can carry both his shared marks and a
 * singer's own, the colour is what says whose hand made which mark, so a
 * chorister's palette starts at graphite and never offers the cue colour.
 *
 * The highlighter has a palette of its own, the light colours of a real marker.
 * They are no use to any other tool (yellow pen on white paper is unreadable),
 * and no ink is any use as a marker, so the two lists stay apart: a highlight is
 * written in a highlighter colour, everything else in an ink. A highlight
 * written in an ink before the highlighter had colours of its own stays valid.
 * Print turns a highlight into an underline (a translucent band is grey mush on
 * a mono printer), and a pale underline would vanish, so each highlighter colour
 * names the darker sibling it prints in.
 *
 * The server holds the same lists in `backend/archive/annotation_palette.py`
 * and refuses anything else; a parity test keeps the two honest, because a
 * swatch offered here and refused there is a mark that silently fails to save.
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

export interface HighlightInk extends AnnotationInk {
  /** The colour print underlines a highlight in. */
  print: string;
  /**
   * How strongly the colour lies on the page. It is multiplied into the paper,
   * so the engraving under it stays black at any strength; each colour is set
   * so it reads as a real marker without washing the notes out.
   */
  opacity: number;
}

/** Ink palette — crimson cue, ledger blue, breath green, gilt accent, pencil. */
export const ANNOTATION_INKS: readonly AnnotationInk[] = [
  { value: "#DC2626", managerOnly: true, nameKey: "annotations.inks.crimson", fallback: "Czerwony", dark: false },
  { value: "#2563EB", managerOnly: false, nameKey: "annotations.inks.blue", fallback: "Niebieski", dark: false },
  { value: "#15803D", managerOnly: false, nameKey: "annotations.inks.green", fallback: "Zielony", dark: false },
  { value: "#B45309", managerOnly: false, nameKey: "annotations.inks.amber", fallback: "Bursztynowy", dark: false },
  { value: "#1F2933", managerOnly: false, nameKey: "annotations.inks.graphite", fallback: "Grafitowy", dark: true },
] as const;

/** Highlighter palette — yellow first, the marker everyone reaches for. None is reserved. */
export const HIGHLIGHT_INKS: readonly HighlightInk[] = [
  { value: "#FFE14D", print: "#A16207", opacity: 0.72, managerOnly: false, nameKey: "annotations.inks.highlight_yellow", fallback: "Żółty", dark: false },
  { value: "#FFB870", print: "#C2410C", opacity: 0.62, managerOnly: false, nameKey: "annotations.inks.highlight_orange", fallback: "Jasnopomarańczowy", dark: false },
  { value: "#A7E3A0", print: "#15803D", opacity: 0.62, managerOnly: false, nameKey: "annotations.inks.highlight_green", fallback: "Jasnozielony", dark: false },
  { value: "#9CCFF5", print: "#2563EB", opacity: 0.62, managerOnly: false, nameKey: "annotations.inks.highlight_blue", fallback: "Jasnoniebieski", dark: false },
] as const;

/** How strongly a highlight written in an ink lies on the page. */
const INK_HIGHLIGHT_OPACITY = 0.42;

const sameColor = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Whether the server refuses this ink from anyone but a manager. */
export const isReservedInk = (color: string): boolean =>
  ANNOTATION_INKS.some((ink) => ink.managerOnly && sameColor(ink.value, color));

/** The swatches this writer may actually use. */
export const inksFor = (isManager: boolean): readonly AnnotationInk[] =>
  isManager ? ANNOTATION_INKS : ANNOTATION_INKS.filter((ink) => !ink.managerOnly);

/** Where a writer's ink starts: the conductor in his cue colour, everyone else
 *  in pencil. */
export const defaultInk = (isManager: boolean): string =>
  (isManager ? ANNOTATION_INKS[0] : ANNOTATION_INKS[ANNOTATION_INKS.length - 1])
    .value;

/** Where the highlighter starts, for every writer. */
export const DEFAULT_HIGHLIGHT_INK: string = HIGHLIGHT_INKS[0].value;

/** How strongly a highlight in this colour lies on the page. */
export const highlightOpacity = (color: string): number =>
  HIGHLIGHT_INKS.find((ink) => sameColor(ink.value, color))?.opacity ?? INK_HIGHLIGHT_OPACITY;
