/**
 * @file RehearsalPlanEditor.tsx
 * @description The conductor's plan for one saved rehearsal: sortable rows
 * (piece or free label, optional clock, note, exclusions), three fills so the
 * evening is never laid out from zero (the whole programme; what the previous
 * rehearsal left undone; a copy of any other plan), an explicit save, and —
 * separately — "Wyślij plan". Saving is silent: the conductor edits a dozen
 * times the day before, and each save queuing a notice would teach the choir
 * to ignore them. The send is his own act, stamped, and a caption says when
 * the rows moved after it — a caption, never an automatic send.
 *
 * Mounted twice: as a band in the manager's `RehearsalInspector`, where the
 * save bar docks over the page, and in a `BottomSheet` from the project's
 * Rehearsals tab, where the docked bar would sit under the sheet's scrim —
 * so the sheet asks for `actions="inline"` and the buttons sit at the foot of
 * the editor. No done checkbox here: ticking is the debrief's first step.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanEditor
 */

import React, { useMemo } from "react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ListMusic, ListPlus, Plus, Send } from "lucide-react";

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
import { RehearsalPlanRow } from "./RehearsalPlanRow";
import { usePlanEditor } from "./usePlanEditor";
import { usePlanEditorData } from "./usePlanEditorData";

interface RehearsalPlanEditorProps {
  readonly rehearsal: Rehearsal;
  /**
   * Where the save controls live. `dock` is the shared `EditorActionBar`
   * over the page; `inline` puts the same two buttons at the editor's foot,
   * for a host that is itself a modal surface.
   */
  readonly actions?: "dock" | "inline";
  readonly className?: string;
}

export const RehearsalPlanEditor = ({
  rehearsal,
  actions = "dock",
  className,
}: RehearsalPlanEditorProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const rehearsalId = String(rehearsal.id);
  const planQuery = useRehearsalPlan(rehearsalId);
  const data = usePlanEditorData(String(rehearsal.project));
  const editor = usePlanEditor(rehearsal, planQuery.data, data);
  const save = useSaveRehearsalPlan(rehearsalId);
  const announce = useAnnouncePlan(rehearsalId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (over && active.id !== over.id) editor.moveRow(String(active.id), String(over.id));
  };

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
      toast.success(t("rehearsals.plan.toast.saved", "Plan zapisany. Chór jeszcze o nim nie wie."));
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t("rehearsals.plan.toast.save_error", "Nie udało się zapisać planu."),
      });
    }
  };

  const handleAnnounce = async (): Promise<void> => {
    try {
      await announce.mutateAsync();
      toast.success(t("rehearsals.plan.toast.announced", "Plan wysłany do wezwanych."));
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

  /* ── The announcement's state ────────────────────────────────────────── */
  const announcedAt = planQuery.data?.plan_announced_at ?? null;
  const savedRows = planQuery.data?.rows ?? [];
  const changedSinceSend =
    announcedAt !== null &&
    savedRows.some((row) => new Date(row.updated_at).getTime() > new Date(announcedAt).getTime());
  const announcedLabel = announcedAt
    ? formatLocalizedDateTime(
        announcedAt,
        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
        i18n.language,
        rehearsal.timezone,
      )
    : null;

  /* ── Pieces still to add: the programme minus what the plan already has ── */
  const presentPieces = useMemo(
    () => new Set(editor.rows.map((row) => row.piece).filter((piece) => piece !== null)),
    [editor.rows],
  );
  const addOptions = useMemo(
    () => editor.programOptions.filter((option) => !presentPieces.has(option.value)),
    [editor.programOptions, presentPieces],
  );

  const sourceLabel = (dateTime: string, timezone: string, focus: string): string => {
    const day = formatLocalizedDate(dateTime, { day: "numeric", month: "short" }, undefined, timezone);
    return focus ? `${day} · ${focus}` : day;
  };

  const isBusy = save.isPending || announce.isPending;
  // The rows arrive as a draft the conductor may still be laying out; until
  // the server's plan is in hand, every way of adding to it is shut, or a row
  // added first would be the only row the draft has.
  const isOpening = planQuery.isLoading || data.isLoading;
  // A plan announced after the downbeat reaches phones already in the room —
  // the server refuses it, and so does the button.
  const hasStarted = new Date(rehearsal.date_time).getTime() <= Date.now();
  const canAnnounce = savedRows.length > 0 && !editor.isDirty && !isBusy && !hasStarted;

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
            {t("rehearsals.plan.announce", "Wyślij plan")}
          </Button>
        </div>
      </div>

      {/* Sent when, and whether the rows moved since. A caption, never a
          prompt: the decision to send again is the conductor's. */}
      {announcedLabel && (
        <div className="px-5 pb-2">
          <Caption color={changedSinceSend ? "gold" : "muted"}>
            {changedSinceSend
              ? t("rehearsals.plan.announced_changed", "Wysłano {{when}} · zmieniony po wysłaniu", {
                  when: announcedLabel,
                })
              : t("rehearsals.plan.announced_at", "Wysłano {{when}}", { when: announcedLabel })}
          </Caption>
        </div>
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
            "Ułóż utwory w kolejności ćwiczenia; godzina i wykluczenia są opcjonalne.",
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
          <SortableContext
            items={editor.rows.map((row) => row.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y divide-hairline border-y border-hairline">
              {editor.rows.map((row) => {
                const reading = editor.readings.get(row.key);
                if (!reading) return null;
                return (
                  <RehearsalPlanRow
                    key={row.key}
                    row={row}
                    reading={reading}
                    calledTotal={editor.calledTotal}
                    programOptions={editor.programOptions}
                    fallbackClock={fallbackClock}
                    onUpdate={editor.updateRow}
                    onToggleLine={editor.toggleLine}
                    onToggleFamily={editor.toggleFamily}
                    onRemove={editor.removeRow}
                  />
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
        <Button
          variant="ghost"
          size="sm"
          onClick={editor.addFreeRow}
          disabled={isOpening}
          leftIcon={<Plus size={14} aria-hidden="true" />}
        >
          {t("rehearsals.plan.add.free", "Punkt bez utworu")}
        </Button>
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
