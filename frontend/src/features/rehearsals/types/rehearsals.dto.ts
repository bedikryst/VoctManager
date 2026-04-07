/**
 * @file rehearsals.dto.ts
 * @description Feature-local DTOs for the Rehearsals domain.
 */

import type { AttendanceStatus } from "../../../shared/types";

export type ProjectTabType = "ACTIVE" | "ARCHIVE";

export interface AttendanceUpsertDTO {
  rehearsal: string;
  participation: string;
  status: AttendanceStatus;
  minutes_late: number | null;
  excuse_note: string | null;
}
