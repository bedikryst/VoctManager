/**
 * @file RehearsalPlanEditor.tsx
 * @description The conductor's plan for one saved rehearsal: sortable rows
 * (piece, free label or break; minutes, a clock that follows from them or an
 * anchor, note, exclusions — a typed anchor takes its row into time order, and
 * the list follows it there), a sortable "Jeśli starczy czasu" divider with the
 * reserve under it, an "end of rehearsal" line where the minutes run past a
 * timed evening's end, a header on each time block once there are two (its
 * span, and calls set across its rows at once), a strip of who is actually
 * coming, the planned minutes against the evening's length (lengths the
 * clocks imply included), three fills so the evening is never laid out from
 * zero (the whole programme; what the previous rehearsal left undone; a copy
 * of any other plan), and an explicit save. Writing costs what text costs:
 * the add tray holds a chip per programme piece not yet planned (one tap
 * appends it above the reserve), a free point, a break, and "Wpisz listą" —
 * the plan typed as lines and read into rows (`PlanTextEntry`), offered
 * filled from the rehearsal's topic when the topic is really a list, which
 * is where plans were written before. A saved plan is a draft the choir does not see until it is sent (or
 * until the evening starts); after that, saves are visible but silent. The
 * conductor edits a dozen times the day before, and each save sending a
 * notice would teach the choir to ignore them — so sending is its own act,
 * and one act: an unsaved draft offers "Zapisz" and "Zapisz i wyślij" side by
 * side, and the header's "Wyślij" appears only for a saved plan whose rows
 * the cast has not been sent yet (`usePlanPublication`, shared with the read
 * view).
 *
 * Mounted as a band in `RehearsalInspector` — the manager's workspace, and the
 * lead sheet of a planner the server admits (`access="planner"`, which reads
 * the project through the evening rather than the hub's lists) — where the
 * save bar docks over the page and the band is the edit face of the plan's
 * read view (`onClose`): a successful save or send, and the bar's "Anuluj",
 * hand the band back to it, and "Zamknij" asks first while the draft is
 * dirty. And in a `BottomSheet` from the project's Rehearsals tab, where the
 * docked bar would sit under the sheet's scrim — so the sheet asks for
 * `actions="inline"` and hands over its own footer for the buttons. No done
 * checkbox here: ticking is the debrief's step, taken on the read view.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/RehearsalPlanEditor
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { useReducedMotion } from "framer-motion";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Coffee,
  GripVertical,
  Hourglass,
  ListMusic,
  ListOrdered,
  ListPlus,
  Plus,
  Send,
  X,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { toastApiError } from "@/shared/api/errors";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
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
import { useRehearsalPlan, useSaveRehearsalPlan } from "../../api/plan.queries";
import { planTextOfFocus, type PlanTextPiece, type PlanTextRow } from "../../lib/planText";
import { PlanAttendanceStrip } from "./PlanAttendanceStrip";
import { PlanBlockHeader } from "./PlanBlockHeader";
import { PlanBudget } from "./PlanBudget";
import { PlanTextEntry } from "./PlanTextEntry";
import { RehearsalPlanRow } from "./RehearsalPlanRow";
import { RESERVE_DIVIDER_KEY, usePlanEditor, type PlanDraftRow } from "./usePlanEditor";
import { usePlanEditorData, type PlanEditorAccess } from "./usePlanEditorData";
import { usePlanPublication } from "./usePlanPublication";

interface RehearsalPlanEditorProps {
  readonly rehearsal: Rehearsal;
  /**
   * Who is laying the evening out. `manager` (the default) reads the hub's
   * lists; `planner` reads the evening's own projection.
   */
  readonly access?: PlanEditorAccess;
  /**
   * Where the save controls live. `dock` is the shared `EditorActionBar`
   * over the page; `inline` renders the same buttons into `actionsSlot`, for
   * a host that is itself a modal surface.
   */
  readonly actions?: "dock" | "inline";
  /** The host's own footer for `actions="inline"`; nothing renders until it mounts. */
  readonly actionsSlot?: HTMLElement | null;
  /**
   * Whether the draft holds unsaved rows, for a host that can take the
   * editor away — a sheet asks before a close, the workspace before another
   * evening — and that shows the inline actions only while there is
   * something to save. Reports false when the editor unmounts.
   */
  readonly onDirtyChange?: (isDirty: boolean) => void;
  /**
   * Hands the band back to the plan's read view. Present → the header offers
   * "Zamknij" (asking first while the draft is dirty), and a successful save
   * or send, or "Anuluj" in the save bar, closes the editor too.
   */
  readonly onClose?: () => void;
  readonly className?: string;
}

