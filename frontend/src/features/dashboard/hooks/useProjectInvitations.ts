/**
 * @file useProjectInvitations.ts
 * @description Lazily resolves one project's invitation roster for the pipeline
 * drill-down sheet: participations for the project, grouped by status and joined
 * against the (already-cached) artists dictionary for voice + contact details.
 * Fetches only when the sheet is open.
 * @module panel/dashboard/hooks/useProjectInvitations
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ProjectService } from "@/features/projects/api/project.service";
import { projectKeys } from "@/features/projects/api/project.queries";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { ArtistService } from "@/features/artists/api/artist.service";
import type { Artist, ParticipationStatus } from "@/shared/types";

export interface InvitationRosterRow {
  id: string;
  name: string;
  voice?: string;
  email?: string;
  phone?: string;
  status: ParticipationStatus;
}

export interface InvitationRoster {
  pending: InvitationRosterRow[];
  confirmed: InvitationRosterRow[];
  declined: InvitationRosterRow[];
  total: number;
}

const FIVE_MINUTES = 1000 * 60 * 5;

export const useProjectInvitations = (
  projectId: string | null,
  enabled: boolean,
) => {
  const { data: participations = [], isLoading } = useQuery({
    queryKey: projectKeys.participations.byProject(projectId ?? "pending"),
    queryFn: () => ProjectService.getParticipationsByProject(projectId!),
    enabled: enabled && !!projectId,
    staleTime: 1000 * 30,
  });

  // Artists are already warmed by the dashboard; this read is a cache hit.
  const { data: artists = [] } = useQuery<Artist[]>({
    queryKey: artistKeys.artists.all,
    queryFn: ArtistService.getAll,
    staleTime: FIVE_MINUTES,
  });

  const roster = useMemo<InvitationRoster>(() => {
    const artistMap = new Map<string, Artist>(
      artists.map((a) => [String(a.id), a]),
    );

    const rows = participations.map((p): InvitationRosterRow => {
      const artist = artistMap.get(String(p.artist));
      const joinedName = `${artist?.first_name ?? ""} ${artist?.last_name ?? ""}`.trim();
      return {
        id: String(p.id),
        name: p.artist_name || joinedName || "—",
        voice: p.artist_voice_type_display || artist?.voice_type_display,
        email: artist?.email || undefined,
        phone: artist?.phone_number || undefined,
        status: p.status,
      };
    });

    const byName = (a: InvitationRosterRow, b: InvitationRosterRow) =>
      a.name.localeCompare(b.name, "pl");

    return {
      pending: rows.filter((r) => r.status === "INV").sort(byName),
      confirmed: rows.filter((r) => r.status === "CON").sort(byName),
      declined: rows.filter((r) => r.status === "DEC").sort(byName),
      total: rows.length,
    };
  }, [participations, artists]);

  return { roster, isLoading };
};
