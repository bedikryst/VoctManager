/**
 * @file bandChrome.ts
 * @description What a control in the viewer's bands looks like. The bands are
 * reserved space above and below the page, never over it, so their controls
 * carry no pill, border or shadow of their own: a flat 40 px target that lights
 * on hover. Shared with the slots that sit in a band (the annotation trigger,
 * a modal's close) so the row reads as one.
 * @module shared/ui/composites/PdfViewer
 */

/** A band control with a label: pair it with `px-3` and an 18 px icon. */
export const bandButton =
  "flex h-10 shrink-0 items-center justify-center gap-2 rounded-full text-ink-on-inverse transition-colors hover:bg-ink-on-inverse/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:pointer-events-none disabled:opacity-35";

/** A band control that is an icon alone. */
export const bandIconButton = `${bandButton} w-10`;

/**
 * An action inside the viewer's sheet: the same target, on a faint fill so it
 * reads as a button among lines of text. Pair it with `px-4`.
 */
export const sheetButton = `${bandButton} bg-ink-on-inverse/10 hover:bg-ink-on-inverse/15`;
