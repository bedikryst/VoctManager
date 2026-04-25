import React from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, Shirt } from "lucide-react";

import type { Project } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Caption, Text } from "@/shared/ui/primitives/typography";

interface ProjectCardDetailsProps {
  project: Project;
}

export function ProjectCardDetails({
  project,
}: ProjectCardDetailsProps): React.JSX.Element {
  const { t } = useTranslation();
  const hasDressCode = Boolean(
    project.dress_code_female || project.dress_code_male,
  );

  return (
    <div className="flex h-full flex-col gap-4">
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
              <div className="min-w-0 flex-1">
                <Caption
                  color="muted"
                  weight="bold"
                  className="mb-1 block uppercase tracking-[0.16em]"
                >
                  {t("projects.details.dress_code_female", "Panie")}
                </Caption>
                <Text weight="medium">{project.dress_code_female}</Text>
              </div>
            )}
            {project.dress_code_male && (
              <div className="min-w-0 flex-1">
                <Caption
                  color="muted"
                  weight="bold"
                  className="mb-1 block uppercase tracking-[0.16em]"
                >
                  {t("projects.details.dress_code_male", "Panowie")}
                </Caption>
                <Text weight="medium">{project.dress_code_male}</Text>
              </div>
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
