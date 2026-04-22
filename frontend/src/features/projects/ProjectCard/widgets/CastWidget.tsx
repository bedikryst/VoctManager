/**
 * @file CastWidget.tsx
 * @description Dashboard widget displaying the vocal cast (artists) assigned to a project.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/widgets/CastWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";

import type { Project, Artist } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import {
  useProjectParticipations,
  useProjectArtistsMap,
} from "../../api/project.read.queries";

interface CastWidgetProps {
  project: Project;
  onEdit?: () => void;
}

const DISPLAY_LIMIT = 9;

export function CastWidget({
  project,
  onEdit,
}: CastWidgetProps): React.JSX.Element {
  const { t } = useTranslation();

  const { data: artistMap } = useProjectArtistsMap();
  const { data: projectParticipations } = useProjectParticipations(
    String(project.id),
  );

  const visibleParticipations = projectParticipations.slice(0, DISPLAY_LIMIT);
  const overflowCount = projectParticipations.length - DISPLAY_LIMIT;

  return (
    <GlassCard
      variant="solid"
      padding="md"
      isHoverable={Boolean(onEdit)}
      onClick={onEdit}
      className="flex min-h-56 flex-col justify-between"
      role={onEdit ? "button" : "region"}
      aria-label={t("projects.cast.aria_label", "Zarządzaj obsadą wokalną")}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-ethereal-incense/10 pb-4">
        <SectionHeader
          title={t("projects.cast.title", "Obsada wokalna")}
          icon={<Users size={16} aria-hidden="true" />}
          className="mb-0 pb-0"
        />
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          >
            {t("common.actions.edit", "Edytuj")}
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <div className="mb-2 flex flex-wrap justify-center gap-2">
          {visibleParticipations.map((part, index) => {
            const artist = artistMap.get(String(part.artist));
            if (!artist) return null;

            return (
              <Badge key={part.id || `cast-${index}`} variant="neutral">
                {artist.first_name} {artist.last_name.charAt(0)}.
              </Badge>
            );
          })}

          {overflowCount > 0 && <Badge variant="brand">+{overflowCount}</Badge>}

          {projectParticipations.length === 0 && (
            <Text color="muted" className="italic">
              {t("projects.cast.empty", "Brak obsady wokalnej.")}
            </Text>
          )}
        </div>
      </div>

      <Caption
        color="muted"
        weight="bold"
        className="mt-auto border-t border-ethereal-incense/10 pt-3 text-center uppercase tracking-[0.16em]"
      >
        {t("projects.cast.employed", "Zatrudnionych:")}{" "}
        {projectParticipations.length}
      </Caption>
    </GlassCard>
  );
}
