/**
 * @file attendanceMatrix.ts
 * @description Pure model behind the project's attendance grid: the roster that
 * forms its rows, the rehearsals that form its columns, and the tallies each
 * axis carries.
 *
 * Two rules keep the figures honest, and both exist because the figures were
 * previously dishonest. A cell with no entry is UNKNOWN, never an absence — so
 * a rate is taken over what has actually been recorded and is `null`, not 0%,
 * while nothing has been. And a rehearsal that has not happened yet cannot be
 * missing its entries, so completeness counts past sessions only; otherwise a
 * freshly planned project reports a red verdict on work nobody could have done.
 *
 * The status vocabulary is deliberately NOT redefined here. It belongs to
 * `features/rehearsals` (Centrum Obecności), and the second copy of it that
 * used to live in this tab is why one product called the same record
 * "Zwolniony" on one screen and "Usprawiedliwiony" on the next.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/attendanceMatrix
 */

import {
  OTHER_SECTION,
  VOICE_SECTION_ORDER,
  voiceSectionOf,
  type VoiceSectionKey,
} from "@/features/rehearsals/constants/attendanceMeta";
import { foldDiacritics } from "@/shared/lib/text";
import type {
  Artist,
  Attendance,
  AttendanceStatus,
  Participation,
  Rehearsal,
} from "@/shared/types";

/** "No entry yet" is a value the grid renders, so it is modelled, not absent. */
export type AttendanceMark = AttendanceStatus | null;

/**
 * Click order. Frequency-first, so the common case costs one click and the rare
 * one is still reachable without a menu; Shift walks it backwards, which is the
 * only affordance that makes a five-step cycle survivable when you overshoot.
 */
export const MARK_CYCLE: readonly AttendanceMark[] = [
  null,
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
];

export const stepMark = (
  current: AttendanceMark,
  direction: 1 | -1,
): AttendanceMark => {
  const index = MARK_CYCLE.indexOf(current);
  const length = MARK_CYCLE.length;
  return MARK_CYCLE[(index + direction + length) % length];
};

/**
 * Ids are UUIDs and the pair is never split back apart, but `::` cannot occur
 * inside one — so the key stays unambiguous even if the id format changes.
 */
export const cellKeyOf = (
  rehearsalId: string,
  participationId: string,
): string => `${rehearsalId}::${participationId}`;

/* ── Rows: the roster ─────────────────────────────────────────────────────── */

export interface MatrixSinger {
  readonly participationId: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly section: VoiceSectionKey;
  /** Lowercased, diacritic-free haystack — a Polish roster is searched without diacritics. */
  readonly search: string;
  /** No artist record resolved; the row still exists, flagged rather than dropped. */
  readonly isUnresolved: boolean;
}

export interface MatrixSection {
  readonly key: VoiceSectionKey;
  readonly singers: readonly MatrixSinger[];
}

/**
 * Surnames sort under the reader's own collation, and the given name breaks the
 * tie — a choir with three Zielińskas otherwise listed them in payload order,
 * which is no order at all to the person reading the column.
 */
const NAME_COLLATOR = new Intl.Collator(undefined, { sensitivity: "variant" });

export interface RosterInput {
  readonly participations: readonly Participation[];
  readonly artistById: ReadonlyMap<string, Artist>;
  /** Localized stand-in for a participation whose artist record is missing. */
  readonly unknownName: string;
}

/**
 * Group the project's singers into vocal sections, high to low. A declined
 * participation is not on the project any more and is left out, exactly as the
 * rehearsals module does — the two surfaces have to agree on who is expected.
 * A participation whose artist cannot be resolved still yields a row: dropping
 * it silently is what let a project's own counters disagree with its lists.
 */
export const buildRoster = ({
  participations,
  artistById,
  unknownName,
}: RosterInput): MatrixSection[] => {
  const buckets = new Map<VoiceSectionKey, MatrixSinger[]>();

  participations.forEach((participation) => {
    if (participation.status === "DEC") return;

    const artist = artistById.get(String(participation.artist));
    const fallback = participation.artist_name?.trim();
    const lastName = artist?.last_name.trim() || fallback || unknownName;
    const firstName = artist?.first_name.trim() ?? "";
    const section = voiceSectionOf(artist?.voice_type);

    const singer: MatrixSinger = {
      participationId: String(participation.id),
      lastName,
      firstName,
      section,
      search: foldDiacritics(`${lastName} ${firstName}`),
      isUnresolved: !artist,
    };

    const bucket = buckets.get(section);
    if (bucket) bucket.push(singer);
    else buckets.set(section, [singer]);
  });

  const ordered: MatrixSection[] = [];
  [...VOICE_SECTION_ORDER, OTHER_SECTION].forEach((key) => {
    const bucket = buckets.get(key);
    if (!bucket || bucket.length === 0) return;
    bucket.sort(
      (left, right) =>
        NAME_COLLATOR.compare(left.lastName, right.lastName) ||
        NAME_COLLATOR.compare(left.firstName, right.firstName),
    );
    ordered.push({ key, singers: bucket });
  });

  return ordered;
};

