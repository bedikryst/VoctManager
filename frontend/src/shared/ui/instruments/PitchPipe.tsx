/**
 * @file PitchPipe.tsx
 * @description Web Audio pitch pipe (kamerton) for rehearsal use: a single soft
 * sine oscillator with attack/release envelope, a chromatic note grid, an octave
 * selector and a free-frequency field for anything the grid cannot name (a
 * historical A=415, a 528 Hz somebody asked for, a tone read off a tuner). Runs
 * on the shared `toneContext` — one context for the whole panel, primed for the
 * iOS audio session inside the tap. Also exports a best-effort musical-key
 * parser so callers can highlight a piece's tonic ("Ton utworu: D").
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";

import {
  isToneContextRunning,
  openToneContext,
  releaseToneSession,
} from "@/shared/lib/audio/toneContext";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
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

/** The note a free frequency lands nearest, with its deviation in cents. */
const describeFrequency = (
  hz: number,
): { readonly note: string; readonly cents: number } => {
  const midi = 69 + 12 * Math.log2(hz / 440);
  const nearest = Math.round(midi);
  const noteName = PITCH_NOTES[((nearest % 12) + 12) % 12];
  return {
    note: `${noteName}${Math.floor(nearest / 12) - 1}`,
    cents: Math.round((midi - nearest) * 100),
  };
};

const OCTAVES = [3, 4, 5] as const;

// The audible band a voice ever needs a reference in, generously bounded — low
// enough for an organ pedal, high enough for a whistle register.
const MIN_HZ = 20;
const MAX_HZ = 8000;

/** Accepts both decimal separators — a Polish keyboard offers the comma. */
const parseFrequency = (raw: string): number | null => {
  const normalized = raw.replace(",", ".").trim();
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalized)) return null;
  const hz = Number(normalized);
  return hz >= MIN_HZ && hz <= MAX_HZ ? hz : null;
};

/** What is sounding: a key of the grid, or the frequency typed into the field. */
type ActiveTone =
  | { readonly kind: "note"; readonly note: number }
  | { readonly kind: "custom"; readonly hz: number };

/** A refusal we can actually detect, and therefore owe the singer a word about. */
type SoundIssue = "unsupported" | "blocked";

interface PitchPipeProps {
  /** PITCH_NOTES index to highlight as the piece tonic (optional). */
  suggestedTonic?: number | null;
  className?: string;
}

