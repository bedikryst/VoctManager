/**
 * @file rehearsals.dto.ts
 * @description Feature-local DTOs for the Rehearsals domain.
 */

import { z } from "zod";
import type { AttendanceStatus } from "../../../shared/types";

export const attendanceUpsertSchema = z.object({
  rehearsal: z.string().uuid(),
  participation: z.string().uuid(),
  status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]),
  minutes_late: z.number().positive().nullable().optional(),
  excuse_note: z.string().nullable().optional(),
});

export type AttendanceUpsertDTO = z.infer<typeof attendanceUpsertSchema>;
export type ProjectTabType = "ACTIVE" | "ARCHIVE";
