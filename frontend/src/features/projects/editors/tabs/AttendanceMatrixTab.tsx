/**
 * @file AttendanceMatrixTab.tsx
 * @description The project's attendance register. Rows are the singers, columns
 * are the rehearsals — the transposition matters: a choir has ~44 members and a
 * project ~8 rehearsals, so the previous orientation put the long, long-labelled
 * axis across a horizontal scrollbar and truncated every surname to fit, while
 * the only aggregate it could offer was per-rehearsal. Read this way the roster
 * scrolls the way the page already does, a name has room to be a name, and the
 * question a conductor actually opens this tab with — *who keeps missing* — has
 * a column of its own.
 *
 * Marks are a local draft until Save; see `useAttendanceMatrix` for why that is
 * an overlay rather than a copy.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/AttendanceMatrixTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CalendarX2, ClipboardList, Search, Users } from "lucide-react";

import {
  LOW_ATTENDANCE_RATE,
  voiceSectionLabelKey,
} from "@/features/rehearsals/constants/attendanceMeta";
import { cn } from "@/shared/lib/utils";
import {
  EMPTY_TALLY,
  MARK_CYCLE,
  isCalled,
  type AttendanceMark,
  type MarkTally,
} from "../../lib/attendanceMatrix";
import {
  ROSTER_SEARCH_THRESHOLD,
  useAttendanceMatrix,
} from "../hooks/useAttendanceMatrix";
import { AttendanceCell } from "./components/AttendanceCell";
import {
  AttendanceMarker,
  attendanceMarkFallback,
  attendanceMarkLabelKey,
} from "./components/AttendanceMarker";
import { AttendanceSessionHeader } from "./components/AttendanceSessionHeader";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import {
  Caption,
  Eyebrow,
  Metric,
  Text,
  Unit,
} from "@/shared/ui/primitives/typography";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

interface AttendanceMatrixTabProps {
  projectId: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

/** The frozen name and rate rails; the grid between them is what scrolls. */
const STICKY_HEAD_CELL =
  "sticky top-0 z-30 border-b border-hairline-strong bg-ethereal-marble px-4 py-3 text-left align-bottom font-normal";
const STICKY_FOOT_CELL =
  "sticky bottom-0 z-30 border-t border-hairline-strong bg-ethereal-marble px-4 py-2.5 text-left font-normal";

/**
 * A rate is a figure that aligns down a column, so it is the one place D1 sends
 * to sans + `tabular-nums`… except that it also has to sit beside the calendar
 * stamps, which are serif. `Metric` wins: the column is two digits wide, where
 * alignment is not at stake, and a third type family in one card would be.
 */
