/**
 * @file useMicroCasting.ts
 * @description State controller for the Micro-Casting Kanban board.
 * Fully leverages React Query mutations and optimistic UI updates.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useMicroCasting
 */

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { toast } from "sonner";

import type {
  Artist,
  Participation,
  ParticipationStatus,
  Piece,
  PieceCasting,
  ProgramItem,
  VoiceLineOption,
} from "@/shared/types";
import {
  useCreatePieceCasting,
  useDeletePieceCasting,
  useProjectArtistsDictionary,
  useProjectParticipations,
  useProjectPieceCastings,
  useProjectPiecesDictionary,
  useProjectProgram,
  useProjectVoiceLinesDictionary,
  useUpdatePieceCasting,
} from "../../api/project.queries";

export type PieceCastingStatus = "FREE" | "OK" | "DEFICIT";

export interface UseMicroCastingResult {
  program: ProgramItem[];
  voiceLines: VoiceLineOption[];
  pieces: Piece[];
  selectedPieceId: string | null;
  setSelectedPieceId: Dispatch<SetStateAction<string | null>>;
  localCastings: PieceCasting[];
  activeDragId: string | null;
  artistMap: Map<string, Artist>;
  participationStatusMap: Map<string, ParticipationStatus>;
  pieceStatuses: Record<string, PieceCastingStatus>;
  projectParticipations: Participation[];
  handleUpdateNote: (castingId: string, newNote: string) => Promise<void>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

export const useMicroCasting = (projectId: string): UseMicroCastingResult => {
  const { t } = useTranslation();

  const { data: artists } = useProjectArtistsDictionary();
  const { data: pieces } = useProjectPiecesDictionary();
  const { data: participations } = useProjectParticipations(projectId);
  const { data: voiceLines } = useProjectVoiceLinesDictionary();
  const { data: program } = useProjectProgram(projectId);
  const { data: pieceCastings } = useProjectPieceCastings(projectId);

  const createMutation = useCreatePieceCasting(projectId);
  const updateMutation = useUpdatePieceCasting(projectId);
  const deleteMutation = useDeletePieceCasting(projectId);

  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [localCastings, setLocalCastings] = useState<PieceCasting[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const artistDictionary = useMemo(
    () => new Map(artists.map((artist) => [String(artist.id), artist])),
    [artists],
  );

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
      const artist = artistDictionary.get(String(participation.artist));

      if (artist) {
        map.set(String(participation.id), artist);
      }
    });

    return map;
  }, [artistDictionary, projectParticipations]);

  const participationStatusMap = useMemo(() => {
    const map = new Map<string, ParticipationStatus>();
    projectParticipations.forEach((participation) => {
      map.set(String(participation.id), participation.status);
    });
    return map;
  }, [projectParticipations]);

  useEffect(() => {
    if (program.length > 0 && !selectedPieceId) {
      setSelectedPieceId(String(program[0].piece));
    }
  }, [program, selectedPieceId]);

  const globalCastingsForPiece = useMemo(() => {
    if (!selectedPieceId) {
      return [];
    }

    return pieceCastings.filter(
      (casting) =>
        String(casting.piece) === String(selectedPieceId) &&
        projectParticipations.some(
          (participation) =>
            String(participation.id) === String(casting.participation),
        ),
    );
  }, [pieceCastings, projectParticipations, selectedPieceId]);

  useEffect(() => {
    setLocalCastings(globalCastingsForPiece);
  }, [globalCastingsForPiece]);

  const pieceStatuses = useMemo<Record<string, PieceCastingStatus>>(() => {
    const statuses: Record<string, PieceCastingStatus> = {};

    program.forEach((item) => {
      const pieceId = String(item.piece);
      const piece = pieces.find((candidate) => String(candidate.id) === pieceId);
      const requirements = piece?.voice_requirements ?? [];

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

        if (assigned < requirement.quantity) {
          missing += requirement.quantity - assigned;
        }
      });

      statuses[pieceId] = missing > 0 ? "DEFICIT" : "OK";
    });

    return statuses;
  }, [pieceCastings, pieces, program]);

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
      await updateMutation.mutateAsync({
        id: castingId,
        data: { notes: newNote },
      });
    } catch {
      setLocalCastings(previousCastings);
      toast.error(t("common.errors.save_error", "BĹ‚Ä…d zapisu"), {
        description: t(
          "projects.micro_cast.toast.note_error",
          "Nie udaĹ‚o siÄ™ zaktualizowaÄ‡ notatki.",
        ),
      });
    }
  };

  const handleDragStart = (event: DragStartEvent): void => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveDragId(null);

    const { active, over } = event;

    if (!over || !selectedPieceId) {
      return;
    }

    const participationId = String(active.id);

    const draggedParticipation = projectParticipations.find(
      (p) => String(p.id) === participationId,
    );
    if (draggedParticipation && draggedParticipation.status !== "CON") {
      return;
    }
    const targetVoiceLineId = String(over.id);
    const existingCasting = localCastings.find(
      (casting) => String(casting.participation) === participationId,
    );

    if (
      targetVoiceLineId !== "UNASSIGNED" &&
      existingCasting?.voice_line === targetVoiceLineId
    ) {
      return;
    }

    if (targetVoiceLineId === "UNASSIGNED" && !existingCasting) {
      return;
    }

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
        const optimisticCasting: PieceCasting = {
          id: `temp-${Date.now()}`,
          participation: participationId,
          piece: selectedPieceId,
          voice_line: targetVoiceLine,
          gives_pitch: false,
        };

        nextCastings.push(optimisticCasting);
      }
    }

    setLocalCastings(nextCastings);

    try {
      if (targetVoiceLineId === "UNASSIGNED") {
        if (existingCasting?.id) {
          await deleteMutation.mutateAsync(String(existingCasting.id));
        }

        return;
      }

      const targetVoiceLine = targetVoiceLineId as PieceCasting["voice_line"];

      if (
        existingCasting?.id &&
        !String(existingCasting.id).startsWith("temp-")
      ) {
        await updateMutation.mutateAsync({
          id: String(existingCasting.id),
          data: { voice_line: targetVoiceLine },
        });

        return;
      }

      await createMutation.mutateAsync({
        participation: participationId,
        piece: selectedPieceId,
        voice_line: targetVoiceLine,
        gives_pitch: false,
      });
    } catch {
      setLocalCastings(previousCastings);
      toast.error(
        t("projects.micro_cast.toast.sync_error", "BĹ‚Ä…d synchronizacji"),
        {
          description: t(
            "projects.micro_cast.toast.sync_error_desc",
            "Nie udaĹ‚o siÄ™ zaktualizowaÄ‡ obsady.",
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
    participationStatusMap,
    pieceStatuses,
    projectParticipations,
    handleUpdateNote,
    handleDragStart,
    handleDragEnd,
  };
};
