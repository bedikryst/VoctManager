/**
 * @file PitchPipe.tsx
 * @description Web Audio pitch pipe (kamerton) for rehearsal use: a single
 * soft sine oscillator with attack/release envelope, chromatic note grid and
 * octave selector. Also exports a best-effort musical-key parser so callers
 * can highlight a piece's tonic ("Ton utworu: D").
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

export const PITCH_NOTES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "H",
] as const;

const ENGLISH_NOTE_INDEX: Record<string, number> = {
  c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4, f: 5, "f#": 6, gb: 6,
  g: 7, "g#": 8, ab: 8, a: 9, "a#": 10, bb: 10, b: 11,
};

const GERMAN_NOTE_INDEX: Record<string, number> = {
  c: 0, cis: 1, des: 1, d: 2, dis: 3, es: 3, e: 4, f: 5, fis: 6, ges: 6,
  g: 7, gis: 8, as: 8, a: 9, ais: 10, b: 10, h: 11,
};

/**
 * Extracts the tonic from strings like "D minor", "Es-dur", "F# major",
 * "g-moll". Returns an index into PITCH_NOTES or null when unparseable.
 */
export const parseMusicalKeyTonic = (key: string): number | null => {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return null;

  const isGerman = /(dur|moll)/.test(normalized);
  const token = normalized
    .replace(/[-_]/g, " ")
    .replace(/\b(major|minor|maj|min|dur|moll)\b/g, "")
    .trim()
    .split(/\s+/)[0]
    ?.replace("♯", "#")
    .replace("♭", "b");

  if (!token) return null;

  const primary = isGerman ? GERMAN_NOTE_INDEX : ENGLISH_NOTE_INDEX;
  const fallback = isGerman ? ENGLISH_NOTE_INDEX : GERMAN_NOTE_INDEX;
  return primary[token] ?? fallback[token] ?? null;
};

/** Equal-temperament frequency for a chromatic index (0=C … 11=B/H) + octave. */
export const noteFrequency = (noteIndex: number, octave: number): number => {
  const midi = (octave + 1) * 12 + noteIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

const OCTAVES = [3, 4, 5] as const;

interface PitchPipeProps {
  /** PITCH_NOTES index to highlight as the piece tonic (optional). */
  suggestedTonic?: number | null;
  className?: string;
}

export const PitchPipe = ({
  suggestedTonic = null,
  className,
}: PitchPipeProps): React.JSX.Element => {
  const { t } = useTranslation();
  const contextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const [octave, setOctave] = useState<number>(4);
  const [activeNote, setActiveNote] = useState<number | null>(null);

  const stopTone = useCallback((): void => {
    const ctx = contextRef.current;
    const osc = oscillatorRef.current;
    const gain = gainRef.current;
    if (ctx && osc && gain) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.12);
      osc.stop(now + 0.14);
    }
    oscillatorRef.current = null;
    gainRef.current = null;
    setActiveNote(null);
  }, []);

  const playTone = useCallback(
    (noteIndex: number): void => {
      contextRef.current ??= new AudioContext();
      const ctx = contextRef.current;
      void ctx.resume();

      // Release any tone already sounding before starting the next one.
      if (oscillatorRef.current) stopTone();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = noteFrequency(noteIndex, octave);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);

      oscillatorRef.current = osc;
      gainRef.current = gain;
      setActiveNote(noteIndex);
    },
    [octave, stopTone],
  );

  const handleNoteTap = (noteIndex: number): void => {
    if (activeNote === noteIndex) {
      stopTone();
    } else {
      playTone(noteIndex);
    }
  };

  useEffect(
    () => () => {
      stopTone();
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [stopTone],
  );

  return (
    <GlassCard variant="ethereal" padding="sm" isHoverable={false} className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Eyebrow color="muted">
          {t("schedule.pitch_pipe.title", "Kamerton")}
        </Eyebrow>
        <div className="flex items-center gap-1 rounded-lg border border-ethereal-marble bg-ethereal-alabaster p-0.5 shadow-glass-solid">
          {OCTAVES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setOctave(value);
                if (activeNote !== null) stopTone();
              }}
              aria-pressed={octave === value}
              className={cn(
                "min-h-7 rounded-md border px-2 py-0.5 transition-all active:scale-95",
                octave === value
                  ? "border-ethereal-gold/30 bg-ethereal-gold/10"
                  : "border-transparent hover:border-ethereal-marble",
              )}
            >
              <Eyebrow color={octave === value ? "gold" : "muted"}>
                {value}
              </Eyebrow>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {PITCH_NOTES.map((note, index) => {
          const isActive = activeNote === index;
          const isTonic = suggestedTonic === index;
          return (
            <button
              key={note}
              type="button"
              onClick={() => handleNoteTap(index)}
              aria-pressed={isActive}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-lg border text-sm font-semibold transition-all active:scale-95",
                isActive
                  ? "border-ethereal-gold bg-ethereal-gold text-ethereal-graphite shadow-button-primary"
                  : isTonic
                    ? "border-ethereal-gold/40 bg-ethereal-gold/10 text-ethereal-gold"
                    : "border-ethereal-marble bg-ethereal-alabaster text-ethereal-ink shadow-glass-solid hover:border-ethereal-gold/40",
              )}
            >
              {note}
            </button>
          );
        })}
      </div>

      <Text size="xs" color="muted" className="mt-2.5 px-0.5">
        {activeNote !== null
          ? `${PITCH_NOTES[activeNote]}${octave} · ${noteFrequency(activeNote, octave).toFixed(1)} Hz`
          : t("schedule.pitch_pipe.hint", "Dotknij nutę, aby usłyszeć ton. Dotknij ponownie, aby wyciszyć.")}
      </Text>
    </GlassCard>
  );
};
