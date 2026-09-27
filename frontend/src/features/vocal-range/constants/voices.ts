/**
 * @file voices.ts
 * @description Where the vocal-range keyboard opens for each singing voice, and
 * how far it reaches. The centre is the middle of the voice's usual span, so a
 * singer lands among their own notes. The keyboard shows the voice's usual solo
 * range and a fifth beyond it on each side, not the whole piano: a short
 * keyboard is quicker to read and to scroll. The fifth is wide on purpose. A
 * narrower margin would cut off exactly the extremes the conductor asks for
 * (a soprano's f³, a bass's C), and a voice type filed a class too high or too
 * low in the roster still reaches its own notes.
 * @module features/vocal-range/constants/voices
 */

import { pitchClass } from "@/shared/lib/music/pitchNotation";
import type { VoiceType } from "@/shared/types";

export type SingingVoice = Extract<
  VoiceType,
  "SOP" | "MEZ" | "ALT" | "CT" | "TEN" | "BAR" | "BAS"
>;

/** a¹ f¹ d¹ e¹ a f d, as MIDI numbers. */
const VOICE_CENTRE_MIDI: Readonly<Record<SingingVoice, number>> = {
  SOP: 69,
  MEZ: 65,
  ALT: 62,
  CT: 64,
  TEN: 57,
  BAR: 53,
  BAS: 50,
};

/** Each voice's usual solo range, as MIDI numbers: c¹–c³, a–a², f–f², g–e²,
 *  c–c², G–g¹, E–e¹. */
const VOICE_RANGE_MIDI: Readonly<
  Record<SingingVoice, { readonly low: number; readonly high: number }>
> = {
  SOP: { low: 60, high: 84 },
  MEZ: { low: 57, high: 81 },
  ALT: { low: 53, high: 77 },
  CT: { low: 55, high: 76 },
  TEN: { low: 48, high: 72 },
  BAR: { low: 43, high: 67 },
  BAS: { low: 40, high: 64 },
};

/** How far past the usual range the keyboard reaches: a fifth. */
const WINDOW_MARGIN_SEMITONES = 7;

/** Highest voice first: the order of the trial-mode voice picker. */
export const SINGING_VOICES: readonly SingingVoice[] = [
  "SOP",
  "MEZ",
  "ALT",
  "CT",
  "TEN",
  "BAR",
  "BAS",
];

/** G1–C7: the outer bound of any window, a bass's lowest reach and a
 *  soprano's highest with room past both. */
const PIANO_LOW_MIDI = 31;
const PIANO_HIGH_MIDI = 96;

/** The voice as a singing one, or null for a conductor, a player, or none. */
export const singingVoiceOf = (
  voiceType: string | null | undefined,
): SingingVoice | null =>
  SINGING_VOICES.find((voice) => voice === voiceType) ?? null;

export const voiceCentreMidi = (voice: SingingVoice): number =>
  VOICE_CENTRE_MIDI[voice];

const isBlack = (midi: number): boolean =>
  [1, 3, 6, 8, 10].includes(pitchClass(midi));

/**
 * The keys the keyboard shows for this voice: the usual range and a fifth each
 * side, widened to take in any note already chosen (a saved proposal from
 * before a voice change, a trial voice switched after picking), and ending on
 * white keys so no half-drawn key sits at either end.
 */
export const keyboardWindow = (
  voice: SingingVoice,
  chosen: readonly number[],
): { readonly low: number; readonly high: number } => {
  const range = VOICE_RANGE_MIDI[voice];
  let low = Math.max(
    PIANO_LOW_MIDI,
    Math.min(range.low - WINDOW_MARGIN_SEMITONES, ...chosen),
  );
  let high = Math.min(
    PIANO_HIGH_MIDI,
    Math.max(range.high + WINDOW_MARGIN_SEMITONES, ...chosen),
  );
  if (isBlack(low)) low -= 1;
  if (isBlack(high)) high += 1;
  return { low, high };
};
