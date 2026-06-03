/**
 * @file ProjectPeopleCard.tsx
 * @description Context-rail card merging the former CastWidget and CrewWidget — two
 * cards that shared one chip-cloud pattern and had no reason to stand apart. Renders the
 * vocal cast and the technical crew as two compact sections, each with its own count and
 * deep-link. Each section stays glanceable by default (a capped chip cloud) but expands
 * in place on demand, so a full roster never forces a trip to the work-area tab nor a
 * useless "+N" dead end.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/ProjectPeopleCard
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Users, Wrench, type LucideIcon } from "lucide-react";

import type { Collaborator, Project } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import {
  useProjectArtistsMap,
  useProjectCollaboratorsDictionary,
  useProjectCrewAssignments,
  useProjectParticipations,
} from "../../api/project.read.queries";

interface ProjectPeopleCardProps {
  project: Project;
  onOpenCast?: () => void;
  onOpenCrew?: () => void;
}

const DISPLAY_LIMIT = 8;

interface PersonChip {
  key: string;
  label: string;
}

interface PeopleSectionProps {
  icon: LucideIcon;
  label: string;
  chips: PersonChip[];
  emptyLabel: string;
  ariaLabel: string;
  onOpen?: () => void;
}

const PeopleSection = ({
  icon: Icon,
  label,
  chips,
  emptyLabel,
  ariaLabel,
  onOpen,
}: PeopleSectionProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<boolean>(false);

  const overflow = chips.length - DISPLAY_LIMIT;
  const visible = expanded ? chips : chips.slice(0, DISPLAY_LIMIT);

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onOpen}
        aria-label={ariaLabel}
        className="group -mx-1 flex items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-ethereal-alabaster/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
      >
        <Icon size={14} className="shrink-0 text-ethereal-gold/70" aria-hidden="true" />
        <Caption as="span" color="graphite" weight="bold" className="uppercase tracking-[0.16em]">
          {label}
        </Caption>
        <span className="text-sm font-bold tabular-nums text-ethereal-ink">
          {chips.length}
        </span>
        <ChevronRight
          size={15}
          className="ml-auto shrink-0 text-ethereal-graphite/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ethereal-gold"
          aria-hidden="true"
        />
      </button>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {visible.map((chip) => (
            <Badge key={chip.key} variant="neutral">
              {chip.label}
            </Badge>
          ))}
          {overflow > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              className="inline-flex items-center rounded-md border border-ethereal-incense/30 bg-ethereal-ink/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-ink transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
            >
              {expanded
                ? t("common.actions.collapse", "Zwiń")
                : t("projects.overview.people.show_all", "+{{count}} pokaż", {
                    count: overflow,
                  })}
            </button>
          )}
        </div>
      ) : (
        <Text size="sm" color="muted" className="italic">
          {emptyLabel}
        </Text>
      )}
    </section>
  );
};

export function ProjectPeopleCard({
  project,
  onOpenCast,
  onOpenCrew,
}: ProjectPeopleCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const { data: artistMap } = useProjectArtistsMap();
  const { data: participations } = useProjectParticipations(String(project.id));
  const { data: crewAssignments } = useProjectCrewAssignments(String(project.id));
  const { data: collaborators } = useProjectCollaboratorsDictionary();

  const crewMap = useMemo<Map<string, Collaborator>>(
    () => new Map(collaborators.map((person) => [String(person.id), person])),
    [collaborators],
  );

  const castChips = useMemo<PersonChip[]>(
    () =>
      participations.flatMap((part, index) => {
        const artist = artistMap.get(String(part.artist));
        if (!artist) return [];
        return [
          {
            key: String(part.id || `cast-${index}`),
            label: `${artist.first_name} ${artist.last_name.charAt(0)}.`,
          },
        ];
      }),
    [participations, artistMap],
  );

  const crewChips = useMemo<PersonChip[]>(
    () =>
      crewAssignments.flatMap((assign, index) => {
        const person = crewMap.get(String(assign.collaborator));
        if (!person) return [];
        const roleLabel = assign.role_description || person.specialty.substring(0, 4);
        return [
          {
            key: String(assign.id || `crew-${index}`),
            label: `${person.first_name} ${person.last_name.charAt(0)}. (${roleLabel})`,
          },
        ];
      }),
    [crewAssignments, crewMap],
  );

  return (
    <WidgetCard
      title={t("projects.overview.people.title", "Ludzie")}
      icon={<Users size={15} aria-hidden="true" />}
      bodyClassName="gap-5"
    >
      <PeopleSection
        icon={Users}
        label={t("projects.cast.title", "Obsada wokalna")}
        chips={castChips}
        emptyLabel={t("projects.cast.empty", "Brak obsady wokalnej.")}
        ariaLabel={t("projects.cast.aria_label", "Zarządzaj obsadą wokalną")}
        onOpen={onOpenCast}
      />

      <div className="h-px bg-ethereal-ink/6" aria-hidden="true" />

      <PeopleSection
        icon={Wrench}
        label={t("projects.crew.title", "Ekipa")}
        chips={crewChips}
        emptyLabel={t("projects.crew.empty", "Brak przypisanej ekipy.")}
        ariaLabel={t("projects.crew.aria_label", "Zarządzaj ekipą techniczną")}
        onOpen={onOpenCrew}
      />
    </WidgetCard>
  );
}