const RateFigure = ({
  tally,
  title,
}: {
  readonly tally: MarkTally;
  readonly title: string;
}): React.JSX.Element => {
  // No breakdown behind a dash: a tooltip reading "present: 0 · late: 0 · …"
  // dresses "nothing recorded" up as data.
  if (tally.rate === null) {
    return (
      <Text size="sm" color="muted">
        —
      </Text>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-0.5" title={title}>
      <Metric
        as="span"
        size="base"
        color={tally.rate < LOW_ATTENDANCE_RATE ? "gold" : "default"}
      >
        {tally.rate}
      </Metric>
      <Unit size="xs">%</Unit>
    </span>
  );
};

export const AttendanceMatrixTab = ({
  projectId,
  onDirtyStateChange,
}: AttendanceMatrixTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    sessions,
    sections,
    rosterSize,
    query,
    setQuery,
    isFiltered,
    markOf,
    isDirtyCell,
    sessionTally,
    singerTally,
    overall,
    cycleCell,
    markSessionPresent,
    pendingCount,
    isDirty,
    isSaving,
    saveChanges,
    discardChanges,
  } = useAttendanceMatrix(projectId, onDirtyStateChange);

  // Resolved once for the whole grid rather than once per cell: several hundred
  // cells each opening their own translator subscription is pure overhead.
  const markLabels = React.useMemo(() => {
    const labels = new Map<string, string>();
    MARK_CYCLE.forEach((mark) => {
      labels.set(
        String(mark),
        t(attendanceMarkLabelKey(mark), attendanceMarkFallback(mark)),
      );
    });
    return labels;
  }, [t]);

  const labelOf = React.useCallback(
    (mark: AttendanceMark): string => markLabels.get(String(mark)) ?? "",
    [markLabels],
  );

  const notCalledLabel = t(
    "projects.matrix.not_called",
    "Niewezwany na tę próbę",
  );

  /**
   * The shortfall clause is appended, not interpolated: a rehearsal three weeks
   * out has forty "missing" entries by arithmetic and none by any reading a
   * human would give it, so a column that cannot yet be incomplete does not say
   * it is.
   */
  const describeTally = React.useCallback(
    (tally: MarkTally, countMissing: boolean): string => {
      const breakdown = t(
        "projects.matrix.tooltip.breakdown",
        "Obecni: {{present}} · spóźnieni: {{late}} · nieobecni: {{absent}} · usprawiedliwieni: {{excused}}",
        {
          present: tally.byStatus.PRESENT,
          late: tally.byStatus.LATE,
          absent: tally.byStatus.ABSENT,
          excused: tally.byStatus.EXCUSED,
        },
      );

      if (!countMissing || tally.missing === 0) return breakdown;

      return `${breakdown} · ${t(
        "projects.matrix.tooltip.missing",
        "bez wpisu: {{count}}",
        { count: tally.missing },
      )}`;
    },
    [t],
  );

  const hasSessions = sessions.length > 0;
  const hasRoster = rosterSize > 0;
  const showSearch = hasSessions && rosterSize > ROSTER_SEARCH_THRESHOLD;

  // The card states the project's own figure once. Nothing recorded yet is not
  // "0%" — it is no rate at all, and printing a red nought over a rehearsal
  // nobody has marked is the loudest possible way to say nothing.
  const summary =
    overall.rate === null ? undefined : (
      <span className="flex items-baseline gap-2">
        <Eyebrow size="overline-sm" color="muted">
          {t("projects.matrix.summary.label", "Frekwencja")}
        </Eyebrow>
        <span className="inline-flex items-baseline gap-0.5">
          <Metric
            as="span"
            size="md"
            color={overall.rate < LOW_ATTENDANCE_RATE ? "gold" : "default"}
          >
            {overall.rate}
          </Metric>
          <Unit size="xs">%</Unit>
        </span>
        {overall.missing > 0 && (
          <Caption color="muted" className="hidden sm:inline">
            {"· "}
            {t("projects.matrix.summary.missing", "{{count}} bez wpisu", {
              count: overall.missing,
            })}
          </Caption>
        )}
      </span>
    );

  const renderBody = (): React.JSX.Element => {
    if (!hasSessions) {
      return (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={<CalendarX2 size={24} aria-hidden="true" />}
          title={t("projects.matrix.empty.rehearsals_title", "Brak prób")}
          description={t(
            "projects.matrix.empty.rehearsals_desc",
            "Listę obecności prowadzi się na próbach. Dodaj pierwszą, a pojawi się tu jako kolumna.",
          )}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="../rehearsals">
                {t("projects.matrix.empty.rehearsals_action", "Otwórz próby")}
              </Link>
            </Button>
          }
        />
      );
    }

    if (!hasRoster) {
      return (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={<Users size={24} aria-hidden="true" />}
          title={t("projects.matrix.empty.cast_title", "Brak obsady")}
          description={t(
            "projects.matrix.empty.cast_desc",
            "Przypisz śpiewaków do projektu — każdy z nich dostanie tu swój wiersz.",
          )}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="../cast">
                {t("projects.matrix.empty.cast_action", "Otwórz obsadę")}
              </Link>
            </Button>
          }
        />
      );
    }

    if (sections.length === 0) {
      return (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={<Search size={22} aria-hidden="true" />}
          title={t("projects.matrix.empty.no_matches", "Brak wyników")}
        />
      );
    }

    return (
      // `border-separate` rather than `collapse`: a collapsed border belongs to
      // the table, not to the cell, and detaches from a sticky cell as it
      // scrolls — the frozen name rail loses its rule mid-scroll in every
      // browser. Verticals are dropped between data columns on purpose; the
      // rows are the reading direction and a full lattice only adds ink.
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">
          {t(
            "projects.matrix.caption",
            "Lista obecności: wiersze to śpiewacy, kolumny to próby.",
          )}
        </caption>

        <thead>
          <tr>
            <th
              scope="col"
              className={cn(STICKY_HEAD_CELL, "left-0 min-w-52 border-r border-r-hairline-strong")}
            >
              <Eyebrow size="overline-sm" color="muted">
                {t("projects.matrix.table.singer", "Śpiewak")}
              </Eyebrow>
            </th>

            {sessions.map((session) => (
              <AttendanceSessionHeader
                key={session.rehearsalId}
                session={session}
                tally={sessionTally.get(session.rehearsalId) ?? EMPTY_TALLY}
                onMarkPresent={markSessionPresent}
              />
            ))}

            <th
              scope="col"
              className={cn(
                STICKY_HEAD_CELL,
                "right-0 min-w-20 border-l border-l-hairline-strong text-right",
              )}
            >
              <Eyebrow size="overline-sm" color="muted">
                {t("projects.matrix.table.rate", "Frekwencja")}
              </Eyebrow>
            </th>
          </tr>
        </thead>

        <tbody>
          {sections.map((section) => (
            <React.Fragment key={section.key}>
              {/* The label rides the frozen rail; a `colSpan` band would carry
                  it off-screen the moment the grid scrolls sideways. */}
              <tr>
                <th
                  scope="colgroup"
                  className="sticky left-0 z-10 border-y border-hairline bg-ethereal-parchment px-4 py-1.5 text-left font-normal"
                >
                  <span className="flex items-baseline gap-2">
                    <Eyebrow size="overline-sm" color="gold">
                      {t(voiceSectionLabelKey(section.key), section.key)}
                    </Eyebrow>
                    <Caption color="muted">{section.singers.length}</Caption>
                  </span>
                </th>
                <td
                  colSpan={sessions.length + 1}
                  className="border-y border-hairline bg-ethereal-parchment"
                />
              </tr>

              {section.singers.map((singer) => {
                const tally =
                  singerTally.get(singer.participationId) ?? EMPTY_TALLY;

                return (
                  <tr key={singer.participationId} className="group/row">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-r border-hairline border-r-hairline-strong bg-ethereal-alabaster px-4 text-left font-normal group-hover/row:bg-ethereal-gold/6"
                    >
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <Text
                          size="base"
                          weight="medium"
                          color={singer.isUnresolved ? "muted" : "default"}
                          className="truncate"
                        >
                          {singer.lastName}
                        </Text>
                        {singer.firstName && (
                          <Caption color="muted" className="truncate">
                            {singer.firstName}
                          </Caption>
                        )}
                      </span>
                    </th>

                    {sessions.map((session) => {
                      const called = isCalled(session, singer.participationId);
                      const mark = called
                        ? markOf(session.rehearsalId, singer.participationId)
                        : null;

                      return (
                        <AttendanceCell
                          key={session.rehearsalId}
                          rehearsalId={session.rehearsalId}
                          participationId={singer.participationId}
                          mark={mark}
                          isCalled={called}
                          isDirty={
                            called &&
                            isDirtyCell(
                              session.rehearsalId,
                              singer.participationId,
                            )
                          }
                          label={called ? labelOf(mark) : notCalledLabel}
                          onCycle={cycleCell}
                        />
                      );
                    })}

                    <td className="sticky right-0 z-10 border-b border-l border-hairline border-l-hairline-strong bg-ethereal-alabaster px-3 text-right group-hover/row:bg-ethereal-gold/6">
                      <RateFigure
                        tally={tally}
                        title={describeTally(tally, true)}
                      />
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>

        {/* Hidden while a search is active: a per-rehearsal total sitting under
            two filtered rows reads as the total FOR those two. */}
        {!isFiltered && (
          <tfoot>
            <tr>
              <th scope="row" className={cn(STICKY_FOOT_CELL, "left-0 border-r border-r-hairline-strong")}>
                <Eyebrow size="overline-sm" color="muted">
                  {t("projects.matrix.table.session_rate", "Frekwencja próby")}
                </Eyebrow>
              </th>

              {sessions.map((session) => {
                const tally =
                  sessionTally.get(session.rehearsalId) ?? EMPTY_TALLY;
                return (
                  <td
                    key={session.rehearsalId}
                    className="sticky bottom-0 z-20 border-t border-hairline-strong bg-ethereal-marble px-1 py-2.5 text-center"
                  >
                    <RateFigure
                      tally={tally}
                      title={describeTally(tally, session.isPast)}
                    />
                  </td>
                );
              })}

              <td
                className={cn(STICKY_FOOT_CELL, "right-0 border-l border-l-hairline-strong")}
              />
            </tr>
          </tfoot>
        )}
      </table>
    );
  };

  return (
    <>
      <StaggeredBentoContainer className="w-full pb-24">
        <StaggeredBentoItem>
          <SectionCard
            as="h2"
            icon={<ClipboardList size={15} aria-hidden="true" />}
            title={t("projects.matrix.title", "Lista obecności")}
            action={summary}
            scroll
            className="max-h-[70dvh]"
            bodyClassName="overflow-x-auto p-0"
            toolbar={
              showSearch ? (
                // `text`, not `search`: the search type brings the OS's own
                // clear button, which is the one kind of chrome this whole
                // remediation is about removing.
                <Input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  leftIcon={<Search size={16} aria-hidden="true" />}
                  placeholder={t(
                    "projects.matrix.search.placeholder",
                    "Szukaj osoby…",
                  )}
                  aria-label={t(
                    "projects.matrix.search.placeholder",
                    "Szukaj osoby…",
                  )}
                />
              ) : undefined
            }
            footer={
              hasSessions && hasRoster ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {MARK_CYCLE.map((mark) => (
                    <span
                      key={String(mark)}
                      className="flex items-center gap-1.5"
                    >
                      <AttendanceMarker mark={mark} className="h-5 w-5" />
                      <Caption color="graphite">{labelOf(mark)}</Caption>
                    </span>
                  ))}
                  <Caption color="muted" className="sm:ml-auto">
                    {t(
                      "projects.matrix.legend.hint",
                      "Klikaj, aby zmieniać status · Shift + klik cofa",
                    )}
                  </Caption>
                </div>
              ) : undefined
            }
          >
            {renderBody()}
          </SectionCard>
        </StaggeredBentoItem>
      </StaggeredBentoContainer>

      <EditorActionBar
        isOpen={isDirty}
        description={t(
          "projects.matrix.action_bar.description",
          "Zmieniono {{count}} wpisów frekwencji.",
          { count: pendingCount },
        )}
        onCancel={discardChanges}
        onConfirm={saveChanges}
        cancelText={t("common.actions.discard", "Odrzuć")}
        confirmText={t("projects.matrix.action_bar.save", "Zapisz frekwencję")}
        isLoading={isSaving}
      />
    </>
  );
};
