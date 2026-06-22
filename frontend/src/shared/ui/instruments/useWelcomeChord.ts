/**
 * @file useWelcomeChord.ts
 * @description A single gesture-triggered "chord of welcome" — the ensemble
 * finding its pitch. Four soft sine voices enter in a gentle ascending stagger
 * (A major, resolving to the octave) and ring together before fading. Shares the
 * Web-Audio envelope idiom of {@link PitchPipe}; reusable wherever a moment earns
 * a little ceremony (first login, activation seal). Browsers gate Web Audio
 * behind a user gesture, so `play` must always be called from one (a tap/click).
 * @module shared/ui/instruments
 */
import { useCallback, useEffect, useRef, useState } from "react";

// A warm ascending major voicing: A3 · C♯4 · E4 · A4. The chord "swells" in.
const CHORD_HZ = [220, 277.18, 329.63, 440] as const;
const NOTE_STAGGER = 0.085; // seconds between each voice entering
const ATTACK = 0.06;
const SUSTAIN = 0.9;
const RELEASE = 1.1;
const VOICE_GAIN = 0.13; // modest per-voice so the four-note stack never clips

const TOTAL_MS = Math.round(
  (NOTE_STAGGER * CHORD_HZ.length + ATTACK + SUSTAIN + RELEASE) * 1000,
);

export interface WelcomeChord {
  readonly play: () => void;
  readonly isPlaying: boolean;
}

export const useWelcomeChord = (): WelcomeChord => {
  const contextRef = useRef<AudioContext | null>(null);
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

    const start = ctx.currentTime + 0.02;
    CHORD_HZ.forEach((hz, index) => {
      const at = start + index * NOTE_STAGGER;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(VOICE_GAIN, at + ATTACK);
      gain.gain.setValueAtTime(VOICE_GAIN, at + ATTACK + SUSTAIN);
      gain.gain.linearRampToValueAtTime(0, at + ATTACK + SUSTAIN + RELEASE);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + ATTACK + SUSTAIN + RELEASE + 0.05);
    });

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
