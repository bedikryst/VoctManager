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
  /**
   * The programme exists but its readiness was withheld by the server — a
   * manager previewing a member's view. Callers must say so rather than draw
   * the ring at 0/N: nought would report "knows nothing" about a person who may
   * well know every note.
   */
  isWithheld: boolean;
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
    // Withheld arrives as null on every piece at once (the query drops the
    // prefetch entirely), so one null is the whole programme's answer.
    const isWithheld =
      total > 0 &&
      (item?.program.every((pi) => pi.piece.my_readiness === null) ?? false);

    return {
      ready,
      total,
      pct: total > 0 ? Math.round((ready / total) * 100) : 0,
      isLoading: enabled && isLoading,
      hasData: total > 0,
      isWithheld,
    };
  }, [data, projectId, isLoading, enabled]);
};
