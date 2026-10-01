/**
 * @file UpcomingAbsencesSheet.tsx
 * @description Who is missing from which upcoming rehearsal, on one screen. The
 * Overview's "reported absences" row opens it, and so does a singer's absence
 * request in the notifications, because the answer is otherwise spread across
 * every rehearsal of the project, one evening per click.
 *
 * Grouped by rehearsal, soonest first, because the decision a conductor makes
 * from it is per evening — whether a sectional still stands without two of its
 * tenors. Each absence shows its record (absence or excused absence) and the
 * singer's own note. A reported absence carries one verdict, "Przyjmij", which
 * excuses the singer and tells them so; an excused one carries none. There is
 * no refusal: no record says "refused", and a refused excuse is a conversation,
 * not a status. A rehearsal's header opens that evening in Centrum Obecności.
 * On the Overview the footer opens the project's full attendance matrix, which
 * also holds the past sessions this list leaves out; a caller that passes no
 * `onOpenMatrix` gets no footer — the dashboard banner opens the sheet for one
 * evening, and the matrix is an entry tool, not a reading list.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/UpcomingAbsencesSheet
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarCheck, ChevronRight, Grid } from "lucide-react";

import { ATTENDANCE_STATUS_META } from "@/features/rehearsals/constants/attendanceMeta";
import { cn } from "@/shared/lib/utils";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import type { Attendance } from "@/shared/types";
import { useAcceptAbsence } from "../../api/project.attendance.mutations";
import type { RehearsalAbsences } from "../../lib/upcomingAbsences";

interface UpcomingAbsencesSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly projectTitle: string;
  readonly groups: readonly RehearsalAbsences[];
  readonly onOpenRehearsal: (rehearsalId: string) => void;
  readonly onOpenMatrix?: () => void;
  /** Overrides the "upcoming rehearsals" heading for a sheet scoped to one evening. */
  readonly title?: string;
}

/** The venue's wall clock: a rehearsal is booked in the timezone of its room. */
const REHEARSAL_MOMENT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

export const UpcomingAbsencesSheet = ({
  isOpen,
  onClose,
  projectTitle,
  groups,
  onOpenRehearsal,
  onOpenMatrix,
  title,
}: UpcomingAbsencesSheetProps): React.JSX.Element => {
  const { t } = useTranslation();
  const acceptAbsence = useAcceptAbsence();

  // The toast names what the tap set off — a message to the singer — because
  // "Przyjmij" also reads as "noted", which would send nothing.
  const accept = (projectId: string, attendance: Attendance, name: string) =>
    acceptAbsence.mutate(
      { projectId, attendance },
      {
        onSuccess: () =>
          toast.success(
            t(
              "projects.overview.absences_sheet.accepted",
              "Wysłano zwolnienie z próby: {{name}}",
              { name },
            ),
          ),
      },
    );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        title ??
        t(
          "projects.overview.absences_sheet.title",
          "Nieobecności na nadchodzących próbach",
        )
      }
      subtitle={projectTitle}
      footer={
        onOpenMatrix ? (
          <Button
            variant="outline"
            size="sm"
            fullWidth
            leftIcon={<Grid size={15} aria-hidden="true" />}
            onClick={onOpenMatrix}
          >
            {t(
              "projects.overview.absences_sheet.open_matrix",
              "Pokaż w macierzy frekwencji",
            )}
          </Button>
        ) : undefined
      }
    >
      {groups.length === 0 ? (
        <StatePanel
          variant="inline"
          icon={<CalendarCheck size={28} aria-hidden="true" />}
          title={t(
            "projects.overview.absences_sheet.empty",
            "Na nadchodzących próbach nikt nie zgłosił nieobecności.",
          )}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(({ rehearsal, absences }) => {
            const moment = formatLocalizedDateTime(
              rehearsal.date_time,
              REHEARSAL_MOMENT,
              undefined,
              rehearsal.timezone,
            );
            const focus = rehearsal.focus?.trim();

            return (
              <section key={rehearsal.id} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onOpenRehearsal(String(rehearsal.id))}
                  aria-label={t(
                    "projects.overview.absences_sheet.open_rehearsal",
                    "Otwórz próbę: {{moment}}",
                    { moment },
                  )}
                  className="group flex w-full items-center gap-3 rounded-nested border border-hairline bg-ethereal-marble/60 px-3 py-2.5 text-left transition-colors hover:border-ethereal-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Text as="span" size="sm" weight="semibold" className="tabular-nums">
                      {moment}
                    </Text>
                    {focus && (
                      <Caption color="muted" className="truncate">
                        {focus}
                      </Caption>
                    )}
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-ethereal-graphite/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ethereal-gold"
                    aria-hidden="true"
                  />
                </button>

                <ul className="divide-y divide-hairline">
                  {absences.map(({ attendance, participation }) => {
                    const meta = ATTENDANCE_STATUS_META[attendance.status];
                    const note = attendance.excuse_note?.trim();
                    const name =
                      participation.artist_name?.trim() ||
                      t("projects.matrix.unknown_member", "Nieznany członek");
                    return (
                      <li key={attendance.id} className="flex items-start gap-3 px-3 py-2.5">
                        <span
                          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", meta.dot)}
                          aria-hidden="true"
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <Text as="span" size="sm" weight="medium">
                              {name}
                            </Text>
                            {participation.artist_voice_type_display && (
                              <Caption color="muted">
                                {participation.artist_voice_type_display}
                              </Caption>
                            )}
                            <Caption color="muted" className="ml-auto">
                              {t(meta.labelKey, meta.fallback)}
                            </Caption>
                          </span>
                          {note && (
                            <Text as="span" size="sm" color="graphite" className="text-pretty italic">
                              {note}
                            </Text>
                          )}
                        </span>
                        {attendance.status === "ABSENT" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0 self-center"
                            onClick={() =>
                              accept(String(rehearsal.project), attendance, name)
                            }
                            aria-label={t(
                              "projects.overview.absences_sheet.accept_label",
                              "Przyjmij nieobecność: {{name}}, {{moment}}",
                              { name, moment },
                            )}
                          >
                            {t("projects.overview.absences_sheet.accept", "Przyjmij")}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
};
