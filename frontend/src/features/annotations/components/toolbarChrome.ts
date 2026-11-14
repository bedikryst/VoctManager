/**
 * @file toolbarChrome.ts
 * @description What the annotation toolbar is made of, shared by its parts.
 * The row and the collapsed trigger sit in the viewer's top band, which is
 * reserved above the page, so they are flat. What lies over the music — the
 * rail in the margin, the "who sees it" strip and the options panel under the
 * row — keeps dark glass so it reads against the page.
 * @module features/annotations/components
 */

/** Dark glass over the score, without its shape. */
export const glassChrome =
  "pointer-events-auto border border-line-on-inverse bg-surface-inverse/70 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl";

/** A row in the top band: no glass, the band is its ground. */
export const bandBar = "pointer-events-auto flex h-10 items-center";

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
