/**
 * @file rehearsalPlan.dto.ts
 * @description Wire shapes of the rehearsal plan: what `PUT plan/` takes (the
 * whole list, declarative — what is on screen is what is sent; an existing
 * row names its `id` so its debrief verdict survives), what the three plan
 * endpoints answer, and the editor's read of the project through one evening
 * (`plan/editor/`).
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/types/rehearsalPlan.dto
 */

import type {
  Participation,
  Piece,
  PieceCasting,
  ProgramItem,
  Rehearsal,
  RehearsalPlanItem,
  VoiceLine,
  VoiceRequirement,
} from "@/shared/types";

/**
 * One row as the editor sends it. Position is the index in the list. Reserve
 * rows must form a suffix — the server refuses a main row after a reserve one.
 * A break names no piece and excludes nobody.
 */
export interface RehearsalPlanRowDTO {
  id?: string;
  piece: string | null;
  label: string;
  note: string;
  /** An anchor: "HH:MM" wall clock in the rehearsal's zone, or null (derived or flowing). */
  starts_at: string | null;
  /** The conductor's estimate, positive; a break may carry it too. */
  minutes: number | null;
  excluded_voice_lines: VoiceLine[];
  excludes_instrumentalists: boolean;
  is_reserve: boolean;
  is_break: boolean;
}

export interface RehearsalPlanDTO {
  rows: RehearsalPlanRowDTO[];
}

/**
 * `GET`/`PUT rehearsals/<id>/plan/`. A member reads `rows: []` while the plan
 * is an unpublished draft; the conductor's side reads the draft.
 */
export interface RehearsalPlanRead {
  rehearsal: string;
  plan_announced_at: string | null;
  /** When the rows last changed; later than `plan_announced_at` = changes unsent. */
  plan_changed_at: string | null;
  rows: RehearsalPlanItem[];
}

/**
 * What became of the notice a send asked for. `sent` — on its way to the
 * called seats now (a planner who is not a manager). `queued` — waiting in the
 * announcement queue: a manager's send always, anyone's while the evening's own
 * creation is still unannounced. `withheld` — the project is a draft, so nobody
 * is told now and the plan reaches the cast with the project.
 */
export type PlanDelivery = "sent" | "queued" | "withheld";

/** `POST rehearsals/<id>/plan/announce/`. */
export interface RehearsalPlanAnnounced {
  rehearsal: string;
  plan_announced_at: string | null;
  delivery: PlanDelivery;
}

/*
 * The plan editor's inputs, each the fields it reads and nothing more. A
 * manager hands it the hub's full rows; a planner who is not a manager hands
 * it `plan/editor/`, whose projection carries exactly these fields — so both
 * satisfy the same types and the editor cannot come to read a field one of
 * them lacks.
 */
export type PlanEditorProgramItem = Pick<
  ProgramItem,
  "id" | "piece" | "piece_title" | "order" | "score_edition"
>;

export interface PlanEditorPiece extends Pick<Piece, "id" | "title"> {
  voice_requirements_read?: Pick<VoiceRequirement, "edition" | "voice_line">[];
}

/** A seat without a name: the chips count people, they never list them. */
export type PlanEditorSeat = Pick<
  Participation,
  "id" | "artist_voice_type" | "default_voice_line"
>;

export type PlanEditorCasting = Pick<PieceCasting, "participation" | "piece" | "voice_line">;

/** Another evening of the project, as a fill copies from it: drafts included. */
export type PlanEditorRehearsal = Pick<
  Rehearsal,
  "id" | "date_time" | "timezone" | "focus" | "plan"
>;

/**
 * `GET rehearsals/<id>/plan/editor/` — the project as a planner reads it
 * through one evening they may plan: the programme, the programmed pieces'
 * lines, the cast's voices (declined pruned), the casting board and every
 * evening of the project. 404 for anyone `may_plan` does not admit.
 */
export interface PlanEditorRead {
  rehearsal: string;
  program: PlanEditorProgramItem[];
  pieces: PlanEditorPiece[];
  participations: PlanEditorSeat[];
  castings: PlanEditorCasting[];
  rehearsals: PlanEditorRehearsal[];
}
