/**
 * @file useWelcomeChord.ts
 * @description The "chord of welcome" — the ensemble finding its pitch the moment
 * a member crosses in. Not a synth beep: each note of an A-major voicing is sung
 * by a small *section* of slightly detuned voices that breathe in on a soft
 * stagger, coloured by a vowel-like formant and a gentle shared vibrato, then set
 * loose into a hall reverb so the chord blooms and rings the way a choir does in a
 * nave. Entirely synthesised in the Web Audio graph — no asset to ship or licence.
 * Shares the gesture-gated `play` / `isPlaying` contract with {@link PitchPipe};
 * browsers gate Web Audio behind a user gesture, so `play` must be called from one.
 * @module shared/ui/instruments
 */
import { useCallback, useEffect, useRef, useState } from "react";

// A warm ascending major voicing: A3 · C♯4 · E4 · A4. The chord swells upward.
const FUNDAMENTALS = [220, 277.18, 329.63, 440] as const;
const SECTION_VOICES = 3; // singers per part — the detune between them *is* the choir
const DETUNE_CENTS = 7; // how far the section spreads around the true pitch
const VOICE_STAGGER = 0.035; // seconds between singers in a section entering
const NOTE_STAGGER = 0.13; // seconds between each part entering (the bloom)
const ATTACK = 0.5; // a choir breathes in — no percussive onset
const SUSTAIN = 1.35;
const RELEASE = 1.7;
const REVERB_SECONDS = 2.6; // hall tail
const PEAK_PER_NOTE = 0.085; // modest per-part so the four-part stack never clips
const VIBRATO_HZ = 5;
const VIBRATO_CENTS = 6;
const REVERB_MIX = 0.55;

// The visible "Brzmi…" state tracks the voices, not the full reverb decay.
const TOTAL_MS = Math.round(
  ((FUNDAMENTALS.length - 1) * NOTE_STAGGER + ATTACK + SUSTAIN + RELEASE + 0.1) *
    1000,
);

export interface WelcomeChord {
  readonly play: () => void;
  readonly isPlaying: boolean;
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

export const useWelcomeChord = (): WelcomeChord => {
  const contextRef = useRef<AudioContext | null>(null);
  const impulseRef = useRef<AudioBuffer | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const play = useCallback((): void => {
    try {
      contextRef.current ??= new AudioContext();
    } catch {
      return; // No Web Audio — the moment stays purely visual.
    }
    const ctx = contextRef.current;
    void ctx.resume();

    // ── master bus: a soft limiter keeps the stacked sections from clipping ──
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(ctx.destination);

    // ── the nave: a convolution reverb the whole chord is sung into ──
    impulseRef.current ??= buildImpulse(ctx, REVERB_SECONDS);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulseRef.current;
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = REVERB_MIX;
    reverb.connect(reverbReturn).connect(limiter);

    // ── one shared vibrato so the whole choir breathes together ──
    const vibrato = ctx.createOscillator();
    const vibratoDepth = ctx.createGain();
    vibrato.frequency.value = VIBRATO_HZ;
    vibratoDepth.gain.value = VIBRATO_CENTS;
    vibrato.connect(vibratoDepth);

    const start = ctx.currentTime + 0.06;
    let lastVoiceStop = start;

    FUNDAMENTALS.forEach((hz, noteIndex) => {
      const noteAt = start + noteIndex * NOTE_STAGGER;

      // Per-part envelope, sent both dry and into the reverb.
      const noteGain = ctx.createGain();
      const formant = ctx.createBiquadFilter();
      formant.type = "lowpass";
      formant.frequency.value = 1050 + noteIndex * 130; // vowel-like colour
      formant.Q.value = 0.7;
      noteGain.connect(formant);
      formant.connect(master);
      formant.connect(reverb);

      noteGain.gain.setValueAtTime(0.0001, noteAt);
      noteGain.gain.linearRampToValueAtTime(PEAK_PER_NOTE, noteAt + ATTACK);
      noteGain.gain.setValueAtTime(PEAK_PER_NOTE, noteAt + ATTACK + SUSTAIN);
      noteGain.gain.exponentialRampToValueAtTime(
        0.0001,
        noteAt + ATTACK + SUSTAIN + RELEASE,
      );

      for (let voice = 0; voice < SECTION_VOICES; voice += 1) {
        const osc = ctx.createOscillator();
        osc.type = voice === 0 ? "sine" : "triangle"; // one pure, two warmer
        osc.frequency.value = hz;
        osc.detune.value = (voice - (SECTION_VOICES - 1) / 2) * DETUNE_CENTS;
        vibratoDepth.connect(osc.detune); // shared vibrato modulates each singer
        osc.connect(noteGain);

        const voiceAt = noteAt + voice * VOICE_STAGGER;
        const voiceStop = noteAt + ATTACK + SUSTAIN + RELEASE + 0.1;
        osc.start(voiceAt);
        osc.stop(voiceStop);
        lastVoiceStop = Math.max(lastVoiceStop, voiceStop);
      }
    });

    vibrato.start(start);
    vibrato.stop(lastVoiceStop);

    setIsPlaying(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsPlaying(false), TOTAL_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  return { play, isPlaying };
};