export const PitchPipe = ({
  suggestedTonic = null,
  className,
}: PitchPipeProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const contextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const verifyTimerRef = useRef<number | null>(null);

  const [octave, setOctave] = useState<number>(4);
  const [activeTone, setActiveTone] = useState<ActiveTone | null>(null);
  const [customValue, setCustomValue] = useState("440");
  const [customError, setCustomError] = useState(false);
  const [soundIssue, setSoundIssue] = useState<SoundIssue | null>(null);

  const formatHz = useCallback(
    (hz: number): string =>
      new Intl.NumberFormat(i18n.language, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(hz),
    [i18n.language],
  );

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
    setActiveTone(null);
    // Only a voice this instrument actually opened may hand the session back.
    if (osc) releaseToneSession();
  }, []);

  const playTone = useCallback(
    (hz: number, tone: ActiveTone): void => {
      // Opened inside the tap: that is the only moment iOS lets us resume the
      // context and take the playback audio session.
      const ctx = openToneContext();
      if (!ctx) {
        setSoundIssue("unsupported");
        return;
      }
      contextRef.current = ctx;

      // Release any tone already sounding before starting the next one.
      if (oscillatorRef.current) stopTone();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = hz;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);

      oscillatorRef.current = osc;
      gainRef.current = gain;
      setActiveTone(tone);
      setSoundIssue(null);

      // A context still not rendering a moment after its own gesture means the
      // browser refused; without this the grid just lights up in silence.
      if (verifyTimerRef.current !== null) {
        window.clearTimeout(verifyTimerRef.current);
      }
      verifyTimerRef.current = window.setTimeout(() => {
        verifyTimerRef.current = null;
        if (!isToneContextRunning()) setSoundIssue("blocked");
      }, 400);
    },
    [stopTone],
  );

  const handleNoteTap = (noteIndex: number): void => {
    if (activeTone?.kind === "note" && activeTone.note === noteIndex) {
      stopTone();
    } else {
      playTone(noteFrequency(noteIndex, octave), {
        kind: "note",
        note: noteIndex,
      });
    }
  };

  const handleCustomTap = (): void => {
    if (activeTone?.kind === "custom") {
      stopTone();
      return;
    }
    const hz = parseFrequency(customValue);
    if (hz === null) {
      setCustomError(true);
      return;
    }
    setCustomError(false);
    playTone(hz, { kind: "custom", hz });
  };

  const handleCustomChange = (value: string): void => {
    setCustomValue(value);
    const hz = parseFrequency(value);
    setCustomError(value.trim().length > 0 && hz === null);
    // Retuning while the tone rings is the point of a free field — a singer
    // hunts for the pitch by ear rather than by committing a number.
    const ctx = contextRef.current;
    const osc = oscillatorRef.current;
    if (hz !== null && ctx && osc && activeTone?.kind === "custom") {
      osc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.02);
      setActiveTone({ kind: "custom", hz });
    }
  };

  useEffect(
    () => () => {
      // Unmount silences the tone and hands the audio session back; the shared
      // context stays alive on purpose (see toneContext).
      if (verifyTimerRef.current !== null) {
        window.clearTimeout(verifyTimerRef.current);
      }
      stopTone();
    },
    [stopTone],
  );

  const isCustomActive = activeTone?.kind === "custom";
  const nearest = isCustomActive ? describeFrequency(activeTone.hz) : null;
  const hasProblem = soundIssue !== null || customError;

  const statusLine = ((): string => {
    if (soundIssue === "unsupported") {
      return t(
        "schedule.pitch_pipe.unsupported",
        "Ta przeglądarka nie odtworzy tonu.",
      );
    }
    if (soundIssue === "blocked") {
      return t(
        "schedule.pitch_pipe.blocked",
        "Przeglądarka wyciszyła dźwięk — dotknij nuty jeszcze raz i sprawdź głośność telefonu.",
      );
    }
    if (customError) {
      return t("schedule.pitch_pipe.custom_range", {
        defaultValue: "Podaj częstotliwość od {{min}} do {{max}} Hz.",
        min: MIN_HZ,
        max: MAX_HZ,
      });
    }
    if (activeTone?.kind === "note") {
      return `${PITCH_NOTES[activeTone.note]}${octave} · ${formatHz(
        noteFrequency(activeTone.note, octave),
      )} Hz`;
    }
    if (nearest && isCustomActive) {
      const cents =
        nearest.cents === 0
          ? ""
          : ` ${nearest.cents > 0 ? "+" : "−"}${Math.abs(nearest.cents)} ct`;
      return `${formatHz(activeTone.hz)} Hz · ≈ ${nearest.note}${cents}`;
    }
    return t(
      "schedule.pitch_pipe.hint",
      "Dotknij nutę, aby usłyszeć ton. Dotknij ponownie, aby wyciszyć.",
    );
  })();

  return (
    <GlassCard variant="ethereal" padding="sm" isHoverable={false} className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Eyebrow color="muted">
          {t("schedule.pitch_pipe.title", "Kamerton")}
        </Eyebrow>
        <div className="flex items-center gap-1 rounded-chip border border-ethereal-marble bg-ethereal-alabaster p-0.5 shadow-glass-solid">
          {OCTAVES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setOctave(value);
                if (activeTone?.kind === "note") stopTone();
              }}
              aria-pressed={octave === value}
              className={cn(
                "min-h-7 rounded-chip border px-2 py-0.5 transition-all active:scale-95",
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
          const isActive = activeTone?.kind === "note" && activeTone.note === index;
          const isTonic = suggestedTonic === index;
          return (
            <button
              key={note}
              type="button"
              onClick={() => handleNoteTap(index)}
              aria-pressed={isActive}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-chip border text-sm font-semibold transition-all active:scale-95",
                isActive
                  ? "border-ethereal-gold bg-ethereal-gold text-surface-inverse shadow-button-primary"
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

      <div className="mt-3 flex items-end gap-2 border-t border-hairline pt-3">
        <div className="min-w-0 flex-1">
          <Input
            label={t("schedule.pitch_pipe.custom_label", "Własna częstotliwość")}
            value={customValue}
            onChange={(event) => handleCustomChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (!isCustomActive) handleCustomTap();
            }}
            // The message lives in the status line below, which every other
            // state of this instrument already speaks through.
            hasError={customError}
            inputMode="decimal"
            enterKeyHint="go"
            placeholder="440"
            rightElement="Hz"
            className="py-2.5"
          />
        </div>
        <Button
          variant={isCustomActive ? "primary" : "secondary"}
          size="icon"
          onClick={handleCustomTap}
          aria-label={
            isCustomActive
              ? t("schedule.pitch_pipe.custom_stop", "Wycisz ton")
              : t("schedule.pitch_pipe.custom_play", "Zagraj częstotliwość")
          }
        >
          {isCustomActive ? (
            <Square size={15} aria-hidden="true" />
          ) : (
            <Play size={15} aria-hidden="true" />
          )}
        </Button>
      </div>

      <Text
        size="xs"
        color={hasProblem ? "crimson" : "muted"}
        className="mt-2.5 px-0.5"
        role={hasProblem ? "alert" : undefined}
      >
        {statusLine}
      </Text>
    </GlassCard>
  );
};