export const filterRoster = (
  sections: readonly MatrixSection[],
  query: string,
): MatrixSection[] => {
  const needle = foldDiacritics(query.trim());
  if (needle.length === 0) return [...sections];

  return sections
    .map((section) => ({
      key: section.key,
      singers: section.singers.filter((singer) =>
        singer.search.includes(needle),
      ),
    }))
    .filter((section) => section.singers.length > 0);
};

/* ── Columns: the rehearsals ──────────────────────────────────────────────── */

export interface MatrixSession {
  readonly rehearsalId: string;
  readonly at: string;
  readonly timezone: string;
  readonly focus: string;
  readonly locationLabel: string | null;
  /** Already happened: only these can be incomplete, and only these can be filled. */
  readonly isPast: boolean;
  /** Being marked right now — the column the conductor most likely came here for. */
  readonly isLive: boolean;
  /** `null` = tutti. An explicit set = a sectional call, and the rest of the column is N/A. */
  readonly called: ReadonlySet<string> | null;
}

/** A roll call opens before the downbeat and stays open through the session. */
const LIVE_BEFORE_MS = 2 * 60 * 60 * 1000;
const LIVE_AFTER_MS = 3 * 60 * 60 * 1000;

export const isCalled = (
  session: MatrixSession,
  participationId: string,
): boolean => session.called === null || session.called.has(participationId);

export const buildSessions = (
  rehearsals: readonly Rehearsal[],
  locationLabelOf: (rehearsal: Rehearsal) => string | null,
  now: number = Date.now(),
): MatrixSession[] =>
  [...rehearsals]
    .sort(
      (left, right) =>
        new Date(left.date_time).getTime() - new Date(right.date_time).getTime(),
    )
    .map((rehearsal) => {
      const startedAt = new Date(rehearsal.date_time).getTime();
      const invited = rehearsal.invited_participations ?? [];

      return {
        rehearsalId: String(rehearsal.id),
        at: rehearsal.date_time,
        timezone: rehearsal.timezone,
        focus: rehearsal.focus?.trim() ?? "",
        locationLabel: locationLabelOf(rehearsal),
        isPast: Number.isNaN(startedAt) ? false : startedAt < now,
        isLive:
          !Number.isNaN(startedAt) &&
          now >= startedAt - LIVE_BEFORE_MS &&
          now <= startedAt + LIVE_AFTER_MS,
        called: invited.length > 0 ? new Set(invited.map(String)) : null,
      };
    });

/* ── Tallies ──────────────────────────────────────────────────────────────── */

export interface MarkTally {
  /** Seats summoned — the denominator for completeness, never for the rate. */
  readonly called: number;
  readonly recorded: number;
  /** Present or late: the singer was in the room. */
  readonly attended: number;
  /** Summoned, still unmarked. Meaningful for a past session only. */
  readonly missing: number;
  /** Share of RECORDED entries that showed up; `null` while nothing is recorded. */
  readonly rate: number | null;
  readonly byStatus: Readonly<Record<AttendanceStatus, number>>;
}

export const EMPTY_TALLY: MarkTally = {
  called: 0,
  recorded: 0,
  attended: 0,
  missing: 0,
  rate: null,
  byStatus: { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 },
};

/** One entry per summoned seat; `null` where nothing has been recorded for it. */
export const tallyMarks = (marks: readonly AttendanceMark[]): MarkTally => {
  const byStatus: Record<AttendanceStatus, number> = {
    PRESENT: 0,
    LATE: 0,
    ABSENT: 0,
    EXCUSED: 0,
  };
  let recorded = 0;

  marks.forEach((mark) => {
    if (mark === null) return;
    recorded += 1;
    byStatus[mark] += 1;
  });

  const attended = byStatus.PRESENT + byStatus.LATE;

  return {
    called: marks.length,
    recorded,
    attended,
    missing: marks.length - recorded,
    rate: recorded > 0 ? Math.round((attended / recorded) * 100) : null,
    byStatus,
  };
};

/**
 * Below this the figure turns gold. There is no sage counterpart on purpose:
 * full attendance is the resting case, and painting the expected outcome green
 * on forty rows is what buries the two rows that need a conversation.
 */
export const LOW_ATTENDANCE_RATE = 70;

/* ── Server state ─────────────────────────────────────────────────────────── */

export interface ServerMark {
  readonly id: string;
  readonly status: AttendanceStatus;
}

export const indexAttendances = (
  attendances: readonly Attendance[],
): Map<string, ServerMark> => {
  const index = new Map<string, ServerMark>();
  attendances.forEach((attendance) => {
    index.set(
      cellKeyOf(String(attendance.rehearsal), String(attendance.participation)),
      { id: String(attendance.id), status: attendance.status },
    );
  });
  return index;
};