/** Where a row of a sortable sequence stands, for the "⋯" menu's moves. */
interface RowPlace {
  readonly isReserve: boolean;
  readonly upTo: string | null;
  readonly downTo: string | null;
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
            "-ml-1.5 flex min-h-8 min-w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-chip text-ethereal-graphite/30 transition-colors",
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

/** How long a row moved into time order glows. */
const PLACED_GLOW_MS = 1600;

/** A bare button around a `Badge`, which draws the chip. */
const CHIP_BUTTON = cn(
  "flex items-center rounded-chip pointer-coarse:min-h-11",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
);

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
  access = "manager",
  actions = "dock",
  actionsSlot = null,
  onDirtyChange,
  onClose,
  className,
}: RehearsalPlanEditorProps): React.JSX.Element => {
  const { t } = useTranslation();
  const rehearsalId = String(rehearsal.id);
  const planQuery = useRehearsalPlan(rehearsalId);
  const data = usePlanEditorData(rehearsal, access);
  const editor = usePlanEditor(rehearsal, planQuery.data, data);
  const save = useSaveRehearsalPlan(rehearsalId);
  const publication = usePlanPublication(rehearsal, planQuery.data);

  useEffect(() => {
    onDirtyChange?.(editor.isDirty);
  }, [editor.isDirty, onDirtyChange]);
  // A draft that leaves with the editor is nothing the host still guards.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (over && active.id !== over.id) editor.moveRow(String(active.id), String(over.id));
  };

  /* ── A row moved into time order ─────────────────────────────────────── */
  // The row leaves the place the conductor was looking at, so the list
  // follows it: scrolled into view, a short glow, and the move said aloud
  // for a screen reader.
  const listRef = useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const [placed, setPlaced] = useState<{ key: string; message: string } | null>(null);

  const handleClockCommit = (key: string): void => {
    const row = editor.rows.find((candidate) => candidate.key === key);
    if (!row?.starts_at || !editor.placeByClock(key)) return;
    const title =
      editor.readings.get(key)?.title || t("rehearsals.plan.row.untitled", "punkt bez nazwy");
    setPlaced({
      key,
      message: t("rehearsals.plan.row.placed", "Ustawiono według godziny {{clock}}: {{title}}", {
        clock: row.starts_at,
        title,
      }),
    });
  };

  useEffect(() => {
    if (!placed) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-plan-row="${placed.key}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    const timer = window.setTimeout(() => setPlaced(null), PLACED_GLOW_MS);
    return () => window.clearTimeout(timer);
  }, [placed, reduceMotion]);

  /** Writes the draft; false when it was not written (the refusal is already said). */
  const persist = async (): Promise<boolean> => {
    // The server refuses the whole list for one nameless free row; catching it
    // here keeps the refusal in the conductor's language and next to the row.
    if (editor.rows.some((row) => row.piece === null && row.label.trim() === "")) {
      toast.warning(
        t("rehearsals.plan.toast.untitled", "Nadaj nazwę każdemu punktowi bez utworu."),
      );
      return false;
    }
    try {
      await save.mutateAsync({ rows: editor.toDTO() });
      return true;
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t("rehearsals.plan.toast.save_error", "Nie udało się zapisać planu."),
      });
      return false;
    }
  };

  // A save that landed hands the band back to the read view, which shows it.
  const handleSave = async (): Promise<void> => {
    if (!(await persist())) return;
    toast.success(
      publication.isPublic
        ? t(
            "rehearsals.plan.toast.saved_public",
            "Zapisano. Chór widzi zmiany, ale nie dostał o nich znać.",
          )
        : t("rehearsals.plan.toast.saved_draft", "Szkic zapisany. Chór go nie widzi."),
    );
    onClose?.();
  };

  const handleAnnounce = async (): Promise<void> => {
    if (await publication.send()) onClose?.();
  };

  // One act: the save, then the send of what was saved. A refused save sends
  // nothing and stays in the editor; a refused send leaves the save standing,
  // its toast says so, and the read view offers the send again.
  const [isSavingToSend, setIsSavingToSend] = useState(false);
  const handleSaveAndSend = async (): Promise<void> => {
    const wasPublished = publication.isPublished;
    setIsSavingToSend(true);
    let saved = false;
    try {
      saved = await persist();
      if (saved) await publication.send(wasPublished);
    } finally {
      setIsSavingToSend(false);
    }
    if (saved) onClose?.();
  };

  // "Anuluj" drops the draft; in the workspace it also ends the edit.
  const handleCancel = (): void => {
    editor.reset();
    onClose?.();
  };

  // Leaving with unsaved rows asks through the same words as every other
  // way out of a dirty draft; a clean one just goes.
  const [isClosePromptOpen, setIsClosePromptOpen] = useState(false);
  const handleClose = (): void => {
    if (editor.isDirty) setIsClosePromptOpen(true);
    else onClose?.();
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

  /* ── The plan typed as lines ─────────────────────────────────────────── */
  const textProgram = useMemo<PlanTextPiece[]>(
    () => editor.programOptions.map((option) => ({ id: option.value, title: option.label })),
    [editor.programOptions],
  );
  const focusText = useMemo(() => planTextOfFocus(rehearsal.focus ?? ""), [rehearsal.focus]);
  // Null while closed; else the text the entry opens with.
  const [textEntry, setTextEntry] = useState<string | null>(null);
  const handleTextInsert = (parsed: readonly PlanTextRow[]): void => {
    editor.addTextRows(parsed);
    setTextEntry(null);
  };

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
  // "Wyżej" / "Niżej" trade places on the row's own side of the divider;
  // crossing it is the menu's reserve move, never a side effect of "Niżej".
  const rowPlaces = useMemo(() => {
    const map = new Map<string, RowPlace>();
    editor.rows.forEach((row, index) => {
      const isReserve = index >= editor.reserveStart;
      const first = isReserve ? editor.reserveStart : 0;
      const last = isReserve ? editor.rows.length - 1 : editor.reserveStart - 1;
      map.set(row.key, {
        isReserve,
        upTo: index > first ? (editor.rows[index - 1]?.key ?? null) : null,
        downTo: index < last ? (editor.rows[index + 1]?.key ?? null) : null,
      });
    });
    return map;
  }, [editor.rows, editor.reserveStart]);

  // The row whose empty note and minutes show. Moves with focus or a press,
  // and stays put when the conductor clicks away from the list.
  const [activeKey, setActiveKey] = useState<string | null>(null);

  /* ── What a screen reader hears while a row is dragged ───────────────── */
  const sortableTitle = (id: UniqueIdentifier): string =>
    id === RESERVE_DIVIDER_KEY
      ? t("rehearsals.plan.dnd.divider", "granica „Jeśli starczy czasu”")
      : editor.readings.get(String(id))?.title ||
        t("rehearsals.plan.row.untitled", "punkt bez nazwy");
  const sortablePlace = (id: UniqueIdentifier): { position: number; total: number } => ({
    position: sortableKeys.indexOf(String(id)) + 1,
    total: sortableKeys.length,
  });
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("rehearsals.plan.dnd.picked", "Podniesiono: {{title}}. Pozycja {{position}} z {{total}}.", {
        title: sortableTitle(active.id),
        ...sortablePlace(active.id),
      }),
    onDragOver: ({ active, over }) =>
      over
        ? t("rehearsals.plan.dnd.over", "{{title}}: pozycja {{position}} z {{total}}.", {
            title: sortableTitle(active.id),
            ...sortablePlace(over.id),
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("rehearsals.plan.dnd.dropped", "Odłożono: {{title}}, pozycja {{position}} z {{total}}.", {
            title: sortableTitle(active.id),
            ...sortablePlace(over.id),
          })
        : t("rehearsals.plan.dnd.cancelled", "Anulowano przenoszenie: {{title}} wraca na miejsce.", {
            title: sortableTitle(active.id),
          }),
    onDragCancel: ({ active }) =>
      t("rehearsals.plan.dnd.cancelled", "Anulowano przenoszenie: {{title}} wraca na miejsce.", {
        title: sortableTitle(active.id),
      }),
  };
  const screenReaderInstructions = {
    draggable: t(
      "rehearsals.plan.dnd.instructions",
      "Aby podnieść punkt, naciśnij spację albo Enter. Strzałki w górę i w dół przesuwają go po liście. Spacja albo Enter odkłada go w nowym miejscu, Escape anuluje.",
    ),
  };

  const sourceLabel = (dateTime: string, timezone: string, focus: string): string => {
    const day = formatLocalizedDate(dateTime, { day: "numeric", month: "short" }, undefined, timezone);
    return focus ? `${day} · ${focus}` : day;
  };

  const isBusy = save.isPending || publication.isSending || isSavingToSend;
  // The rows arrive as a draft the conductor may still be laying out; until
  // the server's plan is in hand, every way of adding to it is shut, or a row
  // added first would be the only row the draft has. A project read that
  // failed shuts them too: an empty programme it would show is not the
  // project's.
  const isOpening = planQuery.isLoading || data.isLoading;
  const isShut = isOpening || data.isLoadError;
  // The header's send is for a saved plan the cast has not been sent as it
  // stands — and absent, not greyed out, otherwise: an unsaved draft sends
  // from its save bar, and a disabled button that cannot say why is the
  // dead end this replaces. It stays away during "Zapisz i wyślij" too,
  // whose save would otherwise flash it up for the length of the send.
  const showSend = publication.canSend && !editor.isDirty && !isSavingToSend;
  // The send that "Zapisz i wyślij" would follow its save with: something to
  // send, before the downbeat.
  const canSaveAndSend = editor.rows.length > 0 && !publication.hasStarted;
  const saveAndSendLabel = publication.isPublished
    ? t("rehearsals.plan.save_and_send_changes", "Zapisz i wyślij zmiany")
    : t("rehearsals.plan.save_and_send", "Zapisz i wyślij");

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
          <PlanBudget planned={editor.planned} length={rehearsal.duration_minutes ?? null} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isShut}
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

          {showSend && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnnounce}
              disabled={isBusy}
              isLoading={publication.isSending}
              leftIcon={
                !publication.isSending ? <Send size={14} aria-hidden="true" /> : undefined
              }
            >
              {publication.sendLabel}
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isBusy}
              leftIcon={<X size={14} aria-hidden="true" />}
            >
              {t("common.actions.close", "Zamknij")}
            </Button>
          )}
        </div>
      </div>

      {publication.caption && (
        <div className="px-5 pb-2">
          <Caption color={publication.caption.attention ? "gold" : "muted"}>
            {publication.caption.text}
          </Caption>
        </div>
      )}

      {!isShut && data.attendances && (
        <PlanAttendanceStrip
          rehearsal={rehearsal}
          participations={data.participations}
          attendances={data.attendances}
        />
      )}

      {/* ── Rows ────────────────────────────────────────────────────────── */}
      <p className="sr-only" aria-live="polite">
        {placed?.message ?? ""}
      </p>
      {isOpening ? (
        <EtherealLoader
          fullHeight={false}
          className="py-8"
          message={t("rehearsals.plan.loading", "Otwieram plan…")}
        />
      ) : data.isLoadError ? (
        <StatePanel
          variant="inline"
          tone="warning"
          className="px-5 py-8"
          icon={<ListMusic size={22} aria-hidden="true" />}
          title={t("rehearsals.plan.load_error.title", "Nie udało się otworzyć planu")}
          description={t(
            "rehearsals.plan.load_error.desc",
            "Nie wczytały się program ani obsada projektu, więc nie da się teraz układać planu.",
          )}
          actions={
            <Button variant="outline" size="sm" onClick={data.retry}>
              {t("common.actions.retry", "Spróbuj ponownie")}
            </Button>
          }
        />
      ) : editor.rows.length === 0 ? (
        textEntry === null && (
          <StatePanel
            variant="inline"
            className="px-5 py-8"
            icon={<ListMusic size={22} aria-hidden="true" />}
            title={t("rehearsals.plan.empty.title", "Bez planu")}
            description={
              focusText !== null
                ? t(
                    "rehearsals.plan.empty.desc_focus",
                    "W temacie próby jest już lista. Można z niej ułożyć plan i poprawić to, czego nie rozpozna.",
                  )
                : t(
                    "rehearsals.plan.empty.desc",
                    "Ułóż utwory w kolejności ćwiczenia; minuty, godziny i wykluczenia są opcjonalne.",
                  )
            }
            actions={
              <>
                {focusText !== null && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTextEntry(focusText)}
                    leftIcon={<ListOrdered size={14} aria-hidden="true" />}
                  >
                    {t("rehearsals.plan.text.from_focus", "Ułóż plan z tematu próby")}
                  </Button>
                )}
                <Button
                  variant={focusText !== null ? "ghost" : "outline"}
                  size="sm"
                  onClick={editor.fillProgram}
                  disabled={addOptions.length === 0}
                  leftIcon={<ListPlus size={14} aria-hidden="true" />}
                >
                  {t("rehearsals.plan.fill.program", "Dodaj cały program")}
                </Button>
              </>
            }
          />
        )
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{ announcements, screenReaderInstructions }}
        >
          <SortableContext items={sortableKeys} strategy={verticalListSortingStrategy}>
            <ul ref={listRef} className="divide-y divide-hairline border-y border-hairline">
              {sortableKeys.map((key) => {
                if (key === RESERVE_DIVIDER_KEY) {
                  return <ReserveDivider key={key} hasReserve={hasReserve} />;
                }
                const row = rowsByKey.get(key);
                const reading = editor.readings.get(key);
                const place = rowPlaces.get(key);
                if (!row || !reading || !place) return null;
                const block = editor.blockHeaders.get(key);
                const length = editor.lengths.get(key);
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
                      impliedMinutes={length?.implied ? length.minutes : null}
                      isActive={activeKey === key}
                      onActivate={setActiveKey}
                      isReserve={place.isReserve}
                      upTo={place.upTo}
                      downTo={place.downTo}
                      onMove={editor.moveRow}
                      onAnchor={editor.anchorRow}
                      onClockCommit={handleClockCommit}
                      isPlaced={placed?.key === key}
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
      {textEntry !== null ? (
        <PlanTextEntry
          initialText={textEntry}
          program={textProgram}
          onInsert={handleTextInsert}
          onCancel={() => setTextEntry(null)}
        />
      ) : (
        !isShut && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-5 py-3">
            {addOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => editor.addPieceRow(option.value)}
                aria-label={t("rehearsals.plan.add.piece_named", "Dodaj do planu: {{title}}", {
                  title: option.label,
                })}
                className={CHIP_BUTTON}
              >
                <Badge
                  variant="neutral"
                  casing="natural"
                  icon={<Plus size={11} aria-hidden="true" />}
                  className="max-w-64 cursor-pointer hover:border-ethereal-gold/40"
                >
                  <span className="truncate">{option.label}</span>
                </Badge>
              </button>
            ))}
            {addOptions.length === 0 && editor.programOptions.length > 0 && (
              <Caption color="muted" className="mr-1.5">
                {t("rehearsals.plan.add.piece_all", "Cały program już w planie")}
              </Caption>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={editor.addFreeRow}
              leftIcon={<Plus size={14} aria-hidden="true" />}
            >
              {t("rehearsals.plan.add.free", "Punkt")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.addBreakRow(t("rehearsals.plan.row.break_label", "Przerwa"))}
              leftIcon={<Coffee size={14} aria-hidden="true" />}
            >
              {t("rehearsals.plan.add.break", "Przerwa")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTextEntry("")}
              leftIcon={<ListOrdered size={14} aria-hidden="true" />}
            >
              {t("rehearsals.plan.add.text", "Wpisz listą")}
            </Button>
          </div>
        )
      )}

      {/* ── Save ────────────────────────────────────────────────────────── */}
      {/* Saving stays the primary act — it is silent and done a dozen times;
          sending is the considered one beside it. */}
      {actions === "dock" ? (
        <EditorActionBar
          isOpen={editor.isDirty}
          description={t("rehearsals.plan.save.description", "Zmieniono plan próby.")}
          onCancel={handleCancel}
          onConfirm={handleSave}
          isLoading={isBusy}
          secondaryAction={
            canSaveAndSend
              ? {
                  label: saveAndSendLabel,
                  icon: <Send size={14} aria-hidden="true" />,
                  onClick: handleSaveAndSend,
                  isLoading: isSavingToSend,
                }
              : undefined
          }
        />
      ) : (
        editor.isDirty &&
        actionsSlot &&
        createPortal(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isBusy}>
              {t("common.actions.cancel", "Anuluj")}
            </Button>
            {canSaveAndSend && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAndSend}
                isLoading={isSavingToSend}
                disabled={isBusy}
                leftIcon={!isSavingToSend ? <Send size={14} aria-hidden="true" /> : undefined}
              >
                {saveAndSendLabel}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={save.isPending && !isSavingToSend}
              disabled={isBusy}
            >
              {t("common.actions.save", "Zapisz")}
            </Button>
          </div>,
          actionsSlot,
        )
      )}

      {onClose && (
        <ConfirmModal
          isOpen={isClosePromptOpen}
          title={t("rehearsals.plan.discard.title", "Zamknąć bez zapisywania?")}
          description={t(
            "rehearsals.plan.discard.desc",
            "Zmiany w planie tej próby nie zostały zapisane i przepadną.",
          )}
          confirmText={t("rehearsals.plan.discard.confirm", "Odrzuć zmiany")}
          cancelText={t("rehearsals.plan.discard.keep", "Wróć do planu")}
          isDestructive={true}
          onConfirm={() => {
            setIsClosePromptOpen(false);
            onClose();
          }}
          onCancel={() => setIsClosePromptOpen(false)}
        />
      )}
    </section>
  );
};
