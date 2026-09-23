/**
 * @file ProjectFactsCard.tsx
 * @description Context-rail card for the Project Overview. Consolidates the bare facts a
 * conductor scans first — concert date/time, venue, what waits at that venue on the day,
 * conductor, project leader, the cost in fees — plus an optional event note, into one calm
 * definition list. The cost is the finance summary's own figure, summed by the server in
 * Decimal and printed in Polish format whatever the interface language; the card adds
 * nothing up. The whole card deep-links to the Details work area, which is where the rest
 * of these facts are typed.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/ProjectFactsCard
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";

import type { Project } from "@/shared/types";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Caption, Eyebrow, Metric, Text, Unit } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { useProjectBudget } from "@/features/finance/api/finance.queries";
import { formatAmount } from "@/features/finance/lib/money";
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

  const { data: budget } = useProjectBudget(String(project.id));
  const cost = budget ? formatAmount(budget.summary.committed) : null;
  const unpriced = budget?.summary.unpriced ?? 0;

  const conductorName = getArtistDisplayName(
    project.conductor,
    project.conductor_name,
  );
  const leaderNames = (project.leaders ?? [])
    .map((leader) => leader.name)
    .join(", ");
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

        {/* A fact, not a control: who runs the rehearsals in the conductor's
            place is appointed on the Rehearsals tab. */}
        <FactRow label={t("projects.overview.facts.leader", "Asystent dyrygenta")}>
          <Text size="sm" weight="medium" color={leaderNames ? "default" : "muted"}>
            {leaderNames || dash}
          </Text>
        </FactRow>

        <FactRow label={t("finance.facts.cost", "Koszt honorariów")}>
          {cost === null ? (
            <Text size="sm" color="muted">
              {dash}
            </Text>
          ) : (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <Metric as="span" className="text-2xl leading-none text-ethereal-gold">
                  {cost}
                </Metric>
                <Unit>{t("common.currency", "PLN")}</Unit>
              </div>
              {/* The figure understates while someone is unpriced; the card
                  says by how many people, and only when it does. */}
              {unpriced > 0 && (
                <Caption color="gold">
                  {t("finance.facts.unpriced", "bez stawki: {{count}} os.", {
                    count: unpriced,
                  })}
                </Caption>
              )}
            </div>
          )}
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
