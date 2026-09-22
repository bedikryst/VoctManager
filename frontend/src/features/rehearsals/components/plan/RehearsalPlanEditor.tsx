/**
 * @file RehearsalPlanEditor.tsx
 * @description The conductor's plan for one saved rehearsal: sortable rows
 * (piece, free label or break; minutes, a clock that follows from them or an
 * anchor, note, exclusions), a sortable "Jeśli starczy czasu" divider with the
 * reserve under it, an "end of rehearsal" line where the minutes run past a
 * timed evening's end, a header on each time block once there are two (its
 * span, and calls set across its rows at once), a strip of who is actually
 * coming, three fills so the evening is never laid out from zero (the whole
 * programme; what the previous rehearsal left undone; a copy of any other
 * plan), an explicit save, and — separately — publishing. A saved plan is a draft the choir does not see
 * until "Opublikuj plan" (or until the evening starts); after that, saves are
 * visible but silent, and "Wyślij zmiany" is the conductor's own act, enabled
 * only when the rows changed since the last send. The conductor edits a dozen
 * times the day before, and each save queuing a notice would teach the choir
 * to ignore them.
 *
 * Mounted twice: as a band in the manager's `RehearsalInspector`, where the
 * save bar docks over the page, and in a `BottomSheet` from the project's
 * Rehearsals tab, where the docked bar would sit under the sheet's scrim —
 * so the sheet asks for `actions="inline"` and the buttons sit at the foot of
 * the editor. No done checkbox here: ticking is the debrief's first step.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanEditor
 */

import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Coffee, GripVertical, Hourglass, ListMusic, ListPlus, Plus, Send } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { toastApiError } from "@/shared/api/errors";
import { formatLocalizedDate, formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import type { Rehearsal } from "@/shared/types";
import { useAnnouncePlan, useRehearsalPlan, useSaveRehearsalPlan } from "../../api/plan.queries";
import { PlanAttendanceStrip } from "./PlanAttendanceStrip";
import { PlanBlockHeader } from "./PlanBlockHeader";
import { RehearsalPlanRow } from "./RehearsalPlanRow";
import { RESERVE_DIVIDER_KEY, usePlanEditor, type PlanDraftRow } from "./usePlanEditor";
import { usePlanEditorData } from "./usePlanEditorData";

interface RehearsalPlanEditorProps {
  readonly rehearsal: Rehearsal;
  /**
   * Where the save controls live. `dock` is the shared `EditorActionBar`
   * over the page; `inline` puts the same two buttons at the editor's foot,
   * for a host that is itself a modal surface.
   */
  readonly actions?: "dock" | "inline";
  /**
   * Whether the draft holds unsaved rows, for a host that can close the
   * editor — a sheet asks before a close would throw the draft away.
   */
  readonly onDirtyChange?: (isDirty: boolean) => void;
  readonly className?: string;
}

/**
 * The reserve's upper edge, dragged like a row. A quiet line while nothing
 * sits under it — present from the first row, so the conductor finds it
 * before he needs it.
 */
const ReserveDivider = ({ hasReserve }: { hasReserve: boolean }): React.JSX.Element => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: RESERVE_DIVIDER_KEY });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10")}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2",
          isDragging &&
            "rounded-control border border-ethereal-gold/45 bg-ethereal-marble shadow-glass-ethereal",
        )}
      >
        <span
          {...attributes}
          {...listeners}
          className={cn(
            "-ml-1.5 flex min-h-8 min-w-6 shrink-0 cursor-grab select-none items-center justify-center rounded-chip text-ethereal-graphite/30 transition-colors",
            "hover:bg-ethereal-gold/10 hover:text-ethereal-gold active:cursor-grabbing",
            "pointer-coarse:min-h-11 pointer-coarse:min-w-9",
          )}
          aria-label={t("rehearsals.plan.reserve.drag", "Przesuń granicę: jeśli starczy czasu")}
        >
          <GripVertical size={14} aria-hidden="true" />
        </span>
        <Hourglass
          size={12}
          className={hasReserve ? "text-ethereal-gold" : "text-ethereal-graphite/40"}
          aria-hidden="true"
        />
        <Eyebrow color={hasReserve ? "gold" : "muted"}>
          {t("rehearsals.plan.reserve.title", "Jeśli starczy czasu")}
        </Eyebrow>
        <span
          aria-hidden="true"
          className={cn(
            "h-px flex-1",
            hasReserve ? "bg-ethereal-gold/40" : "bg-ethereal-graphite/15",
          )}
        />
      </div>
    </li>
  );
};

