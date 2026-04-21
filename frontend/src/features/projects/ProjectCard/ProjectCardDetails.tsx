/**
 * @file ProjectCardDetails.tsx
 * @description Production metadata panel for project logistics.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/ProjectCardDetails
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, MapPin, Shirt, UserRound } from "lucide-react";

import type { Project } from "@/shared/types";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import {
  Caption,
  Eyebrow,
  Text,
} from "@/shared/ui/primitives/typography";

interface ProjectCardDetailsProps {
  project: Project;
}

interface DetailArtifactProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const DetailArtifact = ({
  label,
  icon,
  children,
}: DetailArtifactProps): React.JSX.Element => (
  <GlassCard
    variant="light"
    padding="sm"
    isHoverable={false}
    className="h-full border-ethereal-incense/15"
  >
    <div className="mb-3 flex items-center gap-2 text-ethereal-incense/70">
      <div className="text-ethereal-gold" aria-hidden="true">
        {icon}
      </div>
      <Eyebrow color="muted">{label}</Eyebrow>
    </div>
    {children}
  </GlassCard>
);

export function ProjectCardDetails({
  project,
}: ProjectCardDetailsProps): React.JSX.Element {
  const { t } = useTranslation();
  const hasDressCode = Boolean(
    project.dress_code_female || project.dress_code_male,
  );
  const conductorName =
    project.conductor_name?.trim() ||
    (project.conductor && typeof project.conductor === "object"
      ? `${project.conductor.first_name} ${project.conductor.last_name}`.trim()
      : null);

  return (
    <div className="flex h-full flex-col gap-6">
      <SectionHeader
        title={t("projects.details.section_title", "Detale produkcyjne")}
        icon={<AlignLeft size={16} aria-hidden="true" />}
        className="mb-0 pb-4"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {project.location && (
          <DetailArtifact
            label={t("projects.details.location_title", "Miejsce")}
            icon={<MapPin size={16} aria-hidden="true" />}
          >
            <LocationPreview
              locationRef={project.location}
              variant="minimal"
              className="max-w-full justify-start"
            />
          </DetailArtifact>
        )}

        {conductorName && (
          <DetailArtifact
            label={t("projects.details.conductor_title", "Dyrygent")}
            icon={<UserRound size={16} aria-hidden="true" />}
          >
            <Text weight="medium">{conductorName}</Text>
          </DetailArtifact>
        )}
      </div>

      <GlassCard
        variant="light"
        padding="md"
        isHoverable={false}
        className="flex-1 border-ethereal-incense/15"
      >
        <SectionHeader
          title={t("projects.details.description_title", "Opis wydarzenia")}
          icon={<AlignLeft size={16} aria-hidden="true" />}
          className="mb-0 pb-4"
        />
        {project.description?.trim() ? (
          <Text className="whitespace-pre-wrap text-pretty text-ethereal-graphite">
            {project.description}
          </Text>
        ) : (
          <Text color="muted">
            {t(
              "projects.details.no_description",
              "Nie ma żadnych dodatkowych uwag do tego wydarzenia.",
            )}
          </Text>
        )}
      </GlassCard>

      <GlassCard
        variant="light"
        padding="md"
        isHoverable={false}
        className="border-ethereal-incense/15"
      >
        <SectionHeader
          title={t("projects.details.dress_code_title", "Dress Code")}
          icon={<Shirt size={16} aria-hidden="true" />}
          className="mb-0 pb-4"
        />
        {hasDressCode ? (
          <div className="flex flex-wrap gap-3">
            {project.dress_code_female && (
              <GlassCard
                variant="light"
                padding="sm"
                isHoverable={false}
                className="border-ethereal-incense/15"
              >
                <Caption color="muted" weight="bold" className="block uppercase tracking-[0.16em]">
                  {t("projects.details.dress_code_female", "Panie")}
                </Caption>
                <Text weight="medium" className="mt-1">
                  {project.dress_code_female}
                </Text>
              </GlassCard>
            )}
            {project.dress_code_male && (
              <GlassCard
                variant="light"
                padding="sm"
                isHoverable={false}
                className="border-ethereal-incense/15"
              >
                <Caption color="muted" weight="bold" className="block uppercase tracking-[0.16em]">
                  {t("projects.details.dress_code_male", "Panowie")}
                </Caption>
                <Text weight="medium" className="mt-1">
                  {project.dress_code_male}
                </Text>
              </GlassCard>
            )}
          </div>
        ) : (
          <Text color="muted">
            {t(
              "projects.details.no_dress_code",
              "Nie ma wymagań co do ubioru.",
            )}
          </Text>
        )}
      </GlassCard>
    </div>
  );
}
