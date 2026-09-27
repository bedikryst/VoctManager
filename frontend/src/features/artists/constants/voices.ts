/**
 * @file voices.ts
 * @description Where the vocal-range keyboard opens for each singing voice, and
 * how far it reaches. Both come from the conductor's own figures for each voice
 * in the ensemble, extremes included. The keyboard shows that range and two
 * white keys past each end, the margin the conductor asked for, so a singer
 * lands among their own notes without scrolling through another voice's. A
 * singer who reaches further widens it from either end, three white keys at a
 * time, and a note already chosen is always shown.
 *
 * It lives beside `voiceSections.ts` because two features read it: the singer's
 * screen (`features/vocal-range`) and the conductor's assessment in the artist
 * editor, whose keyboard follows the voice set in the form.
 * @module features/artists/constants/voices
 */

import { pitchClass } from "@/shared/lib/music/pitchNotation";
import type { VoiceType } from "@/shared/types";

export type SingingVoice = Extract<
  VoiceType,
  "SOP" | "MEZ" | "ALT" | "CT" | "TEN" | "BAR" | "BAS"
>;

/** Near the middle of each voice's tessitura: a¹ g¹ e¹ e¹ a g d. */
const VOICE_CENTRE_MIDI: Readonly<Record<SingingVoice, number>> = {
  SOP: 69,
  MEZ: 67,
  ALT: 64,
  CT: 64,
  TEN: 57,
  BAR: 55,
  BAS: 50,
};

/**
 * The keys each voice's keyboard shows before the singer widens it: the
 * conductor's range for the voice, extremes included, and two white keys past
 * each end.
 *
 *         conductor         keyboard
 *   SOP   c¹–a² (g–c³)      e–e³
 *   MEZ   a–f² (g–a²)       e–c³
 *   ALT   g–d² (e–g²)       c–h²
 *   CT    as the alto       c–h²
 *   TEN   c–a¹ (A–c²)       F–e²
 *   BAR   A–f¹ (F–a¹)       D–c²
 *   BAS   E–c¹ (D–e¹)       A₁–g¹
 *
 * The conductor gave no figures for the countertenor, who sings the alto line
 * in the ensemble. The bass reaches down to A₁ at the conductor's word: the
 * repertoire has an optional H₁.
 */
const VOICE_KEYBOARD_MIDI: Readonly<
  Record<SingingVoice, { readonly low: number; readonly high: number }>
> = {
  SOP: { low: 52, high: 88 },
  MEZ: { low: 52, high: 84 },
  ALT: { low: 48, high: 83 },
  CT: { low: 48, high: 83 },
  TEN: { low: 41, high: 76 },
  BAR: { low: 38, high: 72 },
  BAS: { low: 33, high: 67 },
};

/** How many white keys one "higher" or "lower" adds. */
const WHITE_KEYS_PER_STEP = 3;

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

/** G1–C7: the outer bound of any window, however far it is widened. */
export const KEYBOARD_LIMIT = { low: 31, high: 96 } as const;

/** How many times the singer has widened the keyboard past each end. */
export interface KeyboardReach {
  readonly below: number;
  readonly above: number;
}

export const NO_REACH: KeyboardReach = { below: 0, above: 0 };

/** The voice as a singing one, or null for a conductor, a player, or none. */
export const singingVoiceOf = (
  voiceType: string | null | undefined,
): SingingVoice | null =>
  SINGING_VOICES.find((voice) => voice === voiceType) ?? null;

export const voiceCentreMidi = (voice: SingingVoice): number =>
  VOICE_CENTRE_MIDI[voice];

const isBlack = (midi: number): boolean =>
  [1, 3, 6, 8, 10].includes(pitchClass(midi));

/** `count` white keys up (+1) or down (−1) from a white key. */
const walkWhiteKeys = (
  from: number,
  count: number,
  direction: 1 | -1,
): number => {
  let midi = from;
  for (let walked = 0; walked < count; ) {
    midi += direction;
    if (!isBlack(midi)) walked += 1;
  }
  return midi;
};

/**
 * The keys the keyboard shows for this voice: its own span, widened by the
 * singer's reach past either end, then to take in any note already chosen (a
 * saved proposal from before a voice change, a trial voice switched after
 * picking), and ending on white keys so no half-drawn key sits at either end.
 */
export const keyboardWindow = (
  voice: SingingVoice,
  chosen: readonly number[],
  reach: KeyboardReach = NO_REACH,
): { readonly low: number; readonly high: number } => {
  const own = VOICE_KEYBOARD_MIDI[voice];
  const reachedLow = walkWhiteKeys(own.low, reach.below * WHITE_KEYS_PER_STEP, -1);
  const reachedHigh = walkWhiteKeys(own.high, reach.above * WHITE_KEYS_PER_STEP, 1);
  let low = Math.max(KEYBOARD_LIMIT.low, Math.min(reachedLow, ...chosen));
  let high = Math.min(KEYBOARD_LIMIT.high, Math.max(reachedHigh, ...chosen));
  if (isBlack(low)) low -= 1;
  if (isBlack(high)) high += 1;
  return { low, high };
};
