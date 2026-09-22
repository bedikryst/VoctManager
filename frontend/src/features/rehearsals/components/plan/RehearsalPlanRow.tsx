/**
 * @file RehearsalPlanRow.tsx
 * @description One point of the evening's plan in the editor: grip, an
 * optional clock, what is rehearsed (a piece of the programme, or a typed
 * label for a warm-up), a one-line note under it, and who the point does
 * without. The clock is optional on purpose — "18:15 Orff / Lumen / Bach" is
 * three rows and one time, and a row without a clock flows under the last
 * clocked one. Nothing is validated against the rehearsal's window: ordering
 * carries the warning. The caption "woła 14 z 22" is the row's effect stated
 * in people, from the same rule the server calls with. A break is the same
 * row, muted and without exclusions: it calls nobody, so there is nobody to
 * leave out — its clock is where the people before it are released.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Coffee, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { TimeField } from "@/shared/ui/composites/DateTimeField";
import { Caption } from "@/shared/ui/primitives/typography";
import type { VoiceLine } from "@/shared/types";
import type { VoiceFamilyId } from "@/features/projects/lib/voiceFamilies";
import { VoiceExclusionChips } from "./VoiceExclusionChips";
import type { PlanDraftRow, PlanEditor, PlanRowReading } from "./usePlanEditor";

interface RehearsalPlanRowProps {
  readonly row: PlanDraftRow;
  readonly reading: PlanRowReading;
  readonly calledTotal: number;
  readonly programOptions: readonly SelectOption[];
  /** The clock a first keystroke starts from on an empty time — the rehearsal's own. */
  readonly fallbackClock: string;
  readonly onUpdate: PlanEditor["updateRow"];
  readonly onToggleLine: (key: string, line: VoiceLine) => void;
  readonly onToggleFamily: (key: string, family: VoiceFamilyId) => void;
  readonly onRemove: (key: string) => void;
}

export const RehearsalPlanRow = ({
  row,
  reading,
  calledTotal,
  programOptions,
  fallbackClock,
  onUpdate,
  onToggleLine,
  onToggleFamily,
  onRemove,
}: RehearsalPlanRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.key });

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

          <div className="w-28 shrink-0">
            <TimeField
              value={row.starts_at ?? ""}
              onChange={(time) => onUpdate(row.key, { starts_at: time || null })}
              fallback={fallbackClock}
              ariaLabel={t("rehearsals.plan.row.time", "Godzina (opcjonalna)")}
            />
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
                placeholder={t("rehearsals.plan.row.label_placeholder", "np. Rozśpiewanie, przerwa")}
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
          <Input
            variant="ghost"
            type="text"
            value={row.note}
            maxLength={200}
            onChange={(event) => onUpdate(row.key, { note: event.target.value })}
            placeholder={t("rehearsals.plan.row.note_placeholder", "Notatka: od t. 40, pierwsze czytanie…")}
            aria-label={t("rehearsals.plan.row.note", "Notatka")}
          />
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
