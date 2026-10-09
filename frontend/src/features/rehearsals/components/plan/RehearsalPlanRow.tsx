/**
 * @file RehearsalPlanRow.tsx
 * @description One point of the evening's plan in the editor, laid out as the
 * line it is: `[grip][clock][piece][note][min][⋯]` on one line from `sm` up,
 * and on a phone the note and minutes under the title. An empty note and
 * empty minutes render nothing until the row is active (focused or tapped —
 * the editor holds which one is) or hovered, so a plan of bare titles reads
 * as a list of titles rather than a grid of empty fields; a filled one always
 * shows. What a row does without, moving it, and removing it live in the "⋯"
 * menu, and the exclusions line appears only once a row leaves somebody out —
 * a row that calls everyone is the resting default and says nothing.
 *
 * The minutes are the conductor's estimate and the clocks follow from them,
 * so a drag recomputes every time after it. A row without minutes whose
 * clock runs to the next fixed one shows the length the two imply, muted,
 * in its minutes field — and always, since it says something — so a plan
 * written in clocks alone never asks for the same length twice; typing a
 * number replaces it. The slot shows the row's
 * effective clock: in ink when it is an anchor (a promise, typed or tapped),
 * muted when it follows from the minutes above — a click, Enter or a typed
 * digit on it anchors it, and the anchor's "×" hands it back to the minutes —
 * and a ghost "+ godz." only when nothing is known. The slot opens its field
 * on those acts and never on focus: a focus that swaps the button out on
 * mousedown leaves the click with nothing to land on, and the tap that meant
 * "keep this time" opens an empty field. Nothing is validated against the
 * rehearsal's window: ordering carries the warning. The caption "woła 14 z
 * 22" is the row's effect stated in people, from the same rule the server
 * calls with. A break is the same row on a muted fill, without exclusions: it
 * calls nobody, so there is nobody to leave out — its clock is where the
 * people before it are released. A row that opens a time block carries the
 * block's header above its own line. A clock typed into the slot is committed
 * when the field loses focus with a different time than it had on entry —
 * never per keystroke — and the editor may then move the row into time
 * order; the moved row glows briefly.
 *
 * Rows stay within 48 px on a desktop and keep 44-px touch targets on a
 * coarse pointer: this is the editor, not what the stand reads — the stand
 * reads the plan's read view.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanRow
 */

