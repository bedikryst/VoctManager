/**
 * @file toolbarChrome.ts
 * @description The glass the annotation toolbar is made of, shared by its
 * parts: the tool row or rail, the "who sees it" strip and the options panel.
 * Each part owns its own chrome (the viewer only lends it a corner), so a
 * collapsed bar is one clean trigger and an open one never wears a pill inside
 * a pill.
 * @module features/annotations/components
 */

/** Dark glass over the score, without its shape. */
export const glassChrome =
  "pointer-events-auto border border-line-on-inverse bg-surface-inverse/70 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl";

/** A single-row pill: the collapsed trigger and the book's bare bar. */
export const barChrome = `${glassChrome} flex items-center rounded-full`;

/**
 * A bar that may wrap to a second line on the narrowest phones. Its radius is
 * half a one-line bar's height, so one line still reads as a pill and two read
 * as a rounded card.
 */
export const wrappingBarChrome = `${glassChrome} flex flex-wrap items-center rounded-3xl`;

/** The active tool's options: same glass, softer corners. */
export const panelChrome = `${glassChrome} rounded-2xl p-2.5`;

export const pillButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-on-inverse transition-colors";
