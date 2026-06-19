/**
 * @file useProjectReadiness.ts
 * @description Derives the chorister's personal practice-readiness for one
 * project's programme from the Materials dashboard (the same source the Songbook
 * writes to). Closes the loop schedule → practice → rehearsal without any new
 * backend: "4 / 7 partii gotowych" right where you plan your time.
 */

import { useMemo } from "react";

import { useArtistMaterialsDashboard } from "@/features/materials/api/materials.queries";

export interface ProjectReadiness {
  ready: number;
  total: number;
  pct: number;
  isLoading: boolean;
  hasData: boolean;
}

export const useProjectReadiness = (
  projectId: string | number,
  enabled: boolean,
): ProjectReadiness => {
  const { data = [], isLoading } = useArtistMaterialsDashboard(enabled);

  return useMemo(() => {
    const item = data.find(
      (entry) => String(entry.project.id) === String(projectId),
    );
    const total = item?.program.length ?? 0;
    const ready =
      item?.program.filter((pi) => pi.piece.my_readiness === "READY").length ??
      0;

    return {
      ready,
      total,
      pct: total > 0 ? Math.round((ready / total) * 100) : 0,
      isLoading: enabled && isLoading,
      hasData: total > 0,
    };
  }, [data, projectId, isLoading, enabled]);
};
