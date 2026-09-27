/**
 * @file voicedTone.ts
 * @description A plucked-string tone for choosing pitches by ear: a 20 ms
 * attack, then an exponential decay, closed by a short release at 1.4 s.
 *
 * The spectrum depends on the register. A phone speaker reproduces almost
 * nothing below ~200 Hz, so a bass's E2 is heard only through its upper
 * partials, from which the ear reconstructs the fundamental: low notes carry
 * more harmonics on a flatter slope, so those partials hold real energy. High
 * notes carry few on a steep slope, because eight partials of C6 reach 8 kHz
 * and buzz. One wave per register is built once per context and cached.
 *
 * Runs on the panel's shared `toneContext`. Every call opens it, so call these
 * synchronously inside the tap or key press that asks for sound (see that file
 * for the iOS reasons); each call holds the audio session until its last note
 * has faded or it is stopped.
 * @module shared/lib/audio/voicedTone
 */

import {
  openToneContext,
  releaseToneSession,
} from "@/shared/lib/audio/toneContext";
import { midiToHz } from "@/shared/lib/music/pitchNotation";

interface Register {
  /** The register covers every MIDI note below this one, down to the next
   *  register's bound. */
  readonly below: number;
  readonly harmonics: number;
  /** Harmonic n sounds at 1/n^slope: 1 is a sawtooth's slope. */
  readonly slope: number;
}

/** Lowest register first. By ear on an iPhone speaker, not by a formula. */
const REGISTERS: readonly Register[] = [
  { below: 48, harmonics: 12, slope: 0.5 }, // under C3
  { below: 60, harmonics: 10, slope: 0.8 }, // C3–B3
  { below: 72, harmonics: 8, slope: 1 }, // C4–B4
  { below: 84, harmonics: 5, slope: 1.5 }, // C5–B5
  { below: Number.POSITIVE_INFINITY, harmonics: 3, slope: 2 }, // C6 and up
];

const ATTACK_S = 0.02;
/** The decay's time constant: the level falls to 37 % every this many seconds,
 *  as a struck string does, never holding like an organ pipe. */
const DECAY_TIME_CONSTANT_S = 0.55;
const RELEASE_S = 0.3;
const TONE_DURATION_S = 1.4;
/** Each wave is normalised to a peak of 1, and a tone this rich reads louder
 *  than a sine at the same gain, so a voice sits below the pitch pipe's 0.22 —
 *  which also leaves headroom for the notes an arpeggio overlaps. */
const PEAK_GAIN = 0.16;
/** Start-to-start spacing of an arpeggio's notes. */
const ARPEGGIO_SPACING_S = 0.4;
/** The first note is scheduled a hair after `currentTime`, so its attack is not
 *  cut by the render quantum already playing. */
const START_OFFSET_S = 0.03;
const STOP_FADE_S = 0.08;

export interface VoicedToneHandle {
  /** Fade out everything still sounding or scheduled. Safe to call twice. */
  readonly stop: () => void;
}

/** The context lives for the whole session, and so do its waves. */
const waves = new WeakMap<BaseAudioContext, Map<Register, PeriodicWave>>();

const registerOf = (midi: number): Register =>
  REGISTERS.find((register) => midi < register.below) ??
  REGISTERS[REGISTERS.length - 1];

const waveFor = (ctx: AudioContext, midi: number): PeriodicWave => {
  const register = registerOf(midi);
  let perContext = waves.get(ctx);
  if (!perContext) {
    perContext = new Map();
    waves.set(ctx, perContext);
  }
  const cached = perContext.get(register);
  if (cached) return cached;

  const real = new Float32Array(register.harmonics + 1);
  const imag = new Float32Array(register.harmonics + 1);
  for (let n = 1; n <= register.harmonics; n += 1) {
    imag[n] = 1 / Math.pow(n, register.slope);
  }
  const wave = ctx.createPeriodicWave(real, imag);
  perContext.set(register, wave);
  return wave;
};

/**
 * Play the pitches one after another, in the order given, each ringing into the
 * next. `onEnded` fires once: when the last note has faded, or on `stop()`.
 *
 * Returns null when nothing was scheduled — no Web Audio in this browser, or no
 * pitches — and `onEnded` then never fires. A context that exists but stays
 * suspended is not detectable here; poll `isToneContextRunning` shortly after
 * the gesture for that.
 */
export const playArpeggio = (
  midis: readonly number[],
  onEnded?: () => void,
): VoicedToneHandle | null => {
  if (midis.length === 0) return null;
  const ctx = openToneContext();
  if (!ctx) return null;

  const startAt = ctx.currentTime + START_OFFSET_S;
  // Every note passes through one master gain that only `stop()` moves, so the
  // fade starts from a level known exactly. Reading a note's own gain mid-decay
  // is unreliable: older Safari reports the last value set, not the one heard.
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const oscillators: OscillatorNode[] = [];

  midis.forEach((midi, index) => {
    const toneStart = startAt + index * ARPEGGIO_SPACING_S;
    const toneEnd = toneStart + TONE_DURATION_S;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.setPeriodicWave(waveFor(ctx, midi));
    osc.frequency.value = midiToHz(midi);
    gain.gain.setValueAtTime(0, toneStart);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, toneStart + ATTACK_S);
    gain.gain.setTargetAtTime(0, toneStart + ATTACK_S, DECAY_TIME_CONSTANT_S);
    // Five time constants inside the release leave under 1 % of an already
    // decayed level, so the oscillator stops on silence, without a click.
    gain.gain.setTargetAtTime(0, toneEnd - RELEASE_S, RELEASE_S / 5);

    osc.connect(gain).connect(master);
    // The context is never closed, so a keyboard tapped for a whole session
    // must not leave its finished voices wired to the destination.
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(toneStart);
    osc.stop(toneEnd + 0.02);
    oscillators.push(osc);
  });

  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    releaseToneSession();
    onEnded?.();
  };
  const totalS =
    START_OFFSET_S +
    (midis.length - 1) * ARPEGGIO_SPACING_S +
    TONE_DURATION_S +
    0.05;
  const timer = window.setTimeout(() => {
    master.disconnect();
    finish();
  }, totalS * 1000);

  return {
    stop: () => {
      if (finished) return;
      window.clearTimeout(timer);
      const now = ctx.currentTime;
      master.gain.setValueAtTime(1, now);
      master.gain.linearRampToValueAtTime(0, now + STOP_FADE_S);
      oscillators.forEach((osc) => {
        try {
          osc.stop(now + STOP_FADE_S + 0.02);
        } catch {
          // Already stopped — older Safari throws on a second stop().
        }
      });
      window.setTimeout(
        () => master.disconnect(),
        (STOP_FADE_S + 0.05) * 1000,
      );
      finish();
    },
  };
};

/** Sound one key. Same contract as `playArpeggio`. */
export const playVoicedTone = (
  midi: number,
  onEnded?: () => void,
): VoicedToneHandle | null => playArpeggio([midi], onEnded);
