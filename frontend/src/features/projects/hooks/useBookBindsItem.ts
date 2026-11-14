/**
 * @file useBookBindsItem.ts
 * @description Answers whether a project's score book holds pages for one
 * programme item. A piece's score action asks it first: when the book binds the
 * piece, the whole book opens there, so a rehearsal moves from piece to piece
 * without leaving the stand; otherwise the piece's own edition opens.
 *
 * The caller gates on the singer-facing `has_score_pdf` before asking — the
 * map alone does not say whether this reader may open the book.
 * @module features/projects/hooks
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "../api/project.query-keys";
import { ProjectService } from "../api/project.service";
import { boundItemPage } from "../lib/scoreBookOpening";

export const useBookBindsItem = (): ((projectId: string, order: number) => Promise<boolean>) => {
  const queryClient = useQueryClient();
  return useCallback(
    async (projectId: string, order: number): Promise<boolean> => {
      try {
        // A map already on the device answers at once, and the book refetches
        // it as it opens, so a tap mid-rehearsal never waits on the network.
        const map = await queryClient.ensureQueryData({
          queryKey: projectKeys.scorePackage.map(projectId),
          queryFn: () => ProjectService.getScoreMap(projectId),
          retry: false,
          networkMode: "always",
        });
        return boundItemPage(map, order) !== null;
      } catch {
        // An unreadable map must not strand the reader: the edition still opens.
        return false;
      }
    },
    [queryClient],
  );
};
