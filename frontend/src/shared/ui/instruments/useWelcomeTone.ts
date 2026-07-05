/**
 * @file useWelcomeTone.ts
 * @description The welcome kamerton — a single sustained A (440 Hz) offered to a
 * member crossing the threshold. Honest by design: it does not pretend to be
 * "the sound of the ensemble" (a synthesised chord never was); it is the tuning
 * fork every rehearsal actually starts from — the same instrument the member
 * meets again in the briefing mode and the practice player. Synthesised as a
 * struck fork: a brief strike whose upper partials (including the fork's
 * characteristic high clang mode) flare and die within a second, leaving a pure
 * fundamental that sustains with a slow breath, sung into a short hall tail.
 * `toggle` is gesture-gated (browsers unlock Web Audio only inside a user
 * gesture) and silences a ringing tone — the previous welcome chord had no stop
 * at all, and repeated taps stacked new chords over the ringing one.
 * @module shared/ui/instruments/useWelcomeTone
 */
import { useCallback, useEffect, useRef, useState } from "react";

const FUNDAMENTAL_HZ = 440; // the orchestra's A — the one honest pitch we own
const FUNDAMENTAL_PEAK = 0.16;

// The strike: partials that bloom for a moment and decay, leaving the pure hum.
// 2× is the octave shimmer; ~6.27× is a real tuning fork's clang mode, kept very
// quiet so the onset reads as "struck metal" without ever turning glassy.
const STRIKE_PARTIALS = [
  { ratio: 2, peak: 0.03, decay: 1.9 },
  { ratio: 6.27, peak: 0.006, decay: 0.35 },
] as const;

const ATTACK = 0.05;
const RELEASE = 0.28; // silencing ramp on the second tap
const BREATH_HZ = 0.2; // slow amplitude swell so the held tone stays alive
const BREATH_DEPTH = 0.014;
const REVERB_SECONDS = 1.9; // a modest nave tail — presence, not wash
const REVERB_MIX = 0.16;

export interface WelcomeTone {
  /** Start the tone, or silence it if it is ringing. Call from a user gesture. */
  readonly toggle: () => void;
  /** Silence immediately-ish (release ramp). Safe to call when not playing. */
  readonly stop: () => void;
  readonly isPlaying: boolean;
}

interface ActiveVoice {
  readonly envelope: GainNode;
  /** Only the sustained oscillators (fundamental + breath LFO). The strike
   *  partials schedule their own `stop` and must never be stopped again —
   *  a second `stop()` on a finished OscillatorNode throws. */
  readonly sustained: readonly OscillatorNode[];
}

/** A short exponential-decay noise burst — a cheap, convincing hall impulse. */
const buildImpulse = (ctx: AudioContext, seconds: number): AudioBuffer => {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const decay = (1 - i / length) ** 2.5;
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  return impulse;
};

export const useWelcomeTone = (): WelcomeTone => {
  const contextRef = useRef<AudioContext | null>(null);
  const impulseRef = useRef<AudioBuffer | null>(null);
  const voiceRef = useRef<ActiveVoice | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const stop = useCallback((): void => {
    const ctx = contextRef.current;
    const voice = voiceRef.current;
    voiceRef.current = null;
    setIsPlaying(false);
    if (!ctx || !voice) return;

    const now = ctx.currentTime;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, now);
    voice.envelope.gain.linearRampToValueAtTime(0, now + RELEASE);
    voice.sustained.forEach((osc) => osc.stop(now + RELEASE + 0.05));
  }, []);

  const toggle = useCallback((): void => {
    if (voiceRef.current) {
      stop();
      return;
    }

    try {
      contextRef.current ??= new AudioContext();
    } catch {
      return; // No Web Audio — the moment stays purely visual.
    }
    const ctx = contextRef.current;
    void ctx.resume();

    // ── envelope → (dry + nave tail) → out ──
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    impulseRef.current ??= buildImpulse(ctx, REVERB_SECONDS);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulseRef.current;
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = REVERB_MIX;

    envelope.connect(ctx.destination);
    envelope.connect(reverb);
    reverb.connect(reverbReturn).connect(ctx.destination);

    const now = ctx.currentTime + 0.02;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(1, now + ATTACK);

    // ── the hum: pure fundamental, breathing slowly while it is held ──
    const fundamental = ctx.createOscillator();
    fundamental.type = "sine";
    fundamental.frequency.value = FUNDAMENTAL_HZ;
    const fundamentalGain = ctx.createGain();
    fundamentalGain.gain.value = FUNDAMENTAL_PEAK;
    const breath = ctx.createOscillator();
    breath.type = "sine";
    breath.frequency.value = BREATH_HZ;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = BREATH_DEPTH;
    breath.connect(breathDepth).connect(fundamentalGain.gain);
    fundamental.connect(fundamentalGain).connect(envelope);
    fundamental.start(now);
    breath.start(now);

    // ── the strike: upper partials that flare and die, leaving the hum.
    //    Fire-and-forget: they stop themselves and are never touched again. ──
    STRIKE_PARTIALS.forEach(({ ratio, peak, decay }) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = FUNDAMENTAL_HZ * ratio;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(peak, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(gain).connect(envelope);
      osc.start(now);
      osc.stop(now + decay + 0.1);
    });

    voiceRef.current = { envelope, sustained: [fundamental, breath] };
    setIsPlaying(true);
  }, [stop]);

  useEffect(
    () => () => {
      // Unmount: silence and release the device handle.
      const voice = voiceRef.current;
      const ctx = contextRef.current;
      voiceRef.current = null;
      if (voice && ctx) {
        voice.envelope.gain.cancelScheduledValues(ctx.currentTime);
        voice.sustained.forEach((osc) => osc.stop());
      }
      void ctx?.close();
      contextRef.current = null;
    },
    [],
  );

  return { toggle, stop, isPlaying };
};
