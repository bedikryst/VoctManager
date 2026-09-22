/**
 * @file ProjectPlanGrid.tsx
 * @description The project's plans read across: rows are the programme's
 * pieces, columns the rehearsals by date, and each cell what that evening
 * does with the piece — planned, in reserve, done, not done — so a conductor
 * sees which piece has not had an evening yet and gives it one without opening
 * eight plans. Every state has its own glyph; colour only repeats it.
 *
 * An evening that has not started takes a tap: an empty cell puts the piece
 * on that plan, a filled one takes it off (asking first when the row carries
 * a note, minutes, a clock or an exclusion — the tap would lose them). A piece
 * sitting twice on one evening opens the editor instead, which is the one
 * place that can say which copy goes. A started evening is the record and
 * only reads. The date heading opens that evening's plan either way.
 *
 * Layout follows the attendance register: a frozen name rail, the dates
 * scrolling sideways under it on a phone, the programme's own figure frozen on
 * the right once the project has a verdict to count.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/plan/ProjectPlanGrid
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  CalendarX2,
  Check,
  Circle,
  CircleDashed,
  ListMusic,
  Music,
  Plus,
  X,
} from "lucide-react";

import type { Rehearsal } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { formatLocalizedDate, formatLocalizedTime } from "@/shared/lib/time/intl";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Metric, Text, Unit } from "@/shared/ui/primitives/typography";
import {
  useProjectPlanGrid,
  type PlanCellState,
  type PlanGridCell,
  type PlanGridColumn,
  type PlanGridRow,
} from "./useProjectPlanGrid";

interface ProjectPlanGridProps {
  readonly projectId: string;
  /** The project's rehearsals, sorted by date. */
  readonly rehearsals: readonly Rehearsal[];
  readonly onOpenPlan: (rehearsal: Rehearsal) => void;
}

/** A removal the conductor is asked about before the row and what it carries go. */
interface PendingRemoval {
  readonly rehearsalId: string;
  readonly pieceId: string;
  readonly title: string;
  readonly date: string;
}

const STATE_ORDER: readonly PlanCellState[] = ["planned", "reserve", "done", "not_done"];

const STICKY_HEAD_CELL =
  "sticky top-0 z-30 border-b border-hairline-strong bg-ethereal-marble px-4 py-3 text-left align-bottom font-normal";

const CellGlyph = ({ state }: { readonly state: PlanCellState }): React.JSX.Element => {
  switch (state) {
    case "done":
      return (
        <Check size={16} strokeWidth={2.25} className="text-ethereal-sage" aria-hidden="true" />
      );
    case "not_done":
      return <X size={14} className="text-ethereal-graphite/60" aria-hidden="true" />;
    case "reserve":
      return <CircleDashed size={13} className="text-ethereal-graphite" aria-hidden="true" />;
    case "planned":
      return <Circle size={11} className="fill-current text-ethereal-ink" aria-hidden="true" />;
  }
};

const CellMark = ({ cell }: { readonly cell: PlanGridCell }): React.JSX.Element | null => {
  if (cell.state === null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 transition-opacity",
        cell.isPending && "opacity-40",
      )}
    >
      <CellGlyph state={cell.state} />
      {cell.count > 1 && (
        <Caption as="span" color="graphite" className="tabular-nums">
          {`×${cell.count}`}
        </Caption>
      )}
    </span>
  );
};

