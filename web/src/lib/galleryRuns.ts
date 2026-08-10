/**
 * @file galleryRuns.ts
 * @description The RUN — a maximal stretch of consecutive frames from one moment, one place and
 *  one date. It is the unit both photo surfaces read: the archive hangs a run as a plate plus a
 *  sheet, the concert page heads a run when an evening has more than one, and everything the run
 *  shares is printed once at its head instead of under every frame.
 *
 *  This exists because the alternative shipped and failed. When place and date lived inside each
 *  frame's `caption`, forty-three captions carried nine distinct facts: `/obrazy` printed
 *  "Koncert 9 Kart w Bazylice NSPJ w Krakowie" six times consecutively under a three-column grid,
 *  and Hymn Poległym printed its own heading back at the reader four times. Repetition at that
 *  density is not redundancy, it is the tell of a template — see docs/web-imagines-spec.md §16.
 *
 *  A run is drawn from ADJACENCY, never by collecting matches from across the gallery. Two visits
 *  to the same church a year apart are two runs and must stay two, and the frames are stored in
 *  the order they were taken (content.config.ts states this as the gallery's contract), so the
 *  boundary between two runs is exactly where the evening changed. Grouping by key instead would
 *  silently weld those two visits into one and put a photograph under the wrong date.
 * @architecture Astro assets 2026
 * @module lib/galleryRuns
 */

/** What a run is drawn from. Callers bring their own fields (image, alt, aspect) on top. */
export interface RunnableShot {
  readonly moment: "rehearsal" | "concert";
  /** This frame's own venue, where the evening had more than one. */
  readonly venue?: string | undefined;
  /** This frame's own ISO date, on the same terms. */
  readonly date?: string | undefined;
  readonly credit?: string | undefined;
  readonly source?: string | undefined;
}

/** The concert's own place and date, which a frame that states neither inherits. */
export interface RunFallback {
  readonly venue?: string | undefined;
  readonly date?: string | undefined;
}

export interface GalleryRun<T> {
  readonly moment: "rehearsal" | "concert";
  /** What the run is called at its head: the place, or "Próba" for a rehearsal. */
  readonly title: string;
  /** Long Polish date, absent when nothing on record supplies one. */
  readonly date?: string;
  /** The run's photographers, first appearance first — a run can span two hands (Łódź). */
  readonly credits: readonly string[];
  /** The outlets its frames come from, on the same terms and kept apart from the hands. */
  readonly sources: readonly string[];
  /** True when ANY frame here names neither, i.e. the ensemble shot it — which is what lets a
   *  head naming one hand say what the frames beside it are (lib/photoCredit). */
  readonly anyUncredited: boolean;
  readonly shots: readonly T[];
}

/** The rehearsal's own name. It stands where a place would, because a rehearsal room is the one
 *  thing this archive never recorded — see the note in concerts.yaml above Wcielenie's gallery. */
const REHEARSAL_TITLE = "Próba";

/**
 * A concert-level `venue` holding several places joined by " / " (the touring entries) is a LIST,
 * not a place, and must never fall through to a run head — every frame of those two concerts
 * carries its own venue precisely so it doesn't have to. Guarded here rather than at each call
 * site because the failure is silent: the head would simply print all three cities under frames
 * from one of them.
 */
const singleVenue = (venue: string | undefined): string | undefined =>
  venue && !venue.includes(" / ") ? venue : undefined;

/** Weekday-free long date, the register the concert pages already print their tour rows in. */
export const plDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * Cut a gallery into runs, in document order. A rehearsal inherits NOTHING: its place and date
 * were not recorded, and handing it the concert's own would state a room and a day this archive
 * has no grounds for.
 */
export function galleryRuns<T extends RunnableShot>(
  shots: readonly T[],
  fallback: RunFallback = {},
): GalleryRun<T>[] {
  const runs: GalleryRun<T>[] = [];
  let key: string | null = null;

  for (const shot of shots) {
    const rehearsal = shot.moment === "rehearsal";
    const venue = rehearsal ? undefined : (shot.venue ?? singleVenue(fallback.venue));
    const iso = rehearsal ? undefined : (shot.date ?? fallback.date);
    const next = `${shot.moment}|${venue ?? ""}|${iso ?? ""}`;

    if (next !== key) {
      key = next;
      runs.push({
        moment: shot.moment,
        title: rehearsal ? REHEARSAL_TITLE : (venue ?? ""),
        ...(iso ? { date: plDate(iso) } : {}),
        credits: [],
        sources: [],
        anyUncredited: false,
        shots: [],
      });
    }

    const run = runs[runs.length - 1]!;
    (run.shots as T[]).push(shot);
    if (shot.credit) {
      if (!run.credits.includes(shot.credit)) (run.credits as string[]).push(shot.credit);
    } else if (shot.source) {
      if (!run.sources.includes(shot.source)) (run.sources as string[]).push(shot.source);
    } else {
      (run as { anyUncredited: boolean }).anyUncredited = true;
    }
  }

  return runs;
}
