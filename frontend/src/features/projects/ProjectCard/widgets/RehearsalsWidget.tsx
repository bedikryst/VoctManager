/**
 * @file RehearsalsWidget.tsx
 * @description Dashboard widget displaying upcoming rehearsals, progress, and absence alerts.
 * Implements typed timezone-aware ordering and status summaries.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/widgets/RehearsalsWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, UserMinus } from "lucide-react";

import type { Project, Rehearsal } from "@/shared/types";
import { useProjectData } from "../../hooks/useProjectData";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import {
  compareProjectDateAsc,
  isFutureProjectDate,
  isPastProjectDate,
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
  const {
    rehearsals: projectRehearsals,
    participations: projectParticipations,
  } = useProjectData(String(project.id));

  const sortedRehearsals = useMemo<EnrichedRehearsal[]>(
    () =>
      [...projectRehearsals].sort((left, right) =>
        compareProjectDateAsc(left.date_time, right.date_time),
      ),
    [projectRehearsals],
  );

  const pastRehearsals = useMemo<EnrichedRehearsal[]>(
    () =>
      sortedRehearsals.filter((rehearsal) =>
        isPastProjectDate(rehearsal.date_time),
      ),
    [sortedRehearsals],
  );

  const upcomingRehearsals = useMemo<EnrichedRehearsal[]>(
    () =>
      sortedRehearsals
        .filter((rehearsal) => isFutureProjectDate(rehearsal.date_time))
        .slice(0, 3),
    [sortedRehearsals],
  );

  const progressPercentage =
    sortedRehearsals.length > 0
      ? (pastRehearsals.length / sortedRehearsals.length) * 100
      : 0;

  return (
    <GlassCard
      variant="solid"
      padding="md"
      isHoverable={Boolean(onEdit)}
      onClick={onEdit}
      className="flex min-h-56 flex-col justify-between"
      role={onEdit ? "button" : "region"}
      aria-label={t(
        "projects.rehearsals.aria_label",
        "Zarządzaj próbami projektu",
      )}
    >
      <SectionHeader
        title={t("projects.rehearsals.upcoming", "Najbliższe Próby")}
        icon={<Calendar size={16} aria-hidden="true" />}
        className="mb-0 pb-3"
      />

      {sortedRehearsals.length > 0 ? (
        <div className="flex h-full flex-col">
          <div className="mb-4">
            <div className="mb-2 flex justify-between">
              <Caption
                color="muted"
                weight="bold"
                className="uppercase tracking-[0.16em]"
              >
                {t("projects.rehearsals.progress", "Postęp")}
              </Caption>
              <Caption color="muted" weight="bold">
                {pastRehearsals.length} / {sortedRehearsals.length}
              </Caption>
            </div>
            <div className="h-1.5 w-full rounded-full bg-ethereal-incense/10">
              <div
                className="h-1.5 rounded-full bg-ethereal-gold transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <ul className="mt-2 flex-1 space-y-3">
            {upcomingRehearsals.map((rehearsal, index) => {
              const invitedCount = rehearsal.invited_participations?.length || 0;
              const isTutti =
                invitedCount === 0 ||
                invitedCount === projectParticipations.length;
              const absences = rehearsal.absent_count || 0;

              return (
                <li
                  key={rehearsal.id || `reh-${index}`}
                  className="border-b border-ethereal-incense/10 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          rehearsal.is_mandatory
                            ? "bg-ethereal-gold"
                            : "bg-ethereal-crimson"
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
                          <Text color="graphite" className="text-pretty italic">
                            {rehearsal.focus}
                          </Text>
                        )}

                        {absences > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-ethereal-crimson">
                            <UserMinus size={10} aria-hidden="true" />
                            <Caption
                              color="crimson"
                              weight="bold"
                              className="uppercase tracking-[0.16em]"
                            >
                              {t(
                                "projects.rehearsals.absences_reported",
                                "Zgłoszono braki:",
                              )}{" "}
                              {absences}
                            </Caption>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div
                        className={`rounded-full px-2 py-1 ${
                          isTutti
                            ? "bg-ethereal-sage/15 text-ethereal-sage"
                            : "bg-ethereal-amethyst/10 text-ethereal-amethyst"
                        }`}
                      >
                        <Caption
                          weight="bold"
                          color="inherit"
                          className="uppercase tracking-[0.16em]"
                        >
                          {isTutti
                            ? t("projects.rehearsals.tutti", "TUTTI")
                            : t("projects.rehearsals.sectional", "SEKCYJNA")}
                        </Caption>
                      </div>
                      {!rehearsal.is_mandatory && (
                        <Caption
                          color="crimson"
                          weight="bold"
                          className="uppercase tracking-[0.16em]"
                        >
                          {t("projects.rehearsals.optional", "Opcjonalna")}
                        </Caption>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <Text
          color="muted"
          className="flex flex-1 items-center justify-center py-4"
        >
          {t("projects.rehearsals.empty.no_rehearsals", "Brak zaplanowanych prób.")}
        </Text>
      )}
    </GlassCard>
  );
};
