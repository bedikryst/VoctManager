/**
 * @file useMaterialsData.ts
 * @description Encapsulates enrichment and memoized grouping for the Materials domain.
 */

import { useMemo } from "react";
import { useMaterialsContextData } from "../api/materials.queries";
import type {
  EnrichedPiece,
  ProjectMaterialGroup,
} from "../types/materials.dto";

export const useMaterialsData = (
  userId?: string | number,
  searchQuery: string = "",
) => {
  const {
    projects,
    myParticipations,
    programItems,
    pieceCastings,
    pieces,
    composers,
    tracks,
    isLoading,
    isError,
  } = useMaterialsContextData(userId);

  const groupedMaterials = useMemo<ProjectMaterialGroup[]>(() => {
    if (!userId || myParticipations.length === 0) {
      return [];
    }

    const activeParticipations = myParticipations.filter(
      (participation) => participation.status !== "DEC",
    );
    const myProjectIds = activeParticipations.map((participation) =>
      String(participation.project),
    );
    const myProjects = projects.filter(
      (project) =>
        myProjectIds.includes(String(project.id)) && project.status !== "CANC",
    );

    const groups = myProjects
      .map((project) => {
        const participation = activeParticipations.find(
          (candidate) => String(candidate.project) === String(project.id),
        );

        if (!participation) {
          return null;
        }

        const projectProgram = programItems
          .filter(
            (programItem) => String(programItem.project) === String(project.id),
          )
          .sort((left, right) => left.order - right.order);

        const enrichedPieces = projectProgram
          .map((programItem) => {
            const piece = pieces.find(
              (candidate) => String(candidate.id) === String(programItem.piece),
            );

            if (!piece) {
              return null;
            }

            const composerData =
              composers.find(
                (composer) => String(composer.id) === String(piece.composer),
              ) || null;

            const allCastingsForPiece = pieceCastings.filter((casting) => {
              return (
                String(casting.piece) === String(piece.id) &&
                String(
                  (casting as typeof casting & { project_id?: string | number })
                    .project_id,
                ) === String(project.id)
              );
            });

            const myCasting =
              allCastingsForPiece.find(
                (casting) =>
                  String(casting.participation) === String(participation.id),
              ) || null;

            let pieceTracks = tracks.filter(
              (track) => String(track.piece) === String(piece.id),
            );

            if (myCasting) {
              pieceTracks = pieceTracks.sort((left, right) => {
                const leftIsMine = left.voice_part === myCasting.voice_line;
                const rightIsMine = right.voice_part === myCasting.voice_line;
                return leftIsMine === rightIsMine ? 0 : leftIsMine ? -1 : 1;
              });
            }

            return {
              ...piece,
              composerData,
              myCasting,
              allCastings: allCastingsForPiece,
              tracks: pieceTracks,
            } as EnrichedPiece;
          })
          .filter(Boolean) as EnrichedPiece[];

        return { project, participation, pieces: enrichedPieces };
      })
      .filter(Boolean) as ProjectMaterialGroup[];

    return groups.sort((left, right) => {
      if (left.project.status !== "DONE" && right.project.status === "DONE") {
        return -1;
      }

      if (left.project.status === "DONE" && right.project.status !== "DONE") {
        return 1;
      }

      return (
        new Date(left.project.date_time).getTime() -
        new Date(right.project.date_time).getTime()
      );
    });
  }, [
    composers,
    myParticipations,
    pieceCastings,
    pieces,
    programItems,
    projects,
    tracks,
    userId,
  ]);

  const filteredGroups = useMemo<ProjectMaterialGroup[]>(() => {
    if (!searchQuery) {
      return groupedMaterials;
    }

    const term = searchQuery.toLowerCase();

    return groupedMaterials
      .map((group) => {
        const filteredPieces = group.pieces.filter((piece) => {
          return (
            piece.title.toLowerCase().includes(term) ||
            (piece.composerData?.last_name || "").toLowerCase().includes(term)
          );
        });

        return { ...group, pieces: filteredPieces };
      })
      .filter((group) => group.pieces.length > 0);
  }, [groupedMaterials, searchQuery]);

  return { isLoading, isError, filteredGroups };
};
