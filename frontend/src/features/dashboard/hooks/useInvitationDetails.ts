/**
 * @file useInvitationDetails.ts
 * @description Lazy-fetches all participations for the InvitationDetailModal.
 * Reuses React Query cache for artists and projects (pre-populated by dashboard).
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/hooks/useInvitationDetails
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/api";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { projectKeys } from "@/features/projects/api/project.queries";
import { PROJECT_STATUS } from "@/features/projects/constants/projectDomain";
import type { Artist, Participation, ParticipationStatus, Project } from "@/shared/types";

export interface InvitationDetailRow {
  id: string;
  projectName: string;
  artistName: string;
  email: string;
  phone?: string;
  status: ParticipationStatus;
}

export interface InvitationDetailGroups {
  declined: InvitationDetailRow[];
  pending: InvitationDetailRow[];
  confirmed: InvitationDetailRow[];
}

export const useInvitationDetails = (isOpen: boolean) => {
  const { data: allParticipations = [], isLoading } = useQuery({
    queryKey: projectKeys.participations.all,
    queryFn: async () => (await api.get<Participation[]>("/api/participations/")).data,
    enabled: isOpen,
    staleTime: 30_000,
  });

  const { data: artists = [] } = useQuery<Artist[]>({
    queryKey: artistKeys.artists.all,
    queryFn: async () => (await api.get<Artist[]>("/api/artists/")).data,
    staleTime: 5 * 60 * 1000,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: projectKeys.projects.all,
    queryFn: async () => (await api.get<Project[]>("/api/projects/")).data,
    staleTime: 30_000,
  });

  const groups = useMemo((): InvitationDetailGroups => {
    const artistMap = new Map<string, Artist>(
      artists.map((a) => [String(a.id), a]),
    );

    const activeProjectIds = new Set<string>(
      projects
        .filter(
          (p) => p.status !== PROJECT_STATUS.DONE && p.status !== PROJECT_STATUS.CANCELLED,
        )
        .map((p) => String(p.id)),
    );

    const sortRows = (a: InvitationDetailRow, b: InvitationDetailRow) =>
      a.projectName.localeCompare(b.projectName, "pl") ||
      a.artistName.localeCompare(b.artistName, "pl");

    const rows = allParticipations
      .filter((p) => activeProjectIds.has(String(p.project)))
      .map((p): InvitationDetailRow => {
        const artist = artistMap.get(String(p.artist));
        return {
          id: String(p.id),
          projectName: p.project_name ?? "",
          artistName:
            p.artist_name ??
            `${artist?.first_name ?? ""} ${artist?.last_name ?? ""}`.trim(),
          email: artist?.email ?? "",
          phone: artist?.phone_number,
          status: p.status,
        };
      });

    return {
      declined: rows.filter((r) => r.status === "DEC").sort(sortRows),
      pending: rows.filter((r) => r.status === "INV").sort(sortRows),
      confirmed: rows.filter((r) => r.status === "CON").sort(sortRows),
    };
  }, [allParticipations, artists, projects]);

  const totalCount =
    groups.declined.length + groups.pending.length + groups.confirmed.length;

  return { groups, totalCount, isLoading };
};
