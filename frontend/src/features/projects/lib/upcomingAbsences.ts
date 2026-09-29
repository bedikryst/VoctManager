/**
 * @file upcomingAbsences.ts
 * @description The absences already reported for rehearsals that have not
 * happened yet, grouped by rehearsal — the one predicate behind both the
 * Overview's "reported absences" figure and the list that row opens, so the
 * number a conductor clicks is always the number of lines they then read.
 *
 * An absence counts only where it can still cost the rehearsal something: the
 * rehearsal starts after `now`, the singer is still on the project (a declined
 * participation is off the cast, exactly as the attendance matrix treats it),
 * and the rehearsal actually calls them — a record left against a sectional
 * that no longer names their section is not a gap in anybody's room.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/upcomingAbsences
 */

import {
  VOICE_SECTION_ORDER,
  voiceSectionOf,
} from "@/features/rehearsals/constants/attendanceMeta";
import { resolveInvited } from "@/features/rehearsals/lib/attendanceStats";
import type {
  Attendance,
  AttendanceStatus,
  Participation,
  Rehearsal,
} from "@/shared/types";
import { isFutureProjectDate } from "./projectPresentation";

const ABSENCE_STATUSES: ReadonlySet<AttendanceStatus> = new Set([
  "ABSENT",
  "EXCUSED",
]);

export interface ReportedAbsence {
  readonly attendance: Attendance;
  readonly participation: Participation;
}

export interface RehearsalAbsences {
  readonly rehearsal: Rehearsal;
  /** Voice section high to low, then name — the order the choir stands in. */
  readonly absences: readonly ReportedAbsence[];
}

export interface UpcomingAbsencesInput {
  readonly rehearsals: readonly Rehearsal[];
  readonly attendances: readonly Attendance[];
  readonly participations: readonly Participation[];
  readonly now: number;
}

const NAME_COLLATOR = new Intl.Collator(undefined, { sensitivity: "variant" });

const SECTION_RANK = new Map<string, number>(
  VOICE_SECTION_ORDER.map((section, index) => [section, index]),
);

const sectionRankOf = (participation: Participation): number =>
  SECTION_RANK.get(voiceSectionOf(participation.artist_voice_type)) ??
  VOICE_SECTION_ORDER.length;

const byChoirOrder = (left: ReportedAbsence, right: ReportedAbsence): number =>
  sectionRankOf(left.participation) - sectionRankOf(right.participation) ||
  NAME_COLLATOR.compare(
    left.participation.artist_name ?? "",
    right.participation.artist_name ?? "",
  );

/** Upcoming rehearsals with at least one reported absence, soonest first. */
export const collectUpcomingAbsences = ({
  rehearsals,
  attendances,
  participations,
  now,
}: UpcomingAbsencesInput): RehearsalAbsences[] => {
  const reference = new Date(now);
  const onProject = participations.filter(
    (participation) => participation.status !== "DEC",
  );

  const absencesByRehearsal = new Map<string, Attendance[]>();
  attendances.forEach((attendance) => {
    if (!ABSENCE_STATUSES.has(attendance.status)) return;
    const key = String(attendance.rehearsal);
    const bucket = absencesByRehearsal.get(key);
    if (bucket) bucket.push(attendance);
    else absencesByRehearsal.set(key, [attendance]);
  });

  return rehearsals
    .filter((rehearsal) => isFutureProjectDate(rehearsal.date_time, reference))
    .sort(
      (left, right) =>
        new Date(left.date_time).getTime() - new Date(right.date_time).getTime(),
    )
    .flatMap((rehearsal) => {
      const reported = absencesByRehearsal.get(String(rehearsal.id));
      if (!reported) return [];

      const called = new Map(
        resolveInvited(rehearsal, onProject).map((participation) => [
          String(participation.id),
          participation,
        ]),
      );
      const absences = reported
        .flatMap((attendance) => {
          const participation = called.get(String(attendance.participation));
          return participation ? [{ attendance, participation }] : [];
        })
        .sort(byChoirOrder);

      return absences.length > 0 ? [{ rehearsal, absences }] : [];
    });
};

export const countAbsences = (groups: readonly RehearsalAbsences[]): number =>
  groups.reduce((sum, group) => sum + group.absences.length, 0);
