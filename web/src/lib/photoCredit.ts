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
import type { Locale } from "../i18n/config";

/**
 * The four words this module puts around a name, per locale. Only the words are translated — a
 * photographer and an outlet are names and stay themselves everywhere (glossary §1).
 *
 * `lead` opens a colophon and `frame` opens a single frame's line, which is why one is capitalized
 * and the other is not; keep that pairing in any locale added here. Type an ORDINARY space before
 * the French colons: `lib/typo.ts` narrows them at build time and a hand-typed hard space doubles
 * up (glossary §3).
 */
interface CreditLabels {
  /** Opens a colophon over several frames — "Fot. Wojciech Przybył · archiwum zespołu". */
  readonly lead: string;
  /** Opens one frame's own line, lower-case because it stands mid-sentence. */
  readonly frame: string;
  /** Labels an outlet, which is what breaks it out of the hands the line opened with. */
  readonly source: string;
  /** The ensemble's own hand, lower-case because it stands in a list beside names without
      being one — "fot. Wojciech Przybył · archiwum zespołu" is a list of hands, not of people. */
  readonly ownArchive: string;
}

const CREDIT_LABELS: Record<Locale, CreditLabels> = {
  pl: { lead: "Fot.", frame: "fot.", source: "źródło:", ownArchive: "archiwum zespołu" },
  en: {
    lead: "Photographs:",
    frame: "photograph:",
    source: "source:",
    ownArchive: "the ensemble's own archive",
  },
  fr: {
    lead: "Photographies :",
    frame: "photographie :",
    source: "source :",
    ownArchive: "archives de l'ensemble",
  },
};

/**
 * Where a credit line stands, which decides how it opens.
 *
 * - `colophon` — the line IS a statement, at the foot of a gallery: it opens capitalized.
 * - `head` — the line sits inside a run's head beside a place and a date, mid-flow, and opens
 *   lower-case for the same reason a clause does.
 */
export type CreditOpener = "colophon" | "head";

/** The ensemble's own hand, as `locale` names it. */
export const ownArchiveCredit = (locale: Locale): string => CREDIT_LABELS[locale].ownArchive;

/** An outlet, labelled. The label is what breaks it out of the hands the line opens with. */
export const sourceCredit = (source: string, locale: Locale): string =>
  `${CREDIT_LABELS[locale].source} ${source}`;

/**
 * One frame's provenance as a finished line, label and all — what a lightbox trigger publishes.
 * The line is resolved HERE rather than in the room, because only a surface reading the concert
 * gallery knows that a frame naming nobody is the ensemble's own, and because the label is not
 * always the photographer's. A frame on its own is also the one place this can be said without
 * repetition.
 */
export const frameCredit = (
  frame: {
    readonly credit?: string | undefined;
    readonly source?: string | undefined;
  },
  locale: Locale,
): string =>
  frame.source && !frame.credit
    ? sourceCredit(frame.source, locale)
    : `${CREDIT_LABELS[locale].frame} ${frame.credit ?? ownArchiveCredit(locale)}`;

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
  locale: Locale,
): readonly string[] => [
  ...names,
  ...(anyOwn ? [ownArchiveCredit(locale)] : []),
  ...sources.map((s) => sourceCredit(s, locale)),
];

/**
 * The same list as one line, with its opener — what a gallery's foot and a run's head print.
 *
 * The opener governs the hands and the archive and stops there: a line carrying only an outlet
 * opens on that outlet's own label instead, because "fot. źródło: PieninyInfo" is the one
 * arrangement of these words that says nothing. Empty when there is nothing to state, which is the
 * caller's cue to print no line at all.
 */
export const creditSentence = (
  names: readonly string[],
  sources: readonly string[],
  anyOwn: boolean,
  locale: Locale,
  opener: CreditOpener,
): string => {
  const hands = creditList(names, [], anyOwn, locale);
  const lead = opener === "colophon" ? CREDIT_LABELS[locale].lead : CREDIT_LABELS[locale].frame;
  const clauses = hands.length > 0 ? [`${lead} ${hands.join(" · ")}`] : [];
  return [...clauses, ...sources.map((s) => sourceCredit(s, locale))].join(" · ");
};
