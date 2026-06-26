/**
 * @file useSeasonSetup.ts
 * @description Read-model behind the conductor's "First Season" concierge. The
 * three founding steps are *derived from live tenant data* — has a concert been
 * scheduled, have singers been invited, has repertoire been added — rather than
 * stored as duplicate flags that could drift from reality. It rides the exact
 * query keys the admin dashboard already loads, so it adds no network cost. The
 * only persisted state is the server-side `welcome_seen_at` first-run flag (set
 * once via {@link settingsService.markWelcomeSeen}); an unfinished setup simply
 * reappears next session at the next incomplete step. `snooze` hides it for the
 * current session only, without ever stamping the flag.
 * @module features/dashboard/hooks/useSeasonSetup
 */

import { useCallback, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { useAuth } from "@/app/providers/AuthProvider";
import { settingsService } from "@/features/settings/api/settings.service";
import { projectKeys } from "@/features/projects/api/project.queries";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { archiveKeys } from "@/features/archive/api/archive.queries";
import { ProjectService } from "@/features/projects/api/project.service";
import { ArtistService } from "@/features/artists/api/artist.service";
import { ArchiveService } from "@/features/archive/api/archive.service";

export type SeasonStepKey = "concert" | "singers" | "repertoire";

export interface SeasonStep {
  readonly key: SeasonStepKey;
  readonly done: boolean;
}

export interface SeasonSetup {
  /** The concierge should be on screen (first-run, not snoozed, data settled). */
  readonly isActive: boolean;
  readonly steps: readonly SeasonStep[];
  readonly completedCount: number;
  readonly total: number;
  readonly allDone: boolean;
  /** Stamp the first-run flag as complete (idempotent) and settle the user. */
  readonly finish: () => void;
  /** Hide for this session only; reappears next session if still unfinished. */
  readonly snooze: () => void;
  readonly isFinishing: boolean;
}

const WORKSPACE_STALE_TIME = 1000 * 60 * 5;

export const useSeasonSetup = (): SeasonSetup => {
  const { user, refreshUser } = useAuth();
  const [snoozed, setSnoozed] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Same keys + fns as useAdminDashboardData → React Query serves these from the
  // shared cache; the concierge piggybacks on the dashboard's fetch.
  const { hasProjects, hasSingers, hasRepertoire, settled } = useQueries({
    queries: [
      {
        queryKey: projectKeys.projects.all,
        queryFn: ProjectService.getAll,
        staleTime: WORKSPACE_STALE_TIME,
      },
      {
        queryKey: artistKeys.artists.all,
        queryFn: ArtistService.getAll,
        staleTime: WORKSPACE_STALE_TIME,
      },
      {
        queryKey: archiveKeys.pieces.all,
        queryFn: ArchiveService.getPieces,
        staleTime: WORKSPACE_STALE_TIME,
      },
    ],
    combine: (results) => {
      const [projects, artists, pieces] = results;
      const profileId = user?.artist_profile_id;
      return {
        settled: results.every((q) => !q.isPending),
        hasProjects: (projects.data?.length ?? 0) > 0,
        // "Invited singers" = a roster member who isn't the conductor themselves.
        hasSingers: (artists.data ?? []).some(
          (a) => String(a.id) !== String(profileId),
        ),
        hasRepertoire: (pieces.data?.length ?? 0) > 0,
      };
    },
  });

  const steps = useMemo<readonly SeasonStep[]>(
    () => [
      { key: "concert", done: hasProjects },
      { key: "singers", done: hasSingers },
      { key: "repertoire", done: hasRepertoire },
    ],
    [hasProjects, hasSingers, hasRepertoire],
  );

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  const finish = useCallback(() => {
    setIsFinishing(true);
    void settingsService
      .markWelcomeSeen()
      .then(() => refreshUser())
      .catch(() => undefined)
      .finally(() => setIsFinishing(false));
  }, [refreshUser]);

  const snooze = useCallback(() => setSnoozed(true), []);

  const seenAt = user?.profile?.welcome_seen_at ?? null;
  const isActive = Boolean(user) && seenAt === null && !snoozed && settled;

  return {
    isActive,
    steps,
    completedCount,
    total: steps.length,
    allDone,
    finish,
    snooze,
    isFinishing,
  };
};
