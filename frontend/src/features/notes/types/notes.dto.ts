/**
 * @file notes.dto.ts
 * @description Wire shapes for the private scratchpad. Mirrors
 * `backend/core/serializers.py::NoteSerializer` — `owner` never appears here,
 * `done_at` is server-stamped and read-only, and `id` is writable only on
 * create (the offline-replay affordance; see `notes.queries.ts`).
 * @module features/notes/types
 * @architecture Enterprise SaaS 2026
 */

export interface Note {
  readonly id: string;
  readonly body: string;
  readonly is_done: boolean;
  readonly done_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Client-minted id — the foundation of offline create/edit idempotency. */
export interface NoteCreateDTO {
  readonly id: string;
  readonly body: string;
}

export interface NoteBodyPatchDTO {
  readonly body: string;
}

export interface NoteDonePatchDTO {
  readonly is_done: boolean;
}
