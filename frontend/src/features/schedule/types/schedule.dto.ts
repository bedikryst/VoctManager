import type {
  AttendanceStatus,
  LocationSnippet,
  Project,
  Rehearsal,
  RehearsalPlanItem,
  RehearsalPlanWindow,
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
  /**
   * When it ends, for the events that know. Only a rehearsal carries a stored
   * length; a concert has none, and the absence is what stops the calendar
   * export from booking a block nobody promised.
   */
  ends_at?: Date | null;
  title: string;
  location: LocationSnippet | null | undefined;
  focus?: string | null;
  is_mandatory?: boolean;
  /**
   * A sectional's SATB letters ("SA"); "" or absent for a tutti. The reader
   * is on this card because their section is among them, and the badge says
   * which — a mezzo called with the altos should not wonder why.
   */
  calledSections?: string;
  /**
   * The evening's plan in order, and which of its rows call this reader. The
   * schedule dashboard computes both per reader, so a card can show the plan
   * without a second request; a project event carries neither.
   */
  plan?: RehearsalPlanItem[];
  /**
   * Which part of the evening is this reader's. Null = nothing to say (no
   * plan, or the plan spans the whole rehearsal); `calls_me: false` = no row
   * needs their voice, while the CALL itself stands.
   */
  planWindow?: RehearsalPlanWindow | null;
  status?: AttendanceStatus | null;
  excuse_note?: string | null;
  absences?: number;
  project_id: string | number;
  call_time?: string | null;
  description?: string | null;
  /** The artist's own participation for this event's project (RSVP target). */
  participationId?: string | number;
  /** The artist's existing attendance row id, when they've already marked it. */
  attendanceId?: string;
  /**
   * This evening is theirs to RUN — the conductor's own, or one handed to them
   * as a stand-in. Orthogonal to `participationId`: a stand-in who also sings
   * the programme has both, and answers for themselves on the same card they
   * take the roll call from.
   */
  iLead?: boolean;
  /**
   * Who was announced for this evening, explicit only — absent means the
   * conductor, which the card renders as silence. Shown to everyone, so a
   * singer knows who to expect at the front.
   */
  ledBy?: ScheduleLedBy | null;
  /**
   * This evening was announced as THIS reader's to run: `ledBy` is them, or
   * nobody was named and they conduct the project. Different from `iLead`:
   * a leader may take the roll of an evening the conductor kept, and the
   * conductor's own timeline must not badge one handed to somebody else.
   */
  iStandInFront?: boolean;
}

/** `Rehearsal.led_by` as the server states it: id and name, nothing else. */
export interface ScheduleLedBy {
  artist_id: string;
  name: string;
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
  /**
   * Whether this reader is expected to take THIS evening's roll call — the
   * conductor's own projects, and any programme handed to them as a stand-in
   * with the attendance scope. The server decides it; the client never derives
   * it from a role, because a stand-in has none.
   */
  i_lead: boolean;
  /** Explicit `led_by` only; null is the conductor. */
  led_by: ScheduleLedBy | null;
  /** `led_by` is this reader, or nobody is named and they conduct the project. */
  i_stand_in_front: boolean;
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
  /**
   * Their own rehearsals inside the window that have already been held. The
   * span leaves those exactly as the roll call wrote them, so they are named
   * rather than silently dropped from the count.
   */
  readonly past: number;
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
