/**
 * @file MarkVoicePicker.tsx
 * @description Which voices a mark is for: tutti, or any of the four sections.
 *
 * One row of chips, used twice: in the toolbar's panel it addresses the NEXT
 * mark, on a mark's card or a selection's it readdresses what exists. Tutti is
 * a chip of its own rather than "nothing ticked", because "for everyone" is the
 * answer most marks have and it should read as one. Ticking all four sections
 * is tutti too, and lights it.
 *
 * The voices filter what a reader is shown and who is told; they never hide a
 * mark from anyone who may read its layer.
 * @module features/annotations/components
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

import { canonicalVoices, toggleVoice, VOICE_SECTIONS, type VoiceSection } from "../lib/voices";

/** Each section's name, said by a screen reader and shown on hover. */
export const VOICE_SECTION_NAMES: Readonly<Record<VoiceSection, [string, string]>> = {
  S: ["annotations.voices.section.S", "Soprany"],
  A: ["annotations.voices.section.A", "Alty"],
  T: ["annotations.voices.section.T", "Tenory"],
  B: ["annotations.voices.section.B", "Basy"],
};

/** A card's voice row: the voices in force, and the edit that changes them. */
export interface MarkVoices {
  /** Null for a selection addressed differently mark by mark. */
  current: readonly VoiceSection[] | null;
  onChange: (next: VoiceSection[]) => void;
}

interface MarkVoicePickerProps {
  /**
   * The voices in force. Null for a selection whose marks are addressed
   * differently: no chip is lit, and a tap gives them all one answer.
   */
  current: readonly VoiceSection[] | null;
  onChange: (next: VoiceSection[]) => void;
  /** `chrome`: the dark toolbar panel. `card`: a mark's card over the page. */
  surface: "chrome" | "card";
}

export const MarkVoicePicker = ({
  current,
  onChange,
  surface,
}: MarkVoicePickerProps): React.JSX.Element => {
  const { t } = useTranslation();
  const voices = current === null ? null : canonicalVoices(current);
  const isTutti = voices !== null && voices.length === 0;
  const groupLabel = t("annotations.voices.label", "Dla głosów");

  const chip = (active: boolean): string =>
    cn(
      "h-8 min-w-8 rounded-full px-2.5 text-xs font-semibold transition-colors",
      surface === "chrome"
        ? cn(
            "text-ink-on-inverse",
            active ? "bg-ink-on-inverse/20" : "hover:bg-ink-on-inverse/10",
          )
        : active
          ? "bg-ethereal-ink text-ethereal-marble"
          : "border border-hairline-strong text-ethereal-graphite hover:text-ethereal-ink",
    );

  return (
    <div className="flex flex-col gap-1">
      {surface === "card" && (
        <Eyebrow as="p" size="overline-sm" color="muted">
          {groupLabel}
        </Eyebrow>
      )}
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={groupLabel}>
        <button
          type="button"
          onClick={() => onChange([])}
          aria-pressed={isTutti}
          className={chip(isTutti)}
        >
          {t("annotations.voices.tutti", "Tutti")}
        </button>
        {VOICE_SECTIONS.map((section) => {
          const active = voices !== null && voices.includes(section);
          const [nameKey, fallback] = VOICE_SECTION_NAMES[section];
          return (
            <button
              key={section}
              type="button"
              onClick={() => onChange(toggleVoice(voices ?? [], section))}
              aria-pressed={active}
              aria-label={t(nameKey, fallback)}
              title={t(nameKey, fallback)}
              className={chip(active)}
            >
              {section}
            </button>
          );
        })}
      </div>
    </div>
  );
};
