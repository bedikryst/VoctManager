/**
 * @file useMicroCasting.ts
 * @description State controller for the Micro-Casting Kanban board.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useMicroCasting
 */

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";

import type { Artist, PieceCasting } from "../../../../shared/types";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import {
  useProjectPieceCastings,
  useProjectProgram,
  useProjectVoiceLinesDictionary,
} from "../../api/project.queries";
import { ProjectService } from "../../api/project.service";
import { useProjectData } from "../../hooks/useProjectData";

export const useMicroCasting = (projectId: string) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { artists, pieces, participations } = useProjectData(projectId);
  const { data: voiceLines = [] } = useProjectVoiceLinesDictionary();
  const { data: program = [] } = useProjectProgram(projectId);
  const { data: pieceCastings = [] } = useProjectPieceCastings(projectId);

  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [localCastings, setLocalCastings] = useState<PieceCasting[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const projectParticipations = useMemo(
    () =>
      participations.filter(
        (participation) => String(participation.project) === String(projectId),
      ),
    [participations, projectId],
  );

  const artistMap = useMemo(() => {
    const map = new Map<string, Artist>();
    projectParticipations.forEach((participation) => {
      const artist = artists.find(
        (candidate) => String(candidate.id) === String(participation.artist),
      );
      if (artist) map.set(String(participation.id), artist);
    });
    return map;
  }, [projectParticipations, artists]);

  useEffect(() => {
    if (program.length > 0 && !selectedPieceId)
      setSelectedPieceId(String(program[0].piece));
  }, [program, selectedPieceId]);

  const globalCastingsForPiece = useMemo(() => {
    if (!selectedPieceId) return [];
    return pieceCastings.filter(
      (casting) =>
        String(casting.piece) === String(selectedPieceId) &&
        projectParticipations.some(
          (participation) =>
            String(participation.id) === String(casting.participation),
        ),
    );
  }, [pieceCastings, selectedPieceId, projectParticipations]);

  useEffect(() => {
    setLocalCastings(globalCastingsForPiece);
  }, [globalCastingsForPiece]);

  const pieceStatuses = useMemo(() => {
    const statuses: Record<string, "FREE" | "OK" | "DEFICIT"> = {};
    program.forEach((item) => {
      const pieceId = String(item.piece);
      const piece = pieces.find(
        (candidate) => String(candidate.id) === pieceId,
      );
      const requirements = piece?.voice_requirements || [];

      if (requirements.length === 0) {
        statuses[pieceId] = "FREE";
        return;
      }

      let missing = 0;
      requirements.forEach((requirement) => {
        const assigned = pieceCastings.filter(
          (casting) =>
            String(casting.piece) === pieceId &&
            casting.voice_line === requirement.voice_line,
        ).length;
        if (assigned < requirement.quantity)
          missing += requirement.quantity - assigned;
      });
      statuses[pieceId] = missing > 0 ? "DEFICIT" : "OK";
    });
    return statuses;
  }, [program, pieces, pieceCastings]);

  const handleUpdateNote = async (
    castingId: string,
    newNote: string,
  ): Promise<void> => {
    const previousCastings = [...localCastings];
    setLocalCastings((previous) =>
      previous.map((casting) =>
        String(casting.id) === castingId
          ? { ...casting, notes: newNote }
          : casting,
      ),
    );

    try {
      await ProjectService.updatePieceCasting(castingId, { notes: newNote });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.pieceCastings.all,
      });
    } catch {
      setLocalCastings(previousCastings);
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        description: t(
          "projects.micro_cast.toast.note_error",
          "Nie udało się zaktualizować notatki.",
        ),
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) =>
    setActiveDragId(String(event.active.id));

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveDragId(null);
    const { over, active } = event;
    if (!over) return;

    const participationId = String(active.id);
    const targetVoiceLineId = String(over.id);
    const existingCasting = localCastings.find(
      (casting) => String(casting.participation) === participationId,
    );

    if (
      targetVoiceLineId !== "UNASSIGNED" &&
      existingCasting?.voice_line === targetVoiceLineId
    )
      return;
    if (targetVoiceLineId === "UNASSIGNED" && !existingCasting) return;

    const previousCastings = [...localCastings];
    let nextCastings = [...localCastings];

    if (targetVoiceLineId === "UNASSIGNED") {
      nextCastings = nextCastings.filter(
        (casting) => String(casting.participation) !== participationId,
      );
    } else {
      const targetVoiceLine = targetVoiceLineId as PieceCasting["voice_line"];
      if (existingCasting) {
        nextCastings = nextCastings.map((casting) =>
          String(casting.participation) === participationId
            ? { ...casting, voice_line: targetVoiceLine }
            : casting,
        );
      } else {
        nextCastings.push({
          id: `temp-${Date.now()}`,
          participation: participationId,
          piece: selectedPieceId as string,
          voice_line: targetVoiceLine,
          gives_pitch: false,
        } as PieceCasting);
      }
    }
    setLocalCastings(nextCastings);

    try {
      if (targetVoiceLineId === "UNASSIGNED") {
        if (existingCasting?.id)
          await ProjectService.deletePieceCasting(existingCasting.id);
      } else {
        const targetVoiceLine = targetVoiceLineId as PieceCasting["voice_line"];
        if (
          existingCasting?.id &&
          !String(existingCasting.id).startsWith("temp-")
        ) {
          await ProjectService.updatePieceCasting(existingCasting.id, {
            voice_line: targetVoiceLine,
          });
        } else {
          await ProjectService.createPieceCasting({
            participation: participationId,
            piece: selectedPieceId as string,
            voice_line: targetVoiceLine,
            gives_pitch: false,
          });
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.pieceCastings.all,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.program.all }),
      ]);
    } catch {
      setLocalCastings(previousCastings);
      toast.error(
        t("projects.micro_cast.toast.sync_error", "Błąd synchronizacji"),
        {
          description: t(
            "projects.micro_cast.toast.sync_error_desc",
            "Nie udało się zaktualizować obsady.",
          ),
        },
      );
    }
  };

  return {
    program,
    voiceLines,
    pieces,
    selectedPieceId,
    setSelectedPieceId,
    localCastings,
    activeDragId,
    artistMap,
    pieceStatuses,
    projectParticipations,
    handleUpdateNote,
    handleDragStart,
    handleDragEnd,
  };
};
