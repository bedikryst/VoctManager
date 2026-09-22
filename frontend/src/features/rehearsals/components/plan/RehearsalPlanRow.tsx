/**
 * @file RehearsalPlanRow.tsx
 * @description One point of the evening's plan in the editor: grip, a clock
 * slot, what is rehearsed (a piece of the programme, or a typed label for a
 * warm-up), its minutes, a one-line note under it, and who the point does
 * without. The minutes are the conductor's estimate and the clocks follow
 * from them, so a drag recomputes every time after it. The slot shows the
 * row's effective clock: in ink when it is an anchor (a promise, typed or
 * tapped), muted when it follows from the minutes above — a tap on it anchors
 * it, clearing an anchor hands it back to the minutes — and a ghost
 * "+ godz." only when nothing is known. Nothing is validated against the
 * rehearsal's window: ordering carries the warning. The caption "woła 14 z 22" is the row's effect stated
 * in people, from the same rule the server calls with. A break is the same
 * row, muted and without exclusions: it calls nobody, so there is nobody to
 * leave out — its clock is where the people before it are released. A row
 * that opens a time block carries the block's header above its own line.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanRow
 */

import React, { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Coffee, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { TimeField } from "@/shared/ui/composites/DateTimeField";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import type { VoiceLine } from "@/shared/types";
import type { VoiceFamilyId } from "@/features/projects/lib/voiceFamilies";
import type { EffectiveClock } from "../../lib/rehearsalPlan";
import { VoiceExclusionChips } from "./VoiceExclusionChips";
import type { PlanDraftRow, PlanEditor, PlanRowReading } from "./usePlanEditor";

/** Minutes step by five: a round start then gives round clocks, with no rounding rule. */
const MINUTES_STEP = 5;

interface RehearsalPlanRowProps {
  readonly row: PlanDraftRow;
  readonly reading: PlanRowReading;
  readonly calledTotal: number;
  readonly programOptions: readonly SelectOption[];
  /** The clock a first keystroke starts from on an empty time — the rehearsal's own. */
  readonly fallbackClock: string;
  /** The row's effective clock, as the draft stands. */
  readonly clock: EffectiveClock | undefined;
  readonly onAnchor: (key: string) => void;
  readonly onUpdate: PlanEditor["updateRow"];
  readonly onToggleLine: (key: string, line: VoiceLine) => void;
  readonly onToggleFamily: (key: string, family: VoiceFamilyId) => void;
  readonly onRemove: (key: string) => void;
  /** The head of the block this row opens; inside the row so a drag carries it. */
  readonly header?: React.ReactNode;
}

export const RehearsalPlanRow = ({
  row,
  reading,
  calledTotal,
  programOptions,
  fallbackClock,
  clock,
  onAnchor,
  onUpdate,
  onToggleLine,
  onToggleFamily,
  onRemove,
  header,
}: RehearsalPlanRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.key });

  // The field stays open while it holds focus, so clearing an anchor does
  // not pull the field out from under the keyboard; it collapses on blur.
  const clockId = useId();
  const [clockOpen, setClockOpen] = useState(false);
  const anchored = Boolean(row.starts_at);
  const derivedClock = !anchored && clock?.derived ? clock.clock : null;
  useEffect(() => {
    if (clockOpen) document.getElementById(clockId)?.focus();
  }, [clockOpen, clockId]);

  const setMinutes = (raw: string): void => {
    const parsed = Number.parseInt(raw, 10);
    onUpdate(row.key, { minutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null });
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10")}
    >
      <div
        className={cn(
          "flex flex-col gap-2 px-4 py-3 transition-colors",
          isDragging
            ? "rounded-control border border-ethereal-gold/45 bg-ethereal-marble shadow-glass-ethereal"
            : row.is_break
              ? "bg-ethereal-parchment/25 hover:bg-ethereal-ink/3"
              : "hover:bg-ethereal-ink/3",
        )}
      >
        {header}
        <div className="flex items-center gap-2">
          {/* The grip is the only drag surface, so the fields stay usable. */}
          <span
            {...attributes}
            {...listeners}
            className={cn(
              "-ml-1.5 flex min-h-8 min-w-6 shrink-0 cursor-grab select-none items-center justify-center rounded-chip text-ethereal-graphite/30 transition-colors",
              "hover:bg-ethereal-gold/10 hover:text-ethereal-gold active:cursor-grabbing",
              "pointer-coarse:min-h-11 pointer-coarse:min-w-9",
            )}
            aria-label={t("rehearsals.plan.row.drag", "Przeciągnij: {{title}}", {
              title: reading.title || t("rehearsals.plan.row.untitled", "punkt bez nazwy"),
            })}
          >
            <GripVertical size={14} aria-hidden="true" />
          </span>

          {/* The slot keeps its width whatever it shows: the note's indent and
              the column of clocks down the list depend on it. */}
          <div className="w-28 shrink-0" onFocus={() => setClockOpen(true)}>
            {anchored || clockOpen ? (
              <TimeField
                id={clockId}
                value={row.starts_at ?? ""}
                onChange={(time) => onUpdate(row.key, { starts_at: time || null })}
                onBlur={() => setClockOpen(false)}
                fallback={derivedClock ?? fallbackClock}
                ariaLabel={t("rehearsals.plan.row.time", "Godzina (opcjonalna)")}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (derivedClock) onAnchor(row.key);
                  setClockOpen(true);
                }}
                aria-label={
                  derivedClock
                    ? t("rehearsals.plan.row.anchor", "Ustal godzinę {{clock}}", {
                        clock: derivedClock,
                      })
                    : t("rehearsals.plan.row.time", "Godzina (opcjonalna)")
                }
                className={cn(
                  "flex min-h-11 w-full items-center justify-center rounded-control transition-colors",
                  "hover:bg-ethereal-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                )}
              >
                {derivedClock ? (
                  <Text as="span" size="base" color="muted" className="tabular-nums">
                    {derivedClock}
                  </Text>
                ) : (
                  <Caption color="muted">
                    {t("rehearsals.plan.row.add_time", "+ godz.")}
                  </Caption>
                )}
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {row.piece !== null ? (
              <Select
                value={row.piece}
                onValueChange={(pieceId) => onUpdate(row.key, { piece: pieceId })}
                options={programOptions}
                ariaLabel={t("rehearsals.plan.row.piece", "Utwór z programu")}
              />
            ) : (
              <Input
                type="text"
                value={row.label}
                maxLength={120}
                onChange={(event) => onUpdate(row.key, { label: event.target.value })}
                placeholder={t("rehearsals.plan.row.label_placeholder", "np. Rozśpiewanie, ogłoszenia")}
                aria-label={t("rehearsals.plan.row.label", "Nazwa punktu")}
              />
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(row.key)}
            aria-label={t("common.actions.delete", "Usuń")}
            className="shrink-0 text-ethereal-graphite/40 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Under the title, indented past the grip and the clock (6 + 28 and
            two gaps, in spacing steps) so the aside reads as the row's own —
            on a phone the width is worth more than the alignment. Ghost: the
            note waits to be asked. */}
        <div className="flex flex-col gap-2 sm:pl-38">
          {/* The minutes sit beside the note, not on the title line: on a
              phone the title needs that width more. */}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Input
                variant="ghost"
                type="text"
                value={row.note}
                maxLength={200}
                onChange={(event) => onUpdate(row.key, { note: event.target.value })}
                placeholder={t("rehearsals.plan.row.note_placeholder", "Notatka: od t. 40, pierwsze czytanie…")}
                aria-label={t("rehearsals.plan.row.note", "Notatka")}
              />
            </div>
            <div className="flex w-24 shrink-0 items-center gap-1.5">
              <Input
                variant="ghost"
                type="number"
                inputMode="numeric"
                min={MINUTES_STEP}
                step={MINUTES_STEP}
                value={row.minutes ?? ""}
                onChange={(event) => setMinutes(event.target.value)}
                placeholder="–"
                aria-label={t("rehearsals.plan.row.minutes", "Minuty")}
                className="text-center tabular-nums"
              />
              <Caption color="muted" aria-hidden="true">
                {t("rehearsals.plan.row.minutes_unit", "min")}
              </Caption>
            </div>
          </div>
          {row.is_break ? (
            <Caption color="muted" className="flex items-center gap-1.5">
              <Coffee size={12} aria-hidden="true" />
              {t("rehearsals.plan.row.break_hint", "Przerwa — nikogo nie woła")}
            </Caption>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <VoiceExclusionChips
                reading={reading}
                excludesInstrumentalists={row.excludes_instrumentalists}
                onToggleLine={(line) => onToggleLine(row.key, line)}
                onToggleFamily={(family) => onToggleFamily(row.key, family)}
                onToggleInstrumentalists={() =>
                  onUpdate(row.key, { excludes_instrumentalists: !row.excludes_instrumentalists })
                }
              />
              {/* The row's effect in people. Silent while it calls everyone the
                  rehearsal calls — the resting default is not restated. */}
              {reading.hasExclusions && (
                <Caption color="muted" className="tabular-nums">
                  {t("rehearsals.plan.row.calls", "woła {{called}} z {{total}}", {
                    called: reading.called,
                    total: calledTotal,
                  })}
                </Caption>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
};