import React, { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  Coffee,
  GripVertical,
  Hourglass,
  MoreHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { TimeField } from "@/shared/ui/composites/DateTimeField";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import type { VoiceLine } from "@/shared/types";
import type { VoiceFamilyId } from "@/shared/lib/voiceFamilies";
import type { EffectiveClock } from "../../lib/rehearsalPlan";
import { VoiceExclusionChips } from "./VoiceExclusionChips";
import {
  RESERVE_DIVIDER_KEY,
  type PlanDraftRow,
  type PlanEditor,
  type PlanRowReading,
} from "./usePlanEditor";

/** Minutes step by five: a round start then gives round clocks, with no rounding rule. */
const MINUTES_STEP = 5;

/**
 * The slot's inner padding, shared by the field and the button that stands in
 * for it: the right side keeps room for an anchor's "×", and the same offset on
 * the button keeps muted and fixed clocks in one column down the list.
 */
const CLOCK_SLOT_PADDING = "pl-1 pr-7";

/**
 * The row's fields at the row's density: a desktop line holds them within
 * 48 px, a coarse pointer gets them back at 44 px or more.
 */
const FIELD_DENSITY = "py-1.5 pointer-coarse:py-2.5";

const DIGIT = /^\d$/;

interface RehearsalPlanRowProps {
  readonly row: PlanDraftRow;
  readonly reading: PlanRowReading;
  readonly calledTotal: number;
  readonly programOptions: readonly SelectOption[];
  /** The clock a first keystroke starts from on an empty time — the rehearsal's own. */
  readonly fallbackClock: string;
  /** The row's effective clock, as the draft stands. */
  readonly clock: EffectiveClock | undefined;
  /**
   * The length the row's clock and the next fixed one imply, when the row
   * has no minutes of its own (`rowLengths`); null otherwise.
   */
  readonly impliedMinutes: number | null;
  /** The row the conductor is working on: its empty note and minutes show. */
  readonly isActive: boolean;
  readonly onActivate: (key: string) => void;
  /** The row stands under "Jeśli starczy czasu". */
  readonly isReserve: boolean;
  /** The neighbour "Wyżej" / "Niżej" trades places with, on the row's own side of the divider. */
  readonly upTo: string | null;
  readonly downTo: string | null;
  readonly onMove: PlanEditor["moveRow"];
  readonly onAnchor: (key: string) => void;
  /** The clock field was left with a different time than it was entered with. */
  readonly onClockCommit: (key: string) => void;
  /** The row was just moved into time order: it glows so the eye can follow. */
  readonly isPlaced?: boolean;
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
  impliedMinutes,
  isActive,
  onActivate,
  isReserve,
  upTo,
  downTo,
  onMove,
  onAnchor,
  onClockCommit,
  isPlaced = false,
  onUpdate,
  onToggleLine,
  onToggleFamily,
  onRemove,
  header,
}: RehearsalPlanRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.key });
  const [isExclusionsOpen, setIsExclusionsOpen] = useState(false);

  // The field stays open while it holds focus, so clearing an anchor does
  // not pull the field out from under the keyboard; it collapses on blur.
  const clockId = useId();
  const [clockOpen, setClockOpen] = useState(false);
  const slotButtonRef = useRef<HTMLButtonElement>(null);
  const anchored = Boolean(row.starts_at);
  const derivedClock = !anchored && clock?.derived ? clock.clock : null;

  // Swaps the button for the field and hands it focus in the same task, so a
  // digit typed on the button lands in the field: the browser delivers a
  // keystroke to wherever focus stands once its keydown handlers return. A
  // derived clock is anchored first, and the field enters with that time.
  const openClock = (): void => {
    flushSync(() => {
      if (derivedClock) onAnchor(row.key);
      setClockOpen(true);
    });
    document.getElementById(clockId)?.focus();
  };

  // The time the field held when focus came in from outside it. Hopping from
  // hours to minutes is not an entry, or a half-typed hour would become the
  // baseline. A tapped derived clock is anchored before the field takes
  // focus, so it enters with the time it already had and never moves.
  const clockOnEntry = useRef("");
  const handleClockFocus = (event: React.FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      clockOnEntry.current = row.starts_at ?? "";
    }
    setClockOpen(true);
  };
  const handleClockBlur = (): void => {
    setClockOpen(false);
    if ((row.starts_at ?? "") !== clockOnEntry.current) onClockCommit(row.key);
  };

  // The "×" leaves with the anchor; when it held focus, focus goes to the
  // button that takes the slot over rather than to the page.
  const clearClock = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const hadFocus = document.activeElement === event.currentTarget;
    flushSync(() => onUpdate(row.key, { starts_at: null }));
    if (hadFocus) slotButtonRef.current?.focus();
  };
  const clearLabel = t("rehearsals.plan.row.clear_time", "Usuń stałą godzinę {{clock}}", {
    clock: row.starts_at ?? "",
  });

  const setMinutes = (raw: string): void => {
    const parsed = Number.parseInt(raw, 10);
    onUpdate(row.key, { minutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null });
  };

  const title = reading.title || t("rehearsals.plan.row.untitled", "punkt bez nazwy");
  const isNoteShown = isActive || row.note !== "";
  const isMinutesShown = isActive || row.minutes !== null || impliedMinutes !== null;
  const impliedLabel =
    impliedMinutes !== null
      ? t("rehearsals.plan.row.minutes_implied", "{{minutes}} min wynika z godzin", {
          minutes: impliedMinutes,
        })
      : undefined;
  const hasExclusionsLine = !row.is_break && (reading.hasExclusions || isExclusionsOpen);

  return (
    <li
      ref={setNodeRef}
      data-plan-row={row.key}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10")}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-ethereal-gold/12 transition-opacity duration-700",
          isPlaced ? "opacity-100" : "opacity-0",
        )}
      />
      {/* Whatever the conductor touches in the row makes it the active one —
          a focus for the keyboard, a press for a tap on its bare surface. A
          press inside the "⋯" menu reaches here through the portal too, so
          the row stays active while its menu is open. */}
      <div
        onFocusCapture={() => onActivate(row.key)}
        onPointerDownCapture={() => onActivate(row.key)}
        className={cn(
          "group flex flex-col gap-1 px-4 py-1 transition-colors",
          isDragging
            ? "rounded-control border border-ethereal-gold/45 bg-ethereal-marble shadow-glass-ethereal"
            : row.is_break
              ? "bg-ethereal-parchment/25 hover:bg-ethereal-ink/3"
              : isActive
                ? "bg-ethereal-ink/3"
                : "hover:bg-ethereal-ink/3",
        )}
      >
        {header}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
          {/* The grip is the only drag surface, so the fields stay usable.
              `touch-none` hands a finger on it to the drag, not the page scroll. */}
          <span
            {...attributes}
            {...listeners}
            className={cn(
              "-ml-1.5 flex min-h-8 min-w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-chip text-ethereal-graphite/30 transition-colors",
              "hover:bg-ethereal-gold/10 hover:text-ethereal-gold active:cursor-grabbing",
              "pointer-coarse:min-h-11 pointer-coarse:min-w-9",
            )}
            aria-label={t("rehearsals.plan.row.drag", "Przeciągnij: {{title}}", { title })}
          >
            <GripVertical size={14} aria-hidden="true" />
          </span>

          {/* The slot keeps its width whatever it shows: the column of clocks
              down the list and the exclusions' indent depend on it. */}
          <div className="relative w-24 shrink-0">
            {anchored || clockOpen ? (
              <>
                <div onFocus={handleClockFocus}>
                  <TimeField
                    id={clockId}
                    value={row.starts_at ?? ""}
                    onChange={(time) => onUpdate(row.key, { starts_at: time || null })}
                    onBlur={handleClockBlur}
                    fallback={derivedClock ?? fallbackClock}
                    ariaLabel={t("rehearsals.plan.row.time", "Godzina (opcjonalna)")}
                    className={cn(CLOCK_SLOT_PADDING, FIELD_DENSITY)}
                  />
                </div>
                {anchored && (
                  <button
                    type="button"
                    onClick={clearClock}
                    aria-label={clearLabel}
                    title={clearLabel}
                    className={cn(
                      "absolute inset-y-0 right-0 flex w-7 items-center justify-center rounded-r-control text-ethereal-graphite/45 transition-colors",
                      "hover:text-ethereal-crimson focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                    )}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </>
            ) : (
              <button
                ref={slotButtonRef}
                type="button"
                onClick={openClock}
                onKeyDown={(event) => {
                  if (DIGIT.test(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey) {
                    openClock();
                  }
                }}
                aria-label={
                  derivedClock
                    ? t("rehearsals.plan.row.anchor", "Ustal godzinę {{clock}}", {
                        clock: derivedClock,
                      })
                    : t("rehearsals.plan.row.time", "Godzina (opcjonalna)")
                }
                className={cn(
                  "flex min-h-9 w-full items-center justify-center rounded-control transition-colors pointer-coarse:min-h-11",
                  CLOCK_SLOT_PADDING,
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

          <div className="min-w-0 flex-1 sm:flex-3">
            {row.piece !== null ? (
              <Select
                variant="ghost"
                value={row.piece}
                onValueChange={(pieceId) => onUpdate(row.key, { piece: pieceId })}
                options={programOptions}
                ariaLabel={t("rehearsals.plan.row.piece", "Utwór z programu")}
                className={FIELD_DENSITY}
              />
            ) : (
              <Input
                variant="ghost"
                type="text"
                value={row.label}
                maxLength={120}
                onChange={(event) => onUpdate(row.key, { label: event.target.value })}
                placeholder={t("rehearsals.plan.row.label_placeholder", "np. Rozśpiewanie, ogłoszenia")}
                aria-label={t("rehearsals.plan.row.label", "Nazwa punktu")}
                leftIcon={row.is_break ? <Coffee aria-hidden="true" /> : undefined}
                className={FIELD_DENSITY}
              />
            )}
          </div>

          {/* The note and minutes: beside the title on a desktop line, under it
              on a phone, where the title needs the width more. Hidden, not
              unmounted, while empty and inactive: the desktop column keeps
              its place, and a focus arriving in the row reveals them before
              the next Tab looks for them. */}
          <div
            className={cn(
              "order-last flex basis-full items-center gap-2 sm:order-0 sm:flex-2",
              !isNoteShown && !isMinutesShown && "hidden sm:flex",
            )}
          >
            <div
              className={cn("min-w-0 flex-1", !isNoteShown && "invisible group-hover:visible")}
            >
              <Input
                variant="ghost"
                type="text"
                value={row.note}
                maxLength={200}
                onChange={(event) => onUpdate(row.key, { note: event.target.value })}
                placeholder={t("rehearsals.plan.row.note_placeholder", "Notatka: od t. 40, pierwsze czytanie…")}
                aria-label={t("rehearsals.plan.row.note", "Notatka")}
                className={cn("italic", FIELD_DENSITY)}
              />
            </div>
            <div
              className={cn(
                "flex w-22 shrink-0 items-center gap-1",
                !isMinutesShown && "invisible group-hover:visible",
              )}
            >
              <Input
                variant="ghost"
                type="number"
                inputMode="numeric"
                min={MINUTES_STEP}
                step={MINUTES_STEP}
                value={row.minutes ?? ""}
                onChange={(event) => setMinutes(event.target.value)}
                placeholder={impliedMinutes !== null ? String(impliedMinutes) : "–"}
                title={impliedLabel}
                aria-label={t("rehearsals.plan.row.minutes", "Minuty")}
                aria-description={impliedLabel}
                className={cn("px-1 text-center tabular-nums", FIELD_DENSITY)}
              />
              <Caption color="muted" aria-hidden="true">
                {t("rehearsals.plan.row.minutes_unit", "min")}
              </Caption>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="icon"
                size="icon"
                aria-label={t("rehearsals.plan.row.menu", "Więcej: {{title}}", { title })}
                className="size-9 shrink-0 text-ethereal-graphite/50 pointer-coarse:size-11"
              >
                <MoreHorizontal size={16} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!row.is_break && (
                <DropdownMenuItem
                  icon={<Users size={14} />}
                  onSelect={() => setIsExclusionsOpen(true)}
                >
                  {t("rehearsals.plan.exclude.prompt", "Kogo ten punkt nie potrzebuje")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                icon={<Hourglass size={14} />}
                onSelect={() => onMove(row.key, RESERVE_DIVIDER_KEY)}
              >
                {isReserve
                  ? t("rehearsals.plan.row.from_reserve", "Z powrotem do planu")
                  : t("rehearsals.plan.row.to_reserve", "Do rezerwy")}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<ArrowUp size={14} />}
                disabled={upTo === null}
                onSelect={() => {
                  if (upTo !== null) onMove(row.key, upTo);
                }}
              >
                {t("rehearsals.plan.row.move_up", "Wyżej")}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<ArrowDown size={14} />}
                disabled={downTo === null}
                onSelect={() => {
                  if (downTo !== null) onMove(row.key, downTo);
                }}
              >
                {t("rehearsals.plan.row.move_down", "Niżej")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<Trash2 size={14} />}
                destructive
                onSelect={() => onRemove(row.key)}
              >
                {t("common.actions.delete", "Usuń")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Indented past the grip and the clock (6 + 24 and two gaps, less
            the grip's pull-in, in spacing steps) so the line reads as the
            row's own; on a phone the width is worth more than the alignment. */}
        {hasExclusionsLine && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pb-1 sm:pl-32.5">
            <VoiceExclusionChips
              reading={reading}
              excludesInstrumentalists={row.excludes_instrumentalists}
              isOpen={isExclusionsOpen}
              onOpenChange={setIsExclusionsOpen}
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
    </li>
  );
};
