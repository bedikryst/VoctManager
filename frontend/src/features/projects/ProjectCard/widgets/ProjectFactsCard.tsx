/**
 * @file ProjectFactsCard.tsx
 * @description Context-rail card for the Project Overview. Consolidates the bare facts a
 * conductor scans first — concert date/time, venue, what waits at that venue on the day,
 * conductor, estimated budget — plus an optional event note, into one calm definition
 * list. Subsumes the former single-metric BudgetWidget (the cost now lives as one fact
 * among others, not a lone number in a tall card). The whole card deep-links to the
 * Details work area, which is where every one of these is typed.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/ProjectFactsCard
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";

import type { Project } from "@/shared/types";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Eyebrow, Metric, Text, Unit } from "@/shared/ui/primitives/typography";
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
    <Eyebrow as="dt" color="muted">
      {label}
    </Eyebrow>
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

  // Where exactly, once somebody has arrived at the address. Named in the words
  // the Details form uses, because that is the one place these are typed and the
  // card deep-links there. Only what was entered — a row reading "Parking: —"
  // states that a field is empty, which is not a fact about the concert.
  const onsiteNotes = useMemo(
    () =>
      [
        {
          id: "entrance",
          label: t("projects.details_tab.fields.entrance", "Wejście / brama"),
          value: project.entrance_note?.trim(),
        },
        {
          id: "parking",
          label: t("projects.details_tab.fields.parking", "Parking"),
          value: project.parking_note?.trim(),
        },
        {
          id: "dressing_room",
          label: t("projects.details_tab.fields.dressing_room", "Garderoba"),
          value: project.dressing_room_note?.trim(),
        },
      ].filter((note): note is typeof note & { value: string } =>
        Boolean(note.value),
      ),
    [
      project.entrance_note,
      project.parking_note,
      project.dressing_room_note,
      t,
    ],
  );

  // One row, because a name and a number are one person to call — the same
  // grouping the change notification makes of the same two columns.
  const contactName = project.onsite_contact_name?.trim() || "";
  const contactPhone = project.onsite_contact_phone?.trim() || "";

  return (
    <SectionCard
      title={t("projects.overview.facts.title", "Szczegóły")}
      icon={<Info size={15} aria-hidden="true" />}
      onActivate={onEdit}
      ariaLabel={t("projects.overview.facts.aria", "Edytuj szczegóły wydarzenia")}
      bodyClassName="py-2"
    >
      <dl className="divide-y divide-hairline">
        <FactRow label={t("projects.overview.facts.when", "Termin")}>
          {project.date_time ? (
            /* Date and time are one datum, so they share a size. At `sm` over
               `base` the clock came out larger than the day it belongs to and
               read as an emphasis nobody intended. */
            <div className="flex flex-col gap-0.5">
              <Text size="base" weight="medium">
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
                orientation="row"
                spacing="compact"
                size="base"
                weight="medium"
                local="paired"
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

        {onsiteNotes.map((note) => (
          <FactRow key={note.id} label={note.label}>
            <Text
              size="sm"
              weight="medium"
              className="whitespace-pre-wrap text-pretty"
            >
              {note.value}
            </Text>
          </FactRow>
        ))}

        {(contactName || contactPhone) && (
          <FactRow
            label={t(
              "projects.overview.facts.onsite_contact",
              "Kontakt na miejscu",
            )}
          >
            <div className="flex flex-col gap-0.5">
              {contactName && (
                <Text size="sm" weight="medium">
                  {contactName}
                </Text>
              )}
              {/* Stated, not dialled. The whole card is one control that opens
                  Details, so an anchor here would follow its own href AND
                  navigate the card away underneath it; the tap-to-call belongs
                  to the surfaces the singer reads (`OnSiteFacts`). */}
              {contactPhone && (
                <Text size="sm" weight="medium" color="graphite">
                  {contactPhone}
                </Text>
              )}
            </div>
          </FactRow>
        )}

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
            <Unit>{t("common.currency", "PLN")}</Unit>
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
    </SectionCard>
  );
}