/**
 * Where the running time passes the rehearsal's end: the rows under it are
 * what the evening cannot fit. Not sortable and not a warning in words —
 * the line and the ordering say it, next to the reserve divider.
 */
const EndOfRehearsalLine = ({ clock }: { clock: string }): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-2 px-4 py-2">
      <Eyebrow color="muted" className="tabular-nums">
        {t("rehearsals.plan.end_line", "Koniec próby · {{clock}}", { clock })}
      </Eyebrow>
      <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-ethereal-graphite/30" />
    </li>
  );
};

export const RehearsalPlanEditor = ({
  rehearsal,
  actions = "dock",
  onDirtyChange,
  className,
}: RehearsalPlanEditorProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const rehearsalId = String(rehearsal.id);
  const planQuery = useRehearsalPlan(rehearsalId);
  const data = usePlanEditorData(String(rehearsal.project));
  const editor = usePlanEditor(rehearsal, planQuery.data, data);
  const save = useSaveRehearsalPlan(rehearsalId);
  const announce = useAnnouncePlan(rehearsalId);

  useEffect(() => {
    onDirtyChange?.(editor.isDirty);
  }, [editor.isDirty, onDirtyChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (over && active.id !== over.id) editor.moveRow(String(active.id), String(over.id));
  };

  /* ── The publication's state ─────────────────────────────────────────── */
  const announcedAt = planQuery.data?.plan_announced_at ?? null;
  const changedAt = planQuery.data?.plan_changed_at ?? null;
  const savedRows = planQuery.data?.rows ?? [];
  const isPublished = announcedAt !== null;
  // Any row created, edited, moved or deleted after the send — a deletion
  // leaves no surviving row to carry a newer stamp, so the rehearsal does.
  const changedSinceSend =
    isPublished &&
    changedAt !== null &&
    new Date(changedAt).getTime() > new Date(announcedAt).getTime();
  // A plan announced after the downbeat reaches phones already in the room —
  // the server refuses it, and so does the button. From the downbeat on the
  // plan is public anyway: it is the evening's record.
  const hasStarted = new Date(rehearsal.date_time).getTime() <= Date.now();
  const isPublic = isPublished || hasStarted;
  const announcedLabel = announcedAt
    ? formatLocalizedDateTime(
        announcedAt,
        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
        i18n.language,
        rehearsal.timezone,
      )
    : null;

  const handleSave = async (): Promise<void> => {
    // The server refuses the whole list for one nameless free row; catching it
    // here keeps the refusal in the conductor's language and next to the row.
    if (editor.rows.some((row) => row.piece === null && row.label.trim() === "")) {
      toast.warning(
        t("rehearsals.plan.toast.untitled", "Nadaj nazwę każdemu punktowi bez utworu."),
      );
      return;
    }
    try {
      await save.mutateAsync({ rows: editor.toDTO() });
      toast.success(
        isPublic
          ? t(
              "rehearsals.plan.toast.saved_public",
              "Zapisano. Chór widzi zmiany, ale nie dostał o nich znać.",
            )
          : t("rehearsals.plan.toast.saved_draft", "Szkic zapisany. Chór go nie widzi."),
      );
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t("rehearsals.plan.toast.save_error", "Nie udało się zapisać planu."),
      });
    }
  };

  const handleAnnounce = async (): Promise<void> => {
    try {
      await announce.mutateAsync();
      toast.success(
        isPublished
          ? t("rehearsals.plan.toast.changes_sent", "Zmiany wysłane do wezwanych.")
          : t("rehearsals.plan.toast.published", "Plan opublikowany i wysłany do wezwanych."),
      );
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t("rehearsals.plan.toast.announce_error", "Nie udało się wysłać planu."),
      });
    }
  };

  const fallbackClock = useMemo(
    () => formatInTimeZone(rehearsal.date_time, rehearsal.timezone, "HH:mm"),
    [rehearsal.date_time, rehearsal.timezone],
  );

  /* ── Pieces still to add: the programme minus what the plan already has ── */
  const presentPieces = useMemo(
    () => new Set(editor.rows.map((row) => row.piece).filter((piece) => piece !== null)),
    [editor.rows],
  );
  const addOptions = useMemo(
    () => editor.programOptions.filter((option) => !presentPieces.has(option.value)),
    [editor.programOptions, presentPieces],
  );

  /* ── The sortable sequence: the rows with the divider in its place ────── */
  const sortableKeys = useMemo(() => {
    const keys = editor.rows.map((row) => row.key);
    keys.splice(editor.reserveStart, 0, RESERVE_DIVIDER_KEY);
    return keys;
  }, [editor.rows, editor.reserveStart]);
  const rowsByKey = useMemo(() => {
    const map = new Map<string, PlanDraftRow>();
    for (const row of editor.rows) map.set(row.key, row);
    return map;
  }, [editor.rows]);
  const hasReserve = editor.reserveStart < editor.rows.length;

  const sourceLabel = (dateTime: string, timezone: string, focus: string): string => {
    const day = formatLocalizedDate(dateTime, { day: "numeric", month: "short" }, undefined, timezone);
    return focus ? `${day} · ${focus}` : day;
  };

  const isBusy = save.isPending || announce.isPending;
  // The rows arrive as a draft the conductor may still be laying out; until
  // the server's plan is in hand, every way of adding to it is shut, or a row
  // added first would be the only row the draft has.
  const isOpening = planQuery.isLoading || data.isLoading;
  const canAnnounce =
    savedRows.length > 0 &&
    !editor.isDirty &&
    !isBusy &&
    !hasStarted &&
    (!isPublished || changedSinceSend);

  return (
    <section className={cn("flex flex-col", className)}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3">
        <div className="flex items-center gap-2">
          <ListMusic size={12} className="text-ethereal-gold/70" aria-hidden="true" />
          <Eyebrow as="h3" color="graphite">
            {t("rehearsals.plan.title", "Plan próby")}
          </Eyebrow>
          {editor.rows.length > 0 && (
            <Caption color="muted" className="tabular-nums">
              {editor.rows.length}
            </Caption>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isOpening}
                leftIcon={<ListPlus size={14} aria-hidden="true" />}
              >
                {t("rehearsals.plan.fill.menu", "Wypełnij")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={editor.fillProgram}
                disabled={addOptions.length === 0}
              >
                {t("rehearsals.plan.fill.program", "Dodaj cały program")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={editor.fillCarryOver}
                disabled={editor.carryOver === null}
                description={
                  editor.carryOver
                    ? sourceLabel(
                        editor.carryOver.source.dateTime,
                        editor.carryOver.source.timezone,
                        editor.carryOver.source.focus,
                      )
                    : undefined
                }
              >
                {editor.carryOver
                  ? t("rehearsals.plan.fill.carry_over", "Dodaj niezrobione z ostatniej próby ({{count}})", {
                      count: editor.carryOver.undone,
                    })
                  : t("rehearsals.plan.fill.carry_over_none", "Ostatnia próba nie zostawiła nic niezrobionego")}
              </DropdownMenuItem>
              {editor.sources.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>
                    {t("rehearsals.plan.fill.copy_from", "Skopiuj plan z…")}
                  </DropdownMenuLabel>
                  {editor.sources.map((source) => (
                    <DropdownMenuItem
                      key={source.rehearsalId}
                      onSelect={() => editor.copyFrom(source.rehearsalId)}
                      description={t("rehearsals.plan.fill.rows", "{{count}} punktów", {
                        count: source.rowCount,
                      })}
                    >
                      {sourceLabel(source.dateTime, source.timezone, source.focus)}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAnnounce}
            disabled={!canAnnounce}
            isLoading={announce.isPending}
            leftIcon={!announce.isPending ? <Send size={14} aria-hidden="true" /> : undefined}
          >
            {isPublished
              ? t("rehearsals.plan.send_changes", "Wyślij zmiany")
              : t("rehearsals.plan.publish", "Opublikuj plan")}
          </Button>
        </div>
      </div>

      {/* Who can see it, and whether the rows moved since the last send. A
          caption, never a prompt: the decision to send again is the
          conductor's. */}
      {announcedLabel ? (
        <div className="px-5 pb-2">
          <Caption color={changedSinceSend ? "gold" : "muted"}>
            {changedSinceSend
              ? t("rehearsals.plan.announced_changed", "Opublikowany · wysłano {{when}} · zmieniony po wysłaniu", {
                  when: announcedLabel,
                })
              : t("rehearsals.plan.announced_at", "Opublikowany · wysłano {{when}}", {
                  when: announcedLabel,
                })}
          </Caption>
        </div>
      ) : (
        savedRows.length > 0 &&
        !hasStarted && (
          <div className="px-5 pb-2">
            <Caption color="muted">
              {t("rehearsals.plan.draft", "Szkic — chór go nie widzi")}
            </Caption>
          </div>
        )
      )}

      {!isOpening && data.attendances && (
        <PlanAttendanceStrip
          rehearsal={rehearsal}
          participations={data.participations}
          attendances={data.attendances}
        />
      )}

      {/* ── Rows ────────────────────────────────────────────────────────── */}
      {isOpening ? (
        <EtherealLoader
          fullHeight={false}
          className="py-8"
          message={t("rehearsals.plan.loading", "Otwieram plan…")}
        />
      ) : editor.rows.length === 0 ? (
        <StatePanel
          variant="inline"
          className="px-5 py-8"
          icon={<ListMusic size={22} aria-hidden="true" />}
          title={t("rehearsals.plan.empty.title", "Bez planu")}
          description={t(
            "rehearsals.plan.empty.desc",
            "Ułóż utwory w kolejności ćwiczenia; minuty, godziny i wykluczenia są opcjonalne.",
          )}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={editor.fillProgram}
              disabled={addOptions.length === 0}
              leftIcon={<ListPlus size={14} aria-hidden="true" />}
            >
              {t("rehearsals.plan.fill.program", "Dodaj cały program")}
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableKeys} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-hairline border-y border-hairline">
              {sortableKeys.map((key) => {
                if (key === RESERVE_DIVIDER_KEY) {
                  return <ReserveDivider key={key} hasReserve={hasReserve} />;
                }
                const row = rowsByKey.get(key);
                const reading = editor.readings.get(key);
                if (!row || !reading) return null;
                const block = editor.blockHeaders.get(key);
                return (
                  <React.Fragment key={key}>
                    {key === editor.endLineBefore && editor.endClock && (
                      <EndOfRehearsalLine clock={editor.endClock} />
                    )}
                    <RehearsalPlanRow
                      row={row}
                      reading={reading}
                      calledTotal={editor.calledTotal}
                      programOptions={editor.programOptions}
                      fallbackClock={fallbackClock}
                      clock={editor.clocks.get(key)}
                      onAnchor={editor.anchorRow}
                      onUpdate={editor.updateRow}
                      onToggleLine={editor.toggleLine}
                      onToggleFamily={editor.toggleFamily}
                      onRemove={editor.removeRow}
                      header={
                        block && (
                          <PlanBlockHeader
                            block={block}
                            onSetFamily={editor.setFamilyOnRows}
                            onSetPlayers={editor.setPlayersOnRows}
                          />
                        )
                      }
                    />
                  </React.Fragment>
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* ── Add ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <Select
            variant="ghost"
            size="sm"
            value=""
            onValueChange={(pieceId) => {
              if (pieceId) editor.addPieceRow(pieceId);
            }}
            options={addOptions}
            disabled={isOpening || addOptions.length === 0}
            leftIcon={<Plus size={14} aria-hidden="true" />}
            placeholder={
              addOptions.length === 0
                ? t("rehearsals.plan.add.piece_all", "Cały program już w planie")
                : t("rehearsals.plan.add.piece", "Dodaj utwór z programu…")
            }
            ariaLabel={t("rehearsals.plan.add.piece", "Dodaj utwór z programu…")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={editor.addFreeRow}
            disabled={isOpening}
            leftIcon={<Plus size={14} aria-hidden="true" />}
          >
            {t("rehearsals.plan.add.free", "Punkt bez utworu")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.addBreakRow(t("rehearsals.plan.row.break_label", "Przerwa"))}
            disabled={isOpening}
            leftIcon={<Coffee size={14} aria-hidden="true" />}
          >
            {t("rehearsals.plan.add.break", "Dodaj przerwę")}
          </Button>
        </div>
      </div>

      {/* ── Save ────────────────────────────────────────────────────────── */}
      {actions === "dock" ? (
        <EditorActionBar
          isOpen={editor.isDirty}
          description={t("rehearsals.plan.save.description", "Zmieniono plan próby.")}
          onCancel={editor.reset}
          onConfirm={handleSave}
          isLoading={save.isPending}
        />
      ) : (
        editor.isDirty && (
          <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3">
            <Button variant="ghost" size="sm" onClick={editor.reset} disabled={save.isPending}>
              {t("common.actions.cancel", "Anuluj")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={save.isPending}
              disabled={save.isPending}
            >
              {t("common.actions.save", "Zapisz")}
            </Button>
          </div>
        )
      )}
    </section>
  );
};
