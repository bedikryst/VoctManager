/**
 * @file AssessedRangeField.tsx
 * @description The conductor's assessment of a singer's range, in the artist
 * editor, entered the way the singer enters their proposal: by keys that
 * sound, never by typing a note name, which is read an octave apart by
 * readers of different notations. The four notes stand as the conductor writes
 * them, `a (g) – a² (c³)`, in the reader's own notation (`RangeSlots`), so the
 * assessment and the proposal under it read alike.
 *
 * Choosing a slot opens a keyboard under the line. Its window is the voice's
 * own (`keyboardWindow`), following the voice chosen in the form, and it can
 * be widened at either end. A key sounds and fills the slot, and the line
 * above the keys names that note in all three notations and in hertz. "Usuń"
 * empties the selected slot, which is how an assessment is cleared: all four
 * empty is a valid answer, "not assessed yet". "Gotowe" closes the keyboard.
 *
 * The field writes the form, never the record: nothing is saved until the
 * editor is. An order problem shows as soon as it exists, as on the singer's
 * screen; a missing tessitura bound only once a save has been refused, since
 * every assessment passes through that state while it is being written.
 * @module features/artists/components/AssessedRangeField
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  playVoicedTone,
  type VoicedToneHandle,
} from "@/shared/lib/audio/voicedTone";
import {
  spokenPitch,
  type PitchNotation,
  type VocalRangeMidi,
} from "@/shared/lib/music/pitchNotation";
import {
  rangeBands,
  rangePitches,
  slotCentre,
  slotSpan,
  type RangeProblem,
  type RangeSlot,
} from "@/shared/lib/music/rangeDraft";
import { cn } from "@/shared/lib/utils";
import { NoteReadout } from "@/shared/ui/instruments/NoteReadout";
import { RangeSlots, SLOT_KEY } from "@/shared/ui/instruments/RangeSlots";
import {
  VerticalKeyboard,
  type KeyboardCenterRequest,
} from "@/shared/ui/instruments/VerticalKeyboard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import {
  KEYBOARD_LIMIT,
  keyboardWindow,
  NO_REACH,
  voiceCentreMidi,
  type KeyboardReach,
  type SingingVoice,
} from "../constants/voices";
import { assessedRangeProblem } from "../types/artist.dto";

const RANGE_PROBLEMS: ReadonlySet<string> = new Set<RangeProblem>([
  "tessituraOrder",
  "extremeLowOrder",
  "extremeHighOrder",
  "incomplete",
]);

export interface AssessedRangeFieldProps {
  readonly value: VocalRangeMidi;
  readonly voice: SingingVoice;
  readonly notation: PitchNotation;
  readonly disabled: boolean;
  /** The form's error on any of the four notes: the client's problem code
   *  after a refused save, or the server's message. */
  readonly error: string | undefined;
  readonly onChange: (slot: RangeSlot, midi: number | null) => void;
}

