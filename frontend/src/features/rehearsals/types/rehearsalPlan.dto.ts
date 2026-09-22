/**
 * @file rehearsalPlan.dto.ts
 * @description Wire shapes of the rehearsal plan: what `PUT plan/` takes (the
 * whole list, declarative — what is on screen is what is sent; an existing
 * row names its `id` so its done stamp survives) and what the three plan
 * endpoints answer.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/types/rehearsalPlan.dto
 */

import type { RehearsalPlanItem, VoiceLine } from "@/shared/types";

/** One row as the editor sends it. Position is the index in the list. */
export interface RehearsalPlanRowDTO {
  id?: string;
  piece: string | null;
  label: string;
  note: string;
  /** "HH:MM" wall clock in the rehearsal's zone, or null for a row that flows. */
  starts_at: string | null;
  excluded_voice_lines: VoiceLine[];
  excludes_instrumentalists: boolean;
}

export interface RehearsalPlanDTO {
  rows: RehearsalPlanRowDTO[];
}

/** `GET`/`PUT rehearsals/<id>/plan/`. */
export interface RehearsalPlanRead {
  rehearsal: string;
  plan_announced_at: string | null;
  rows: RehearsalPlanItem[];
}

/** `POST rehearsals/<id>/plan/announce/`. */
export interface RehearsalPlanAnnounced {
  rehearsal: string;
  plan_announced_at: string | null;
}
