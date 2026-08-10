/**
 * @file photoCredit.ts
 * @description Where a photograph came from, phrased the same way on every surface that prints it.
 *  Three cases, and each one is a different relation to the frame:
 *
 *  - `credit` — the HAND. A photographer from outside the ensemble, named.
 *  - `source` — the OUTLET whose coverage the frame comes from, where no individual photographer
 *    is on record. "fot." over one of these would hand a masthead an authorship nobody claimed,
 *    so it gets its own label and trails the hands rather than joining them.
 *  - neither — the ensemble photographed itself, which is a FACT about the frame and not a hole
 *    in the record. See the fields' note in content.config.ts.
 *
 *  All three have to be printed. A run headed "fot. Tomasz Czajkowski" over six frames of which
 *  two are his reads as a claim over the other four, and a colophon naming six hands with nothing
 *  said about the remaining twenty-seven photographs reads the same way one page up.
 * @architecture Astro assets 2026
 * @module lib/photoCredit
 */

/** The ensemble's own hand. Lower-case because it stands in a list beside names without being
 *  one — "fot. Wojciech Przybył · archiwum zespołu" is a list of hands, not of people. */
export const OWN_ARCHIVE_CREDIT = "archiwum zespołu";

/** An outlet, labelled. The label is what breaks it out of the "Fot." the line opens with. */
export const sourceCredit = (source: string): string => `źródło: ${source}`;

/**
 * One frame's provenance as a finished line, label and all — what a lightbox trigger publishes.
 * The line is resolved HERE rather than in the room, because only a surface reading the concert
 * gallery knows that a frame naming nobody is the ensemble's own, and because the label is not
 * always "fot.". A frame on its own is also the one place this can be said without repetition.
 */
export const frameCredit = (frame: {
  readonly credit?: string | undefined;
  readonly source?: string | undefined;
}): string =>
  frame.source && !frame.credit
    ? sourceCredit(frame.source)
    : `fot. ${frame.credit ?? OWN_ARCHIVE_CREDIT}`;

/**
 * Everything behind a set of frames, in the one order every surface prints it: named hands first,
 * the ensemble's own archive after them, outlets last.
 *
 * Hands lead because a name is the most particular fact and the thing a reader looks for. Outlets
 * close because each carries its own label, and a self-labelling entry reads as a clause of its
 * own — "Fot. archiwum zespołu · źródło: PieninyInfo" states two things, where the same pair in
 * the other order would read as one sentence claiming the archive for the outlet.
 */
export const creditList = (
  names: readonly string[],
  sources: readonly string[],
  anyOwn: boolean,
): readonly string[] => [
  ...names,
  ...(anyOwn ? [OWN_ARCHIVE_CREDIT] : []),
  ...sources.map(sourceCredit),
];

/**
 * The same list as one line, with its opener — what a gallery's foot and a run's head print.
 *
 * "Fot." governs the hands and the archive and stops there: a line carrying only an outlet opens
 * on that outlet's own label instead, because "fot. źródło: PieninyInfo" is the one arrangement of
 * these words that says nothing. Empty when there is nothing to state, which is the caller's cue
 * to print no line at all.
 */
export const creditSentence = (
  names: readonly string[],
  sources: readonly string[],
  anyOwn: boolean,
  lead: string,
): string => {
  const hands = creditList(names, [], anyOwn);
  const clauses = hands.length > 0 ? [`${lead} ${hands.join(" · ")}`] : [];
  return [...clauses, ...sources.map(sourceCredit)].join(" · ");
};
