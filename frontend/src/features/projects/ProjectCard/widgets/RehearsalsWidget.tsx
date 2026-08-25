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
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
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
    <SectionCard
      title={t("projects.rehearsals.upcoming", "Najbliższe Próby")}
      icon={<Calendar size={15} aria-hidden="true" />}
      onActivate={onEdit}
      ariaLabel={t("projects.rehearsals.aria_label", "Zarządzaj próbami projektu")}
      bodyClassName="gap-4"
    >
      {sortedRehearsals.length > 0 ? (
        <ul className="divide-y divide-hairline">
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
                        {/* Date and time are one datum and must share a size:
                            at two different sizes on one baseline the larger
                            half reads as an emphasis nobody intended. */}
                        <Text as="span" size="base" weight="medium">
                          {formatLocalizedDate(
                            rehearsal.date_time,
                            { day: "numeric", month: "short" },
                            undefined,
                            rehearsal.timezone,
                          )}
                        </Text>
                        <Caption color="muted">•</Caption>
                        {/* `orientation` must be explicit: the component's base
                            is `flex flex-col`, and tailwind-merge keeps that
                            alongside a caller's `inline-flex items-center`, so
                            a row asked for by class alone silently centres the
                            local time under the event time. */}
                        <DualTimeDisplay
                          value={rehearsal.date_time}
                          endValue={rehearsal.end_date_time}
                          timeZone={rehearsal.timezone}
                          orientation="row"
                          spacing="compact"
                          size="base"
                          weight="medium"
                          local="paired"
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
                          <Eyebrow color="crimson">
                            {t("projects.rehearsals.absences_reported", "Zgłoszono braki:")}{" "}
                            {absences}
                          </Eyebrow>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {/* A partial call is not necessarily a sectional one — the
                        conductor can name individuals — so the chip states the
                        headcount rather than guessing at a rehearsal type. */}
                    <Badge variant={isTutti ? "success" : "amethyst"}>
                      {isTutti
                        ? t("projects.rehearsals.status.tutti", "Tutti")
                        : t(
                            "projects.rehearsals.status.invited",
                            "Wezwanych: {{count}}",
                            { count: invitedCount },
                          )}
                    </Badge>
                    {!rehearsal.is_mandatory && (
                      <Badge variant="neutral">
                        {t("projects.rehearsals.status.optional", "Opcjonalna")}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
      ) : (
        <StatePanel
          variant="inline"
          icon={<Calendar size={24} aria-hidden="true" />}
          title={t("projects.rehearsals.empty.no_rehearsals", "Brak zaplanowanych prób")}
        />
      )}
    </SectionCard>
  );
};
