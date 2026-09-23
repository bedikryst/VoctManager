/**
 * @file trackSlots.ts
 * @description The one choice a manager makes when a take lands: which place
 * it takes on the piece. A voice line means a practice take — it joins the
 * mixer and must run the same length as its siblings. The tempo giusto slot
 * means the conductor's target-tempo recording of the whole piece: no voices,
 * heard on its own, stored on the Tutti line with `kind = TEMPO_GIUSTO`.
 *
 * The slot is offered inside the voice picker rather than as a second control,
 * because for a manager it IS an answer to "what is this file" — and a tempo
 * giusto take has no voice to pick besides.
 * @module features/archive/constants/trackSlots
 */

import type { TFunction } from "i18next";

import type { SelectOption } from "@/shared/ui/primitives/Select";
import type { Track, TrackKind, VoiceLineOption } from "@/shared/types";

/** Picker value standing for the tempo giusto take — never sent as a voice. */
export const TEMPO_GIUSTO_SLOT = "TEMPO_GIUSTO";

export const isTempoGiusto = (track: Pick<Track, "kind">): boolean =>
  track.kind === "TEMPO_GIUSTO";

/** Every voice line, then the tempo giusto slot, which stands apart from them. */
export const trackSlotOptions = (
  voiceLines: readonly VoiceLineOption[],
  t: TFunction,
): SelectOption[] => [
  ...voiceLines,
  {
    value: TEMPO_GIUSTO_SLOT,
    label: t("archive.row_tracks.tempo_giusto", "Tempo giusto"),
  },
];

/** What the upload endpoint receives for a picked slot. */
export const uploadTargetForSlot = (
  slot: string,
): { readonly voiceLine: string; readonly kind: TrackKind } =>
  slot === TEMPO_GIUSTO_SLOT
    ? { voiceLine: "TUTTI", kind: "TEMPO_GIUSTO" }
    : { voiceLine: slot, kind: "PRACTICE" };