export const ProjectPlanGrid = ({
  projectId,
  rehearsals,
  onOpenPlan,
}: ProjectPlanGridProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { rows, columns, showStatistics, cellOf, setInPlan } = useProjectPlanGrid(
    projectId,
    rehearsals,
  );
  const [removal, setRemoval] = useState<PendingRemoval | null>(null);

  // Resolved once for the grid rather than once per cell.
  const stateLabels = useMemo(
    () =>
      new Map<PlanCellState | "none", string>([
        ["planned", t("rehearsals.plan.grid.state.planned", "W planie")],
        ["reserve", t("rehearsals.plan.grid.state.reserve", "Jeśli starczy czasu")],
        ["done", t("rehearsals.plan.grid.state.done", "Przerobione")],
        ["not_done", t("rehearsals.plan.grid.state.not_done", "Nieprzerobione")],
        ["none", t("rehearsals.plan.grid.state.none", "Poza planem")],
      ]),
    [t],
  );

  const columnDates = useMemo(
    () =>
      new Map(
        columns.map((column) => {
          const { rehearsal } = column;
          return [
            String(rehearsal.id),
            {
              day: formatLocalizedDate(
                rehearsal.date_time,
                { day: "numeric" },
                undefined,
                rehearsal.timezone,
              ),
              month: formatLocalizedDate(
                rehearsal.date_time,
                { month: "short" },
                undefined,
                rehearsal.timezone,
              ),
              time: formatLocalizedTime(
                rehearsal.date_time,
                { hour: "2-digit", minute: "2-digit" },
                undefined,
                rehearsal.timezone,
              ),
              spoken: formatLocalizedDate(
                rehearsal.date_time,
                { weekday: "long", day: "numeric", month: "long" },
                undefined,
                rehearsal.timezone,
              ),
              // No weekday: this one follows "próby" in a sentence, where a
              // nominative weekday cannot stand.
              inline: formatLocalizedDate(
                rehearsal.date_time,
                { day: "numeric", month: "long" },
                undefined,
                rehearsal.timezone,
              ),
            },
          ] as const;
        }),
      ),
    [columns],
  );

  const tapCell = (column: PlanGridColumn, row: PlanGridRow, cell: PlanGridCell): void => {
    const rehearsalId = String(column.rehearsal.id);
    if (cell.count > 1) {
      onOpenPlan(column.rehearsal);
      return;
    }
    if (cell.state === null) {
      setInPlan(rehearsalId, row.pieceId, true);
      return;
    }
    if (cell.carriesContent) {
      setRemoval({
        rehearsalId,
        pieceId: row.pieceId,
        title: row.title,
        date: columnDates.get(rehearsalId)?.inline ?? "",
      });
      return;
    }
    setInPlan(rehearsalId, row.pieceId, false);
  };

  const confirmRemoval = (): void => {
    if (removal) setInPlan(removal.rehearsalId, removal.pieceId, false);
    setRemoval(null);
  };

  const renderHeader = (column: PlanGridColumn): React.JSX.Element => {
    const { rehearsal } = column;
    const dates = columnDates.get(String(rehearsal.id));
    const letters =
      (rehearsal.invited_participations?.length ?? 0) === 0 ? rehearsal.called_sections ?? "" : "";
    const detail = [dates?.time, letters].filter(Boolean).join(" · ");
    const description = [dates?.spoken, dates?.time, rehearsal.focus]
      .filter((part): part is string => Boolean(part))
      .join(" · ");

    return (
      <th
        key={rehearsal.id}
        scope="col"
        title={description}
        className="sticky top-0 z-20 min-w-16 border-b border-hairline-strong bg-ethereal-marble p-0 align-top font-normal"
      >
        <button
          type="button"
          onClick={() => onOpenPlan(rehearsal)}
          aria-label={t("rehearsals.plan.grid.open_plan", "Otwórz plan próby: {{date}}", {
            date: description,
          })}
          className="flex w-full flex-col items-center gap-0.5 px-1 pb-2 pt-3 transition-colors hover:bg-ethereal-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/45"
        >
          <Metric as="span" size="lg" className="leading-none">
            {dates?.day}
          </Metric>
          <Eyebrow as="span" size="overline-sm" color="muted">
            {dates?.month}
          </Eyebrow>
          <Caption color="muted" className="whitespace-nowrap tabular-nums">
            {detail}
          </Caption>
          {column.sendState && (
            <Eyebrow
              as="span"
              size="overline-sm"
              color={column.sendState === "unsent" ? "gold" : "incense-muted"}
            >
              {column.sendState === "unsent"
                ? t("rehearsals.plan.grid.unsent", "Niewysłane")
                : t("rehearsals.plan.grid.draft", "Szkic")}
            </Eyebrow>
          )}
        </button>
      </th>
    );
  };

  const renderCell = (column: PlanGridColumn, row: PlanGridRow): React.JSX.Element => {
    const rehearsalId = String(column.rehearsal.id);
    const cell = cellOf(rehearsalId, row.pieceId);
    const state = stateLabels.get(cell.state ?? "none") ?? "";
    const described = t("rehearsals.plan.grid.cell", "{{piece}}, {{date}}: {{state}}", {
      piece: row.title,
      date: columnDates.get(rehearsalId)?.spoken ?? "",
      state:
        cell.count > 1
          ? `${state}, ${t("rehearsals.plan.grid.times", "{{times}} razy", { times: cell.count })}`
          : state,
    });

    if (column.isLocked) {
      return (
        <td
          key={rehearsalId}
          title={described}
          className="border-b border-hairline bg-ethereal-parchment/30 p-0"
        >
          <span className="flex h-11 items-center justify-center" aria-hidden="true">
            <CellMark cell={cell} />
          </span>
          <span className="sr-only">{described}</span>
        </td>
      );
    }

    const action =
      cell.count > 1
        ? t("rehearsals.plan.grid.action.open", "Otwórz plan tej próby")
        : cell.state === null
          ? t("rehearsals.plan.grid.action.add", "Dodaj do planu")
          : t("rehearsals.plan.grid.action.remove", "Usuń z planu");
    const label = `${described}. ${action}`;

    return (
      <td
        key={rehearsalId}
        className="border-b border-hairline p-0 group-hover/row:bg-ethereal-gold/6"
      >
        <button
          type="button"
          onClick={() => tapCell(column, row, cell)}
          title={label}
          aria-label={label}
          className="group/cell flex h-11 w-full items-center justify-center transition-colors duration-150 hover:bg-ethereal-gold/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/45"
        >
          {cell.state === null && !cell.isPending ? (
            <Plus
              size={14}
              className="text-ethereal-gold opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100"
              aria-hidden="true"
            />
          ) : (
            <CellMark cell={cell} />
          )}
        </button>
      </td>
    );
  };

  const renderStatistic = (row: PlanGridRow): React.JSX.Element => {
    const count = row.rehearsedCount;
    const description =
      count === null
        ? undefined
        : count === 0
          ? t("projects.program.rehearsed.never", "Nie ćwiczone")
          : t("projects.program.rehearsed.count", "Ćwiczone {{times}}× · ostatnio {{date}}", {
              times: count,
              // Midday: a bare ISO date parses as UTC midnight, the day before
              // for a browser west of Greenwich.
              date: formatLocalizedDate(`${row.lastRehearsedOn}T12:00:00`, {
                day: "2-digit",
                month: "2-digit",
              }),
            });

    return (
      <td
        title={description}
        className="sticky right-0 z-10 border-b border-l border-hairline border-l-hairline-strong bg-ethereal-alabaster px-3 text-right group-hover/row:bg-ethereal-gold/6"
      >
        {count === null ? (
          <Text size="sm" color="muted">
            —
          </Text>
        ) : (
          <span className="inline-flex items-baseline gap-0.5">
            <Metric as="span" size="base" color={count === 0 ? "gold" : "default"}>
              {count}
            </Metric>
            <Unit size="xs">×</Unit>
          </span>
        )}
      </td>
    );
  };

  const renderBody = (): React.JSX.Element => {
    if (columns.length === 0) {
      return (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={<CalendarX2 size={24} aria-hidden="true" />}
          title={t("rehearsals.plan.grid.empty.rehearsals_title", "Brak prób")}
          description={t(
            "rehearsals.plan.grid.empty.rehearsals_desc",
            "Każda zapisana próba stanie się tu kolumną.",
          )}
        />
      );
    }

    if (rows.length === 0) {
      return (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={<Music size={24} aria-hidden="true" />}
          title={t("rehearsals.plan.grid.empty.program_title", "Program jest pusty")}
          description={t(
            "rehearsals.plan.grid.empty.program_desc",
            "Każdy utwór programu dostanie tu swój wiersz.",
          )}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="../program">
                {t("rehearsals.plan.grid.empty.program_action", "Otwórz program")}
              </Link>
            </Button>
          }
        />
      );
    }

    return (
      // `border-separate`, as in the attendance register: a collapsed border
      // belongs to the table and detaches from a sticky cell as it scrolls.
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">
          {t(
            "rehearsals.plan.grid.caption",
            "Plany prób: wiersze to utwory programu, kolumny to próby.",
          )}
        </caption>

        <thead>
          <tr>
            <th
              scope="col"
              className={cn(STICKY_HEAD_CELL, "left-0 min-w-44 border-r border-r-hairline-strong")}
            >
              <Eyebrow size="overline-sm" color="muted">
                {t("rehearsals.plan.grid.piece", "Utwór")}
              </Eyebrow>
            </th>

            {columns.map(renderHeader)}

            {showStatistics && (
              <th
                scope="col"
                className={cn(
                  STICKY_HEAD_CELL,
                  "right-0 min-w-20 border-l border-l-hairline-strong text-right",
                )}
              >
                <Eyebrow size="overline-sm" color="muted">
                  {t("rehearsals.plan.grid.rehearsed", "Ćwiczone")}
                </Eyebrow>
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.pieceId} className="group/row">
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-hairline border-r-hairline-strong bg-ethereal-alabaster px-4 text-left font-normal group-hover/row:bg-ethereal-gold/6"
              >
                <Text
                  as="span"
                  size="sm"
                  weight="medium"
                  truncate
                  title={row.title}
                  className="block max-w-40 sm:max-w-64"
                >
                  {row.title}
                </Text>
              </th>

              {columns.map((column) => renderCell(column, row))}

              {showStatistics && renderStatistic(row)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const hasGrid = columns.length > 0 && rows.length > 0;

  return (
    <>
      <SectionCard
        as="h2"
        icon={<ListMusic size={15} aria-hidden="true" />}
        title={t("rehearsals.plan.grid.title", "Utwory na próbach")}
        scroll
        className="max-h-[78dvh]"
        bodyClassName="overflow-x-auto p-0"
        footer={
          hasGrid ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {STATE_ORDER.map((state) => (
                <span key={state} className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center">
                    <CellGlyph state={state} />
                  </span>
                  <Caption color="graphite">{stateLabels.get(state)}</Caption>
                </span>
              ))}
              <Caption color="muted" className="sm:ml-auto">
                {t(
                  "rehearsals.plan.grid.hint",
                  "Pole przyszłej próby dodaje utwór do planu albo go usuwa · data otwiera plan",
                )}
              </Caption>
            </div>
          ) : undefined
        }
      >
        {renderBody()}
      </SectionCard>

      <ConfirmModal
        isOpen={removal !== null}
        title={t("rehearsals.plan.grid.remove.title", "Usunąć „{{title}}” z planu?", {
          title: removal?.title ?? "",
        })}
        description={t(
          "rehearsals.plan.grid.remove.desc",
          "W planie próby {{date}} ten punkt ma notatkę, minuty, godzinę lub wykluczenia — przepadną razem z nim.",
          { date: removal?.date ?? "" },
        )}
        confirmText={t("rehearsals.plan.grid.remove.confirm", "Usuń z planu")}
        isDestructive={true}
        onConfirm={confirmRemoval}
        onCancel={() => setRemoval(null)}
      />
    </>
  );
};
