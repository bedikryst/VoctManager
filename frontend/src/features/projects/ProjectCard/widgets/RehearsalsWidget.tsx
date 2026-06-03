/**
 * @file RehearsalsWidget.tsx
 * @description Overview list of the next rehearsal sessions, with timezone-aware ordering
 * and absence alerts. Rehearsal *progress* (done / total) is owned by the Overview's KPI
 * strip, so it is intentionally not duplicated here.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/RehearsalsWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, UserMinus } from "lucide-react";

import type { Project, Rehearsal } from "@/shared/types";
import {
  useProjectRehearsals,
  useProjectParticipations,
} from "../../api/project.read.queries";
import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import {
  compareProjectDateAsc,
  isFutureProjectDate,
} from "../../lib/projectPresentation";

interface RehearsalsWidgetProps {
  project: Project;
  onEdit?: () => void;
}

interface EnrichedRehearsal extends Rehearsal {
  absent_count?: number;
}

export const RehearsalsWidget = ({
  project,
  onEdit,
}: RehearsalsWidgetProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: projectRehearsals } = useProjectRehearsals(String(project.id));
  const { data: projectParticipations } = useProjectParticipations(
    String(project.id),
  );

  const sortedRehearsals = useMemo<EnrichedRehearsal[]>(
    () =>
      [...projectRehearsals].sort((left, right) =>
        compareProjectDateAsc(left.date_time, right.date_time),
      ),
    [projectRehearsals],
  );

  const upcomingRehearsals = useMemo<EnrichedRehearsal[]>(
    () =>
      sortedRehearsals
        .filter((rehearsal) => isFutureProjectDate(rehearsal.date_time))
        .slice(0, 3),
    [sortedRehearsals],
  );

  return (
    <WidgetCard
      title={t("projects.rehearsals.upcoming", "Najbliższe Próby")}
      icon={<Calendar size={15} aria-hidden="true" />}
      onActivate={onEdit}
      ariaLabel={t("projects.rehearsals.aria_label", "Zarządzaj próbami projektu")}
      bodyClassName="gap-4"
    >
      {sortedRehearsals.length > 0 ? (
        <ul className="divide-y divide-ethereal-ink/5">
            {upcomingRehearsals.map((rehearsal, index) => {
              const invitedCount = rehearsal.invited_participations?.length || 0;
              const isTutti =
                invitedCount === 0 ||
                invitedCount === projectParticipations.length;
              const absences = rehearsal.absent_count || 0;

              return (
                <li
                  key={rehearsal.id || `reh-${index}`}
                  className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        rehearsal.is_mandatory
                          ? "bg-ethereal-gold"
                          : "bg-ethereal-incense/40"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Text as="span" size="sm" weight="medium">
                          {formatLocalizedDate(
                            rehearsal.date_time,
                            { day: "numeric", month: "short" },
                            undefined,
                            rehearsal.timezone,
                          )}
                        </Text>
                        <Caption color="muted">•</Caption>
                        <DualTimeDisplay
                          value={rehearsal.date_time}
                          timeZone={rehearsal.timezone}
                          containerClassName="inline-flex items-center gap-1"
                          primaryTimeClassName="inline-flex items-center gap-1 text-sm font-medium text-ethereal-ink"
                          localTimeClassName="pl-1 text-xs font-medium normal-case tracking-normal text-ethereal-graphite"
                        />
                      </div>

                      {rehearsal.location && (
                        <LocationPreview
                          locationRef={rehearsal.location}
                          variant="minimal"
                          className="max-w-60 justify-start"
                        />
                      )}

                      {rehearsal.focus?.trim() && (
                        <Text color="graphite" size="sm" className="text-pretty italic">
                          {rehearsal.focus}
                        </Text>
                      )}

                      {absences > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-ethereal-crimson">
                          <UserMinus size={11} aria-hidden="true" />
                          <Caption color="crimson" weight="bold" className="uppercase tracking-[0.16em]">
                            {t("projects.rehearsals.absences_reported", "Zgłoszono braki:")}{" "}
                            {absences}
                          </Caption>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge variant={isTutti ? "success" : "amethyst"}>
                      {isTutti
                        ? t("projects.rehearsals.tutti", "TUTTI")
                        : t("projects.rehearsals.sectional", "SEKCYJNA")}
                    </Badge>
                    {!rehearsal.is_mandatory && (
                      <Badge variant="neutral">
                        {t("projects.rehearsals.optional", "Opcjonalna")}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Calendar size={26} className="text-ethereal-incense/30" aria-hidden="true" />
          <Text color="muted">
            {t("projects.rehearsals.empty.no_rehearsals", "Brak zaplanowanych prób.")}
          </Text>
        </div>
      )}
    </WidgetCard>
  );
};
