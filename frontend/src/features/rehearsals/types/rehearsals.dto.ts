/**
 * @file rehearsals.dto.ts
 * @description Feature-local DTOs for the Rehearsals domain.
 */

import { z } from "zod";
import type { AttendanceStatus } from "@/shared/types";

export const attendanceUpsertSchema = z.object({
  rehearsal: z.string().uuid(),
  participation: z.string().uuid(),
  status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]),
  minutes_late: z.number().positive().nullable().optional(),
  excuse_note: z.string().nullable().optional(),
});

export type AttendanceUpsertDTO = Omit<
  z.infer<typeof attendanceUpsertSchema>,
  "status"
> & {
  status: AttendanceStatus;
};
export type ProjectTabType = "ACTIVE" | "ARCHIVE";

/** The two statuses a run of days can carry — lateness is about one evening. */
export type AbsenceSpanStatus = Extract<AttendanceStatus, "EXCUSED" | "ABSENT">;

/**
 * One singer excused across a span of days. Both edges are wall-clock strings
 * (`yyyy-MM-ddTHH:mm`, no offset) and inclusive; the server reads them against
 * each rehearsal's own venue clock, and resolves the seats itself.
 */
export interface AbsenceSpanDTO {
  artist: string;
  starts_at: string;
  ends_at: string;
  status: AbsenceSpanStatus;
  excuse_note: string;
}

/** One evening a span would reach, as the server resolves it. */
export interface AbsenceSpanRow {
  readonly id: string;
  readonly date_time: string;
  readonly timezone: string;
  readonly project: string;
  readonly project_title: string;
  /** What is already recorded there — an excusal is not always a blank line. */
  readonly current_status: AttendanceStatus | null;
}

export interface AbsenceSpanPreview {
  readonly count: number;
  readonly rehearsals: readonly AbsenceSpanRow[];
}

export interface AbsenceSpanResult {
  readonly updated: number;
}
