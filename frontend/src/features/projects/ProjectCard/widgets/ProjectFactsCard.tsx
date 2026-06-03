/**
 * @file ProjectFactsCard.tsx
 * @description Context-rail card for the Project Overview. Consolidates the bare facts a
 * conductor scans first — concert date/time, venue, conductor, estimated budget — plus an
 * optional event note, into one calm definition list. Subsumes the former single-metric
 * BudgetWidget (the cost now lives as one fact among others, not a lone number in a tall
 * card). The whole card deep-links to the Details work area.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/ProjectFactsCard
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";

import type { Project } from "@/shared/types";
import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Caption, Metric, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import {
  useProjectCrewAssignments,
  useProjectParticipations,
} from "../../api/project.read.queries";
import { getArtistDisplayName } from "../../lib/projectPresentation";

interface ProjectFactsCardProps {
  project: Project;
  onEdit?: () => void;
}

interface FactRowProps {
  label: string;
  children: React.ReactNode;
}

const FactRow = ({ label, children }: FactRowProps): React.JSX.Element => (
  <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
    <Caption
      as="dt"
      color="muted"
      weight="bold"
      className="uppercase tracking-[0.16em]"
    >
      {label}
    </Caption>
    <dd className="min-w-0">{children}</dd>
  </div>
);

export function ProjectFactsCard({
  project,
  onEdit,
}: ProjectFactsCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const { data: participations } = useProjectParticipations(String(project.id));
  const { data: crewAssignments } = useProjectCrewAssignments(
    String(project.id),
  );

  const totalBudget = useMemo<number>(() => {
    const artists = participations.reduce(
      (sum, p) => sum + (Number(p.fee) || 0),
      0,
    );
    const crew = crewAssignments.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
    return artists + crew;
  }, [participations, crewAssignments]);

  const formattedBudget = useMemo(
    () =>
      new Intl.NumberFormat(t("common.locale", "pl-PL"), {
        maximumFractionDigits: 0,
      }).format(totalBudget),
    [t, totalBudget],
  );

  const conductorName = getArtistDisplayName(
    project.conductor,
    project.conductor_name,
  );
  const dash = "—";

  return (
    <WidgetCard
      title={t("projects.overview.facts.title", "Szczegóły")}
      icon={<Info size={15} aria-hidden="true" />}
      onActivate={onEdit}
      ariaLabel={t("projects.overview.facts.aria", "Edytuj szczegóły wydarzenia")}
      bodyClassName="py-2"
    >
      <dl className="divide-y divide-ethereal-ink/5">
        <FactRow label={t("projects.overview.facts.when", "Termin")}>
          {project.date_time ? (
            <div className="flex flex-col gap-0.5">
              <Text size="sm" weight="medium">
                {formatLocalizedDate(
                  project.date_time,
                  { weekday: "long", day: "numeric", month: "long", year: "numeric" },
                  undefined,
                  project.timezone,
                )}
              </Text>
              <DualTimeDisplay
                value={project.date_time}
                timeZone={project.timezone}
                containerClassName="inline-flex items-center gap-1"
                primaryTimeClassName="inline-flex items-center gap-1 text-sm font-medium text-ethereal-ink"
                localTimeClassName="pl-1 text-xs font-medium normal-case tracking-normal text-ethereal-graphite"
              />
            </div>
          ) : (
            <Text size="sm" color="muted">
              {t("projects.hub.no_date", "Termin nieustalony")}
            </Text>
          )}
        </FactRow>

        <FactRow label={t("projects.overview.facts.venue", "Miejsce")}>
          {project.location ? (
            <LocationPreview
              locationRef={project.location}
              variant="minimal"
              className="justify-start"
            />
          ) : (
            <Text size="sm" color="muted">
              {dash}
            </Text>
          )}
        </FactRow>

        <FactRow label={t("projects.overview.facts.conductor", "Dyrygent")}>
          <Text size="sm" weight="medium" color={conductorName ? "default" : "muted"}>
            {conductorName || dash}
          </Text>
        </FactRow>

        <FactRow label={t("projects.budget.estimated_cost", "Przewidywany koszt")}>
          <div className="flex items-baseline gap-1.5">
            <Metric as="span" className="text-2xl leading-none text-ethereal-gold">
              {formattedBudget}
            </Metric>
            <Text as="span" className="text-xs font-medium text-ethereal-graphite/55">
              {t("common.currency", "PLN")}
            </Text>
          </div>
        </FactRow>

        {project.description?.trim() && (
          <FactRow label={t("projects.details.description_title", "Opis wydarzenia")}>
            <Text
              size="sm"
              color="graphite"
              className="line-clamp-4 whitespace-pre-wrap text-pretty leading-relaxed"
            >
              {project.description}
            </Text>
          </FactRow>
        )}
      </dl>
    </WidgetCard>
  );
}
