/**
 * @file VoiceExclusionChips.tsx
 * @description Who a plan row does without. Resting state says nothing — a
 * row that calls everyone is the default and "never state the resting
 * default" — so the closed face is one ghost "Wszyscy" that opens the chips.
 * Open, the chips are the row's own lines grouped by voice, with a family
 * toggle in front of each group ("Alty" = every A-line at once, so "B2 i
 * alty" is two taps), plus "bez instrumentalistów" when the rehearsal calls a
 * player. Every chip carries the number of seats it removes, computed by the
 * server's own rule, so an uncast bass still called under "bez B2" is a
 * visible fact rather than a mystery Florent reports as "exclusions don't
 * work". The chips draw through `Badge`; the button is a bare wrapper.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/VoiceExclusionChips
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption } from "@/shared/ui/primitives/typography";
import type { VoiceFamilyId } from "@/features/projects/lib/voiceFamilies";
import type { VoiceLine } from "@/shared/types";
import type { PlanRowReading } from "./usePlanEditor";

interface VoiceExclusionChipsProps {
  readonly reading: PlanRowReading;
  readonly excludesInstrumentalists: boolean;
  readonly onToggleLine: (line: VoiceLine) => void;
  readonly onToggleFamily: (family: VoiceFamilyId) => void;
  readonly onToggleInstrumentalists: () => void;
}

const CHIP_BUTTON =
  "rounded-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

/** The family's plural name — the same taxonomy the casting board headers use. */
const useFamilyLabels = (): Record<VoiceFamilyId, string> => {
  const { t } = useTranslation();
  return {
    S: t("projects.micro_cast.voices.sopranos", "Soprany"),
    MS: t("projects.micro_cast.voices.mezzos", "Mezzosoprany"),
    A: t("projects.micro_cast.voices.altos", "Alty"),
    CT: t("projects.micro_cast.voices.countertenors", "Kontratenory"),
    T: t("projects.micro_cast.voices.tenors", "Tenory"),
    BAR: t("projects.micro_cast.voices.baritones", "Barytony"),
    B: t("projects.micro_cast.voices.basses", "Basy"),
    V: t("projects.micro_cast.voices.untyped", "Głosy nieokreślone"),
    ROLE: t("projects.micro_cast.voices.special", "Linie specjalne"),
  };
};

/** "B2 · 3" — the chip and the seats it removes; a zero removes nobody and says so. */
const ChipLabel = ({ label, removes }: { label: string; removes: number }): React.JSX.Element => (
  <>
    {label}
    <span className="tabular-nums opacity-70">{removes}</span>
  </>
);

const ToggleChip = ({
  label,
  removes,
  excluded,
  ariaLabel,
  onClick,
}: {
  label: string;
  removes: number;
  excluded: boolean;
  ariaLabel: string;
  onClick: () => void;
}): React.JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={excluded}
    aria-label={ariaLabel}
    className={CHIP_BUTTON}
  >
    <Badge
      variant={excluded ? "amethyst" : "neutral"}
      className={cn(
        "cursor-pointer",
        excluded ? "line-through decoration-ethereal-amethyst/60" : "hover:border-ethereal-gold/40",
      )}
    >
      <ChipLabel label={label} removes={removes} />
    </Badge>
  </button>
);

export const VoiceExclusionChips = ({
  reading,
  excludesInstrumentalists,
  onToggleLine,
  onToggleFamily,
  onToggleInstrumentalists,
}: VoiceExclusionChipsProps): React.JSX.Element => {
  const { t } = useTranslation();
  const familyLabels = useFamilyLabels();
  const [isOpen, setIsOpen] = useState(false);

  // Closed and clean: the one ghost affordance. Closed with exclusions: the
  // exclusions themselves, each removable, and the same affordance to reopen.
  if (!isOpen) {
    const excludedLines = reading.families.flatMap((family) =>
      family.excluded
        ? [
            {
              key: `family:${family.family}`,
              label: familyLabels[family.family],
              removes: family.removes,
              clear: () => onToggleFamily(family.family),
            },
          ]
        : family.lines
            .filter((line) => line.excluded)
            .map((line) => ({
              key: line.line,
              label: line.line,
              removes: line.removes,
              clear: () => onToggleLine(line.line),
            })),
    );
    if (excludesInstrumentalists) {
      excludedLines.push({
        key: "instrumentalists",
        label: t("rehearsals.plan.exclude.instrumentalists", "Instrumentaliści"),
        removes: reading.instrumentalistsRemoved,
        clear: onToggleInstrumentalists,
      });
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {excludedLines.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={entry.clear}
            aria-label={t("rehearsals.plan.exclude.clear_one", "Przywróć: {{label}}", {
              label: entry.label,
            })}
            className={CHIP_BUTTON}
          >
            <Badge variant="amethyst" className="cursor-pointer">
              {t("rehearsals.plan.exclude.without", "bez {{label}}", { label: entry.label })}
              <span className="tabular-nums opacity-70">
                {t("rehearsals.plan.exclude.people", "{{count}} os.", { count: entry.removes })}
              </span>
              <X size={11} aria-hidden="true" />
            </Badge>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={cn(
            CHIP_BUTTON,
            "inline-flex items-center gap-1 px-1 py-0.5 text-ethereal-graphite/60 transition-colors hover:text-ethereal-gold",
          )}
        >
          <Users size={11} aria-hidden="true" />
          <Caption color="inherit">
            {excludedLines.length === 0
              ? t("rehearsals.plan.exclude.everyone", "Wszyscy")
              : t("rehearsals.plan.exclude.edit", "Zmień")}
          </Caption>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-nested border border-hairline bg-ethereal-marble/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Caption color="muted">
          {t("rehearsals.plan.exclude.prompt", "Kogo ten punkt nie potrzebuje")}
        </Caption>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label={t("common.actions.close", "Zamknij")}
          className={cn(CHIP_BUTTON, "p-0.5 text-ethereal-graphite/50 hover:text-ethereal-ink")}
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>

      {reading.families.map((family) => (
        <div key={family.family} className="flex flex-wrap items-center gap-1.5">
          <ToggleChip
            label={familyLabels[family.family]}
            removes={family.removes}
            excluded={family.excluded}
            ariaLabel={t("rehearsals.plan.exclude.toggle_family", "Wyklucz sekcję: {{label}}", {
              label: familyLabels[family.family],
            })}
            onClick={() => onToggleFamily(family.family)}
          />
          {/* A family of one line is its own chip already. */}
          {family.lines.length > 1 &&
            family.lines.map((line) => (
              <ToggleChip
                key={line.line}
                label={line.line}
                removes={line.removes}
                excluded={line.excluded}
                ariaLabel={t("rehearsals.plan.exclude.toggle_line", "Wyklucz linię: {{label}}", {
                  label: line.line,
                })}
                onClick={() => onToggleLine(line.line)}
              />
            ))}
        </div>
      ))}

      {reading.offersInstrumentalists && (
        <div className="flex flex-wrap items-center gap-1.5">
          <ToggleChip
            label={t("rehearsals.plan.exclude.instrumentalists", "Instrumentaliści")}
            removes={reading.instrumentalistsRemoved}
            excluded={excludesInstrumentalists}
            ariaLabel={t("rehearsals.plan.exclude.toggle_instrumentalists", "Bez instrumentalistów")}
            onClick={onToggleInstrumentalists}
          />
        </div>
      )}
    </div>
  );
};
