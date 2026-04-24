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
  location: string | LocationSnippet | null | undefined;
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
