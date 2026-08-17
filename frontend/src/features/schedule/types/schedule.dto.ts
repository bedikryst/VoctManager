import type {
  AttendanceStatus,
  LocationSnippet,
  Project,
  Rehearsal,
  RunSheetItem,
} from "@/shared/types";

export type ScheduleViewMode = "UPCOMING" | "PAST";

export interface EnrichedRehearsal extends Rehearsal {
  absent_count?: number;
}

export interface TimelineEvent {
  id: string;
  type: "REHEARSAL" | "PROJECT";
  rawObj: Project | EnrichedRehearsal;
  date_time: Date;
  title: string;
  location: LocationSnippet | null | undefined;
  focus?: string | null;
  is_mandatory?: boolean;
  status?: AttendanceStatus | null;
  excuse_note?: string | null;
  absences?: number;
  project_id: string | number;
  call_time?: string | null;
  run_sheet?: RunSheetItem[];
  description?: string | null;
  /** The artist's own participation for this event's project (RSVP target). */
  participationId?: string | number;
  /** The artist's existing attendance row id, when they've already marked it. */
  attendanceId?: string;
}

/** The artist's own attendance, pre-joined onto a rehearsal by the server. */
export interface ScheduleAttendanceSnapshot {
  id: string;
  status: AttendanceStatus;
  excuse_note: string;
}

export interface ScheduleDashboardProjectItem {
  type: "PROJECT";
  participation_id: string | null;
  project: Project;
}

export interface ScheduleDashboardRehearsalItem {
  type: "REHEARSAL";
  participation_id: string | null;
  project_title: string;
  my_attendance: ScheduleAttendanceSnapshot | null;
  rehearsal: EnrichedRehearsal;
}

/**
 * One row of GET /api/participations/schedule-dashboard/ — the server-joined
 * read model that replaces the former four-collection client-side join.
 */
export type ScheduleDashboardItem =
  | ScheduleDashboardProjectItem
  | ScheduleDashboardRehearsalItem;

export interface ScheduleAttendanceReportDTO {
  rehearsal: string | number;
  participation: string | number;
  status: AttendanceStatus;
  excuse_note: string;
}

/** The two statuses a span of days can carry — see `AbsenceRangeReportDTO`. */
export type AbsenceRangeStatus = Extract<AttendanceStatus, "ABSENT" | "EXCUSED">;

/**
 * One absence stated once for a run of days. Both edges are wall-clock strings
 * (`yyyy-MM-ddTHH:mm`, no offset) and inclusive; the server reads them against
 * each rehearsal's own venue clock.
 */
export interface AbsenceRangeReportDTO {
  artist: string | number;
  starts_at: string;
  ends_at: string;
  status: AbsenceRangeStatus;
  excuse_note: string;
}

/** The server's answer to a range write: how many rows it actually reached. */
export interface AbsenceRangeResult {
  updated: number;
}

/**
 * What a range would touch, resolved from the schedule the artist already holds
 * — so the count can be stated while the dates are still being picked.
 */
export interface AbsenceRangePreview {
  /** Rehearsals in the window the artist actually takes part in. */
  readonly count: number;
  /** Rehearsals in the window, including the ones that are not theirs. */
  readonly inWindow: number;
  readonly rehearsalIds: readonly string[];
}

/** The range half of the absence form, owned by `useScheduleData`. */
export interface AbsenceRangeControls {
  readonly resolve: (from: string, to: string) => AbsenceRangePreview;
  readonly submit: (
    status: AbsenceRangeStatus,
    note: string,
    from: string,
    to: string,
  ) => Promise<boolean>;
}

/** The chorister's own attendance mirror, derived from past rehearsals. */
export interface ScheduleAttendanceStats {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Past rehearsals the artist was invited to. */
  total: number;
  /** present + late + absent (the records a rate can be computed from). */
  accountable: number;
  /** (present + late) / accountable, 0–100; null when nothing is accountable. */
  rate: number | null;
  /** Consecutive most-recent attended rehearsals (excused/unmarked are neutral). */
  streak: number;
}