export const AssessedRangeField = ({
  value,
  voice,
  notation,
  disabled,
  error,
  onChange,
}: AssessedRangeFieldProps): React.JSX.Element => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() ?? false;
  const label = t("artists.editor.assessed_range.label", "Skala głosu wg dyrygenta");

  /** The slot the keyboard writes to; null while the keyboard is closed. */
  const [slot, setSlot] = useState<RangeSlot | null>(null);
  /** The key last pressed since the slot was chosen; the readout names it. */
  const [touched, setTouched] = useState<number | null>(null);
  const [reach, setReach] = useState<KeyboardReach>(NO_REACH);
  const [centerRequest, setCenterRequest] = useState<KeyboardCenterRequest | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");
  const tone = useRef<VoicedToneHandle | null>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => tone.current?.stop(), []);

  // The keyboard opens under the line, which may be low in the panel: bring
  // it into view once, when it opens.
  const isOpen = slot !== null;
  useEffect(() => {
    if (!isOpen) return;
    keyboardRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [isOpen, reduceMotion]);

  const keySpan = useMemo(
    () => keyboardWindow(voice, rangePitches(value), reach),
    [voice, value, reach],
  );
  const bands = useMemo(() => rangeBands(value), [value]);
  const emphasis = useMemo(
    () => (slot === null ? null : slotSpan(slot, value)),
    [slot, value],
  );

  const slotLabel = (each: RangeSlot): string =>
    t(`vocal_range.slots.${SLOT_KEY[each]}.label`);

  const requestCentre = (midi: number): void => {
    setCenterRequest((current) => ({ midi, seq: (current?.seq ?? 0) + 1 }));
  };

  const selectSlot = (next: RangeSlot): void => {
    setSlot(next);
    setTouched(null);
    requestCentre(slotCentre(next, value, voiceCentreMidi(voice)));
  };

  const pressKey = (midi: number): void => {
    if (slot === null || disabled) return;
    // Inside the key's click, the gesture iOS needs before any sound.
    tone.current?.stop();
    tone.current = playVoicedTone(midi);
    setTouched(midi);
    onChange(slot, midi);
    setAnnouncement(`${slotLabel(slot)}: ${spokenPitch(midi, notation)}`);
  };

  const clearSlot = (): void => {
    if (slot === null) return;
    setTouched(null);
    onChange(slot, null);
  };

  const close = (): void => {
    setSlot(null);
    setTouched(null);
  };

  const widen = (side: keyof KeyboardReach): void => {
    const next = { ...reach, [side]: reach[side] + 1 };
    setReach(next);
    const span = keyboardWindow(voice, rangePitches(value), next);
    requestCentre(side === "above" ? span.high : span.low);
  };
  const extendAbove =
    keySpan.high < KEYBOARD_LIMIT.high
      ? {
          label: t("vocal_range.keyboard_more_above", "Wyższe dźwięki"),
          onPress: () => widen("above"),
        }
      : null;
  const extendBelow =
    keySpan.low > KEYBOARD_LIMIT.low
      ? {
          label: t("vocal_range.keyboard_more_below", "Niższe dźwięki"),
          onPress: () => widen("below"),
        }
      : null;

  const problem = assessedRangeProblem(value);
  const problemText =
    problem === "tessituraOrder"
      ? t(
          "vocal_range.validation.tessitura_order",
          "Dolna granica tessitury musi leżeć niżej niż górna.",
        )
      : problem === "extremeLowOrder"
        ? t(
            "vocal_range.validation.extreme_low_order",
            "Skrajny dźwięk dolny nie może leżeć wyżej niż dolna granica tessitury.",
          )
        : problem === "extremeHighOrder"
          ? t(
              "vocal_range.validation.extreme_high_order",
              "Skrajny dźwięk górny nie może leżeć niżej niż górna granica tessitury.",
            )
          : problem === "incomplete" && error
            ? t(
                "artists.editor.assessed_range.incomplete",
                "Wybierz obie granice tessitury albo usuń wszystkie dźwięki.",
              )
            : // A refusal the client did not foresee: the server's own words.
              problem === null && error && !RANGE_PROBLEMS.has(error)
              ? error
              : null;

  const readoutMidi = slot === null ? null : (touched ?? value[slot]);

  return (
    <div className="space-y-2">
      <Eyebrow as="span" color="muted" className="ml-1 block">
        {label}
      </Eyebrow>

      <RangeSlots
        draft={value}
        selected={slot}
        notation={notation}
        low={keySpan.low}
        high={keySpan.high}
        label={label}
        scale="field"
        disabled={disabled}
        onSelect={selectSlot}
      />

      {problemText ? (
        <Text size="sm" color="crimson" role="alert" className="ml-1">
          {problemText}
        </Text>
      ) : null}

      <AnimatePresence initial={false}>
        {slot !== null ? (
          <motion.div
            key="keyboard"
            ref={keyboardRef}
            initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-3 pt-1"
          >
            <div className="flex h-10 items-center">
              {readoutMidi !== null ? (
                <NoteReadout midi={readoutMidi} notation={notation} />
              ) : (
                <Text size="sm" color="muted" className="line-clamp-2 leading-5">
                  {t(
                    "vocal_range.note_card.hint",
                    "Dotknij klawisza: zabrzmi i trafi do zaznaczonego pola.",
                  )}
                </Text>
              )}
            </div>

            <VerticalKeyboard
              low={keySpan.low}
              high={keySpan.high}
              notation={notation}
              label={t("vocal_range.keyboard_label", {
                slot: slotLabel(slot),
                defaultValue: "Klawiatura. Dotknięty klawisz trafi do pola: {{slot}}",
              })}
              bands={bands}
              emphasis={emphasis}
              activeKey={value[slot]}
              centerRequest={centerRequest}
              onKeyPress={pressKey}
              extendAbove={extendAbove}
              extendBelow={extendBelow}
              className="h-72"
            />

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSlot}
                disabled={disabled}
                aria-label={`${t("vocal_range.slots.clear", "Usuń")}: ${slotLabel(slot)}`}
                className={cn(value[slot] === null && "invisible")}
              >
                {t("vocal_range.slots.clear", "Usuń")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={close}>
                {t("artists.editor.assessed_range.done", "Gotowe")}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
};
