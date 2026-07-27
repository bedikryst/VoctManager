/**
 * @file attendanceStats.ts
 * @description Pure, framework-free attendance maths shared by the rail rows,
 * the inspector header, the cross-project pulse and the reliability board.
 * One definition of "invited", "marked" and "rate" keeps every surface honest.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/attendanceStats
 */

import type {
  Artist,
  Attendance,
  AttendanceStatus,
  Participation,
  Rehearsal,
} from "@/shared/types";
import {
  OTHER_SECTION,
  VOICE_SECTION_ORDER,
  voiceSectionOf,
  type VoiceSectionKey,
} from "../constants/attendanceMeta";

export interface AttendanceTally {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Invited but not yet recorded. */
  none: number;
  /** Invited headcount. */
  total: number;
  /** Recorded rows (total − none). */
  marked: number;
  /**
   * % of RECORDED singers that were in the room (present or late); `null` while
   * nothing has been recorded. Measured against `marked`, never against
   * `total`: an unmarked seat is missing data, not an absence, so a roll-call
   * nobody has started is no rate at all rather than a confident 0%.
   */
  rate: number | null;
  /** % of invited that have any record yet (roll-call progress). */
  completion: number;
}

export const EMPTY_TALLY: AttendanceTally = {
  present: 0,
  late: 0,
  absent: 0,
  excused: 0,
  none: 0,
  total: 0,
  marked: 0,
  rate: null,
  completion: 0,
};

/**
 * The participations actually summoned to a rehearsal. A rehearsal with an
 * explicit `invited_participations` set is sectional/custom; an empty set means
 * tutti (everyone still on the project). Callers pass `projectParticipations`
 * already pruned of declined singers.
 */
export const resolveInvited = (
  rehearsal: Pick<Rehearsal, "invited_participations">,
  projectParticipations: Participation[],
): Participation[] => {
  const invitedIds = rehearsal.invited_participations ?? [];
  if (invitedIds.length === 0) return projectParticipations;
  const idSet = new Set(invitedIds.map(String));
  return projectParticipations.filter((p) => idSet.has(String(p.id)));
};

/** Tally a set of invited participations against a per-participation lookup. */
export const tallyAttendance = (
  invited: Participation[],
  lookup: (participationId: string) => Attendance | undefined,
): AttendanceTally => {
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;
  let none = 0;

  invited.forEach((participation) => {
    const record = lookup(String(participation.id));
    const status = record?.status;
    if (!status) none += 1;
    else if (status === "PRESENT") present += 1;
    else if (status === "LATE") late += 1;
    else if (status === "EXCUSED") excused += 1;
    else absent += 1;
  });

  const total = invited.length;
  const marked = total - none;
  return {
    present,
    late,
    absent,
    excused,
    none,
    total,
    marked,
    rate: marked > 0 ? Math.round(((present + late) / marked) * 100) : null,
    completion: total > 0 ? Math.round((marked / total) * 100) : 0,
  };
};

/**
 * Index a flat attendance list into rehearsal → participation → record. Built
 * once per workspace load so the rail, inspector and analytics share it.
 */
export const buildAttendanceIndex = (
  attendances: Attendance[],
): Map<string, Map<string, Attendance>> => {
  const index = new Map<string, Map<string, Attendance>>();
  attendances.forEach((record) => {
    const key = String(record.rehearsal);
    let inner = index.get(key);
    if (!inner) {
      inner = new Map<string, Attendance>();
      index.set(key, inner);
    }
    inner.set(String(record.participation), record);
  });
  return index;
};

export interface VoiceGroup {
  key: VoiceSectionKey;
  participations: Participation[];
}

/**
 * Bucket participations into ordered vocal sections (high → low), dropping
 * empty sections. Within a section, sort by surname.
 */
export const groupByVoice = (
  participations: Participation[],
  artistMap: Map<string, Artist>,
): VoiceGroup[] => {
  const buckets = new Map<VoiceSectionKey, Participation[]>();

  participations.forEach((participation) => {
    const artist = artistMap.get(String(participation.artist));
    const key = voiceSectionOf(artist?.voice_type);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(participation);
    else buckets.set(key, [participation]);
  });

  const sortBySurname = (a: Participation, b: Participation): number => {
    const left = artistMap.get(String(a.artist))?.last_name ?? "";
    const right = artistMap.get(String(b.artist))?.last_name ?? "";
    return left.localeCompare(right);
  };

  const ordered: VoiceGroup[] = [];
  [...VOICE_SECTION_ORDER, OTHER_SECTION].forEach((key) => {
    const bucket = buckets.get(key);
    if (bucket && bucket.length > 0) {
      ordered.push({ key, participations: bucket.sort(sortBySurname) });
    }
  });
  return ordered;
};

/** A rehearsal is "live" within a window around its start (−2h … +3h). */
const LIVE_BEFORE_MS = 2 * 60 * 60 * 1000;
const LIVE_AFTER_MS = 3 * 60 * 60 * 1000;

export const isRehearsalLive = (dateTimeIso: string, now = Date.now()): boolean => {
  const start = new Date(dateTimeIso).getTime();
  if (Number.isNaN(start)) return false;
  return now >= start - LIVE_BEFORE_MS && now <= start + LIVE_AFTER_MS;
};

export const isPast = (dateTimeIso: string, now = Date.now()): boolean =>
  new Date(dateTimeIso).getTime() < now;

/** Same calendar day in the viewer's local zone. */
export const isToday = (dateTimeIso: string, now = new Date()): boolean => {
  const date = new Date(dateTimeIso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

export type { AttendanceStatus };
