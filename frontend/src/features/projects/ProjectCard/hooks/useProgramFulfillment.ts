/**
 * @file useProgramFulfillment.ts
 * @description Hook managing complex business logic for project casting fulfillment and duration.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/hooks/useProgramFulfillment
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Project, VoiceRequirement } from "@/shared/types";
import {
  useProjectPiecesDictionary,
  useProjectPieceCastings,
  useProjectParticipations,
} from "../../api/project.read.queries";

export interface EnrichedProgramItem {
  id: string | number;
  pieceId: string;
  title: string;
  order: number;
  statusVariant: "success" | "danger" | "neutral";
  statusText: string;
}

export const useProgramFulfillment = (project: Project) => {
  const { t } = useTranslation();
  const { data: piecesList = [] } = useProjectPiecesDictionary();
  const { data: pieceCastings = [] } = useProjectPieceCastings(
    String(project.id),
  );
  const { data: projectParticipations = [] } = useProjectParticipations(
    String(project.id),
  );

  const piecesMap = useMemo(
    () => new Map(piecesList.map((piece) => [String(piece.id), piece])),
    [piecesList],
  );

  const participationIds = useMemo(
    () => new Set(projectParticipations.map((p) => String(p.id))),
    [projectParticipations],
  );

  const totalConcertDurationSeconds = useMemo<number>(() => {
    if (!project.program) return 0;
    return project.program.reduce((sum, item) => {
      const pieceId = item.piece_id || item.piece;
      const pieceObj = piecesMap.get(String(pieceId));
      return sum + (pieceObj?.estimated_duration || 0);
    }, 0);
  }, [project.program, piecesMap]);

  const formatTotalDuration = (totalSeconds: number): string | null => {
    if (!totalSeconds || totalSeconds === 0) return null;
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;

    if (hours > 0) {
      return `~ ${hours}h ${remainingMins} ${t("projects.program.music_time_min", "min muzyki")}`;
    }
    return `~ ${minutes} ${t("projects.program.music_time_min", "min muzyki")}`;
  };

  const enrichedProgram = useMemo<EnrichedProgramItem[]>(() => {
    if (!project.program) return [];

    return [...project.program]
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const pieceId = String(item.piece_id || item.piece);
        const pieceObj = piecesMap.get(pieceId);
        const requirements: VoiceRequirement[] =
          pieceObj?.voice_requirements || [];

        let statusVariant: "success" | "danger" | "neutral" = "neutral";
        let statusText = t("projects.program.no_reqs", "Brak wymagań");

        if (requirements.length > 0) {
          let missingTotal = 0;
          requirements.forEach((req) => {
            const assignedCount = pieceCastings.filter(
              (c) =>
                String(c.piece) === pieceId &&
                c.voice_line === req.voice_line &&
                participationIds.has(String(c.participation)),
            ).length;

            if (assignedCount < req.quantity) {
              missingTotal += req.quantity - assignedCount;
            }
          });

          if (missingTotal > 0) {
            statusVariant = "danger";
            statusText = t("projects.program.unfulfilled", "Nieobsadzony");
          } else {
            statusVariant = "success";
            statusText = t("projects.program.fulfilled", "Obsadzony");
          }
        }

        return {
          id: item.id || `program-item-${pieceId}-${item.order}`,
          pieceId,
          title: item.piece_title || pieceObj?.title || "",
          order: item.order,
          statusVariant,
          statusText,
        };
      });
  }, [project.program, piecesMap, pieceCastings, participationIds, t]);

  return {
    enrichedProgram,
    formattedDuration: formatTotalDuration(totalConcertDurationSeconds),
    hasDuration: totalConcertDurationSeconds > 0,
  };
};
