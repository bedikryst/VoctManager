/**
 * @file pitchTones.ts
 * @description Tiny Web Audio sequencer behind "Podaj dźwięki": plays the
 * piece's starting pitches top-voice-first as a soft arpeggio, the way a
 * conductor reads them off a pitch pipe before the choir starts. One lazily
 * created module-level AudioContext (resumed inside the triggering tap, so iOS
 * unlocks it); every tone is a sine oscillator with a gentle attack/release
 * envelope. Framework-agnostic — React consumes the returned handle.
 * @module features/materials/player
 * @architecture Enterprise SaaS 2026
 */

import { noteFrequency } from "@/shared/ui/instruments/PitchPipe";

export interface PitchToneNote {
  /** Chromatic index, 0=C … 11=B/H. */
  note: number;
  /** Scientific-pitch octave. */
  octave: number;
}

export interface PitchSequenceHandle {
  /** Fade out and cancel everything still scheduled. */
  stop: () => void;
}

/** Start-to-start spacing between tones — slight overlap keeps it musical. */
const TONE_SPACING_S = 0.85;
const TONE_DURATION_S = 1.15;
const TONE_GAIN = 0.22;
const ATTACK_S = 0.04;
const RELEASE_S = 0.25;

let sharedContext: AudioContext | null = null;

const ensureContext = (): AudioContext => {
  sharedContext ??= new AudioContext();
  void sharedContext.resume();
  return sharedContext;
};

/**
 * Schedule the given pitches as a sequential arpeggio (index order = playback
 * order). `onEnded` fires when the last tone has faded — or immediately after
 * `stop()`. Calling with an empty list is a no-op returning an inert handle.
 */
export const playPitchSequence = (
  notes: ReadonlyArray<PitchToneNote>,
  onEnded?: () => void,
): PitchSequenceHandle => {
  if (notes.length === 0) {
    onEnded?.();
    return { stop: () => undefined };
  }

  const ctx = ensureContext();
  const startAt = ctx.currentTime + 0.03;
  const voices: { osc: OscillatorNode; gain: GainNode }[] = [];

  notes.forEach(({ note, octave }, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const toneStart = startAt + index * TONE_SPACING_S;
    const toneEnd = toneStart + TONE_DURATION_S;

    osc.type = "sine";
    osc.frequency.value = noteFrequency(note, octave);
    gain.gain.setValueAtTime(0, toneStart);
    gain.gain.linearRampToValueAtTime(TONE_GAIN, toneStart + ATTACK_S);
    gain.gain.setValueAtTime(TONE_GAIN, toneEnd - RELEASE_S);
    gain.gain.linearRampToValueAtTime(0, toneEnd);

    osc.connect(gain).connect(ctx.destination);
    osc.start(toneStart);
    osc.stop(toneEnd + 0.05);
    voices.push({ osc, gain });
  });

  const totalMs =
    ((notes.length - 1) * TONE_SPACING_S + TONE_DURATION_S + 0.1) * 1000;
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    onEnded?.();
  };
  const timer = window.setTimeout(finish, totalMs);

  return {
    stop: () => {
      window.clearTimeout(timer);
      const now = ctx.currentTime;
      voices.forEach(({ osc, gain }) => {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.1);
          osc.stop(now + 0.12);
        } catch {
          // Already stopped — scheduling APIs throw on dead oscillators.
        }
      });
      finish();
    },
  };
};

/** Sound a single pitch (voice chip tap). */
export const playSinglePitch = (
  pitch: PitchToneNote,
  onEnded?: () => void,
): PitchSequenceHandle => playPitchSequence([pitch], onEnded);
