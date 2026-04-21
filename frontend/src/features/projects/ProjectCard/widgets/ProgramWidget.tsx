/**
 * @file ProgramWidget.tsx
 * @description Dashboard widget displaying the concert program and casting fulfillment status.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/widgets/ProgramWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ListOrdered, Music } from "lucide-react";

import type { Project, Piece, VoiceRequirement } from "@/shared/types";
import { useProjectData } from "../../hooks/useProjectData";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Caption, Text } from "@/shared/ui/primitives/typography";

interface ProgramWidgetProps {
  project: Project;
  onEdit?: () => void;
  onOpenMicroCast?: () => void;
}

export function ProgramWidget({
  project,
  onEdit,
  onOpenMicroCast,
}: ProgramWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    pieces,
    pieceCastings,
    participations: projectParticipations,
  } = useProjectData(String(project.id));

  const totalConcertDurationSeconds = useMemo<number>(() => {
    return (
      project.program?.reduce((sum, item) => {
        const pieceId = item.piece_id || item.piece;
        const pieceObj = pieces?.find((p) => String(p.id) === String(pieceId));
        return sum + (pieceObj?.estimated_duration || 0);
      }, 0) || 0
    );
  }, [project.program, pieces]);

  const formatTotalDuration = (totalSeconds: number): string | null => {
    if (!totalSeconds || totalSeconds === 0) return null;
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;

    if (hours > 0)
      return `~ ${hours}h ${remainingMins} ${t("projects.program.music_time_min", "min muzyki")}`;
    return `~ ${minutes} ${t("projects.program.music_time_min", "min muzyki")}`;
  };

  const handleOpenMicroCast = (
    e: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    e.stopPropagation();
    if (onOpenMicroCast) onOpenMicroCast();
  };

  return (
    <GlassCard
      variant="solid"
      padding="md"
      isHoverable={Boolean(onEdit)}
      onClick={onEdit}
      className="flex min-h-56 flex-col justify-between"
      role={onEdit ? "button" : "region"}
      aria-label={t(
        "projects.program.aria_label",
        "Zarządzaj programem koncertu",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-ethereal-incense/10 pb-4">
        <SectionHeader
          title={t("projects.program.title", "Program koncertu")}
          icon={<ListOrdered size={16} aria-hidden="true" />}
          className="mb-0 pb-0"
        />
        {onOpenMicroCast && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenMicroCast}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          >
            Divisi
          </Button>
        )}
      </div>

      {project.program && project.program.length > 0 ? (
        <div className="flex h-full flex-col justify-between">
          <ul className="mb-3 flex-1 space-y-2">
            {[...project.program]
              .sort((a, b) => a.order - b.order)
              .slice(0, 5)
              .map((item, index) => {
                const pieceId = item.piece_id || item.piece;
                const pieceObj: Piece | undefined = pieces?.find(
                  (p) => String(p.id) === String(pieceId),
                );
                const requirements: VoiceRequirement[] =
                  pieceObj?.voice_requirements || [];
                const safeCastings = pieceCastings || [];

                let statusVariant: "success" | "danger" | "neutral" =
                  "neutral";
                let statusText = t("projects.program.no_reqs", "Brak wymagań");

                if (requirements.length > 0) {
                  let missingTotal = 0;
                  requirements.forEach((req) => {
                    const assignedCount = safeCastings.filter(
                      (c) =>
                        String(c.piece) === String(pieceId) &&
                        c.voice_line === req.voice_line &&
                        projectParticipations.some(
                          (p) => String(p.id) === String(c.participation),
                        ),
                    ).length;

                    if (assignedCount < req.quantity) {
                      missingTotal += req.quantity - assignedCount;
                    }
                  });

                  if (missingTotal > 0) {
                    statusVariant = "danger";
                    statusText = t(
                      "projects.program.unfulfilled",
                      "Nieobsadzony",
                    );
                  } else {
                    statusVariant = "success";
                    statusText = t("projects.program.fulfilled", "Obsadzony");
                  }
                }

                return (
                  <li
                    key={item.id || `program-item-${item.piece}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ethereal-incense/10 bg-ethereal-alabaster/60 px-3 py-2"
                  >
                    <Text
                      as="span"
                      size="sm"
                      weight="medium"
                      className="min-w-0 truncate pr-2"
                    >
                      <Text
                        as="span"
                        size="sm"
                        weight="medium"
                        color="muted"
                        className="inline-block w-4"
                      >
                        {index + 1}.
                      </Text>{" "}
                      {item.piece_title || pieceObj?.title}
                    </Text>
                    <Badge variant={statusVariant}>
                      {statusText}
                    </Badge>
                  </li>
                );
              })}

            {project.program.length > 5 && (
              <li className="pt-2 text-center">
                <Caption
                  color="muted"
                  weight="bold"
                  className="uppercase tracking-[0.16em]"
                >
                {t("projects.program.and_more", "...i {{count}} więcej", {
                  count: project.program.length - 5,
                })}
                </Caption>
              </li>
            )}
          </ul>

          <div className="mt-auto flex-shrink-0 border-t border-ethereal-incense/10 pt-3 text-center">
            {totalConcertDurationSeconds > 0 ? (
              <Badge
                variant="brand"
                icon={<Music size={12} aria-hidden="true" />}
              >
                {formatTotalDuration(totalConcertDurationSeconds)}
              </Badge>
            ) : (
              <Caption
                color="muted"
                weight="bold"
                className="uppercase tracking-[0.16em]"
              >
                {t("projects.program.duration_unknown", "Czas nieznany")}
              </Caption>
            )}
          </div>
        </div>
      ) : (
        <Text
          color="muted"
          className="flex flex-1 items-center justify-center py-4 italic"
        >
          {t("projects.program.empty.setlist_title", "Setlista jest pusta.")}
        </Text>
      )}
    </GlassCard>
  );
}
