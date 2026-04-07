/**
 * @file schedule.dto.ts
 * @description Feature-local DTOs and view models for the Schedule domain.
 * Strictly typed to prevent implicit 'any' and client-side casting hacks.
 * @architecture Enterprise SaaS 2026
 */

import type {
  AttendanceStatus,
  Project,
  Rehearsal,
  RunSheetItem,
} from "../../../shared/types";

export type ScheduleViewMode = "UPCOMING" | "PAST";

/**
 * Represents a Rehearsal entity enriched with backend annotations (e.g., Count of absences).
 */
export interface EnrichedRehearsal extends Rehearsal {
  absent_count?: number;
}

export interface TimelineEvent {
  id: string;
  type: "REHEARSAL" | "PROJECT";
  rawObj: Project | EnrichedRehearsal;
  date_time: Date;
  title: string;
  location: string | null | undefined;
  focus?: string | null;
  is_mandatory?: boolean;
  status?: AttendanceStatus | null;
  excuse_note?: string | null;
  absences?: number;
  project_id: string | number;
  call_time?: string | null;
  run_sheet?: RunSheetItem[];
  description?: string | null;
}

export interface ScheduleAttendanceReportDTO {
  rehearsal: string | number;
  participation: string | number;
  status: AttendanceStatus;
  excuse_note: string;
}
