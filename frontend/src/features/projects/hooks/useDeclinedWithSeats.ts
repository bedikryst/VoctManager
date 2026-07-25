/**
 * @file useDeclinedWithSeats.ts
 * @description Who declined the project after already being cast on a piece.
 *
 * Their seats are deliberately left standing — a declined singer on a voice line
 * keeps counting towards that piece's deficit, so the hole stays visible instead of
 * silently reading as filled. What was missing is anyone *telling* the conductor it
 * happened: the decline reaches managers through the digest, and the gap itself is
 * only visible to someone who opens the divisi board. This is the signal the hub
 * header shows.
 *
 * Derived from the two lists the hub already prefetches rather than a new endpoint,
 * and with plain queries rather than the tabs' suspense hooks — the header must
 * render at once and never suspend the shell.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/hooks
 */

import { useQuery } from "@tanstack/react-query";
import type { Participation, PieceCasting } from "@/shared/types";

import { projectKeys } from "../api/project.query-keys";
import {
  FAST_CHANGING_STALE_TIME,
  PROJECT_RELATION_STALE_TIME,
} from "../api/project.query-utils";
import { ProjectService } from "../api/project.service";

/** Names of cast members who declined while still holding at least one part. */
export const useDeclinedWithSeats = (projectId: string): string[] => {
  const { data: participations = [] } = useQuery({
    queryKey: projectKeys.participations.byProject(projectId),
    queryFn: () => ProjectService.getParticipationsByProject(projectId),
    enabled: Boolean(projectId),
    staleTime: PROJECT_RELATION_STALE_TIME,
  });
  const { data: castings = [] } = useQuery({
    queryKey: projectKeys.pieceCastings.byProject(projectId),
    queryFn: () => ProjectService.getPieceCastingsByProject(projectId),
    enabled: Boolean(projectId),
    staleTime: FAST_CHANGING_STALE_TIME,
  });

  const declined = new Map<string, string>(
    (participations as Participation[])
      .filter((p) => p.status === "DEC")
      .map((p) => [String(p.id), p.artist_name ?? ""]),
  );
  if (declined.size === 0) return [];

  const seated = new Set(
    (castings as PieceCasting[])
      .map((casting) => String(casting.participation))
      .filter((participationId) => declined.has(participationId)),
  );

  return [...seated]
    .map((participationId) => declined.get(participationId) ?? "")
    .filter(Boolean);
};
