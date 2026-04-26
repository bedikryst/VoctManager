/**
 * @file useAdminDashboardData.ts
 * @description Encapsulates data fetching, telemetric aggregations, and scheduling logic.
 * Implements strict Adapter Pattern to map raw API domain to UI DTOs.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/hooks/useAdminDashboardData
 */

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import api from "@/shared/api/api";
import { rehearsalKeys } from "@/features/rehearsals/api/rehearsals.queries";
import { projectKeys } from "@/features/projects/api/project.queries";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { archiveKeys } from "@/features/archive/api/archive.queries";
import { PROJECT_STATUS } from "@/features/projects/constants/projectDomain";
import type {
  Project,
  Artist,
  Rehearsal,
  ProgramItem,
  Piece,
  LocationSnippet,
} from "@/shared/types";

// UI DTOs imports
import type { AdminTelemetryStatsDto } from "../components/TelemetryWidget";
import type { ProjectStatsDto } from "../components/SpotlightProjectCard";
import type { InvitationStatsDto } from "../components/InvitationStatusWidget";
import { parseConductorName } from "../utils/conductorParser";

/**
 * Type Guard to distinguish between a Location ID (string) and a full LocationSnippet.
 */
const isLocationSnippet = (
  loc: string | LocationSnippet | null | undefined,
): loc is LocationSnippet => {
  return typeof loc === "object" && loc !== null && "id" in loc;
};

export interface EnrichedRehearsal extends Rehearsal {
  absent_count?: number;
  projectTitle?: string;
}

export const useAdminDashboardData = () => {
  const { t } = useTranslation();

  const { isLoading, isError, data } = useQueries({
    queries: [
      {
        queryKey: projectKeys.projects.all,
        queryFn: async () => (await api.get<Project[]>("/api/projects/")).data,
      },
      {
        queryKey: rehearsalKeys.rehearsals.all,
        queryFn: async () =>
          (await api.get<EnrichedRehearsal[]>("/api/rehearsals/")).data,
      },
      {
        queryKey: artistKeys.artists.all,
        queryFn: async () => (await api.get<Artist[]>("/api/artists/")).data,
      },
      {
        queryKey: projectKeys.program.all,
        queryFn: async () =>
          (await api.get<ProgramItem[]>("/api/program-items/")).data,
      },
      {
        queryKey: archiveKeys.pieces.all,
        queryFn: async () => (await api.get<Piece[]>("/api/pieces/")).data,
      },
    ],
    combine: (results) => ({
      isLoading: results.some((q) => q.isPending || q.isLoading),
      isError: results.some((q) => q.isError),
      data: {
        projects: results[0].data ?? [],
        rehearsals: results[1].data ?? [],
        artists: results[2].data ?? [],
        programItems: results[3].data ?? [],
        pieces: results[4].data ?? [],
      },
    }),
  });

  const { projects, rehearsals, artists, programItems, pieces } = data;

  // 1. TELEMETRY AGGREGATION
  const adminStats: AdminTelemetryStatsDto = useMemo(() => {
    const activeProjects = projects.filter(
      (p) => p.status === "ACTIVE" || p.status === "DRAFT",
    ).length;

    const totalPieces = pieces.length;
    const activeArtistsList = artists.filter((a) => a.is_active);

    const S = activeArtistsList.filter((a) =>
      a.voice_type?.startsWith("S"),
    ).length;
    const MEZ = activeArtistsList.filter((a) => a.voice_type === "MEZ").length;
    const A = activeArtistsList.filter((a) =>
      a.voice_type?.startsWith("A"),
    ).length;
    const CT = activeArtistsList.filter((a) => a.voice_type === "CT").length;
    const T = activeArtistsList.filter((a) =>
      a.voice_type?.startsWith("T"),
    ).length;
    const BAR = activeArtistsList.filter((a) => a.voice_type === "BAR").length;
    const B = activeArtistsList.filter((a) =>
      a.voice_type?.startsWith("B"),
    ).length;

    const satb = {
      S,
      MEZ,
      A,
      CT,
      T,
      BAR,
      B,
      Total: activeArtistsList.length,
    };

    return { activeProjects, totalPieces, satb };
  }, [projects, pieces, artists]);

  // 2. INVITATION STATUS AGGREGATION (non-archived projects only)
  const invitationStats: InvitationStatsDto = useMemo(() => {
    const nonArchivedProjects = projects.filter(
      (p) =>
        p.status !== PROJECT_STATUS.DONE &&
        p.status !== PROJECT_STATUS.CANCELLED,
    );
    return {
      confirmed: nonArchivedProjects.reduce(
        (sum, p) => sum + (p.cast_confirmed ?? 0),
        0,
      ),
      pending: nonArchivedProjects.reduce(
        (sum, p) => sum + (p.cast_pending ?? 0),
        0,
      ),
      declined: nonArchivedProjects.reduce(
        (sum, p) => sum + (p.cast_declined ?? 0),
        0,
      ),
    };
  }, [projects]);

  // 3. SPOTLIGHT NEXT PROJECT
  const rawNextProject = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const upcoming = projects.filter((p) => {
      if (p.status === "DONE" || p.status === "CANC") return false;
      if (!p.date_time) return false;

      const projDate = new Date(p.date_time);
      return !isNaN(projDate.getTime()) && projDate >= todayStart;
    });

    return (
      upcoming.sort(
        (a, b) =>
          new Date(a.date_time!).getTime() - new Date(b.date_time!).getTime(),
      )[0] ?? null
    );
  }, [projects]);

  const nextProject = useMemo(() => {
    if (!rawNextProject) return undefined;

    const loc = rawNextProject.location;

    return {
      id: String(rawNextProject.id),
      title: rawNextProject.title,
      conductor: parseConductorName(rawNextProject.conductor_name) || undefined,
      locationId: isLocationSnippet(loc) ? loc.id : (loc ?? undefined),
      locationFallbackName: isLocationSnippet(loc) ? loc.name : undefined,
      startDate: rawNextProject.date_time,
      status: rawNextProject.status?.toLowerCase() as
        | "active"
        | "upcoming"
        | "archived",
    };
  }, [rawNextProject]);

  // 4. SPOTLIGHT STATS
  const nextProjectStats: ProjectStatsDto | undefined = useMemo(() => {
    if (!rawNextProject) return undefined;

    return {
      rehearsalsRemaining: rawNextProject.rehearsals_upcoming ?? 0,
      castCount: rawNextProject.cast_total ?? 0,
      piecesCount: rawNextProject.pieces_total ?? 0,
    };
  }, [rawNextProject, programItems, rehearsals]);

  // 5. NEXT REHEARSAL ALERT
  const nextRehearsal = useMemo(() => {
    const now = new Date();
    // Rehearsal stays active up to 2 hours past its start time
    const threshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const futureRehearsals = rehearsals
      .filter((r) => {
        if (!r.date_time) return false;
        const date = new Date(r.date_time);
        return !isNaN(date.getTime()) && date >= threshold;
      })
      .sort(
        (a, b) =>
          new Date(a.date_time!).getTime() - new Date(b.date_time!).getTime(),
      );

    if (futureRehearsals.length > 0) {
      const next = futureRehearsals[0];
      const project = projects.find(
        (p) => String(p.id) === String(next.project),
      );
      return {
        ...next,
        projectTitle:
          project?.title ||
          t("dashboard.admin.unknown_project", "Nieznany projekt"),
      };
    }
    return null;
  }, [rehearsals, projects, t]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return t("dashboard.artist.greeting_night", "Dobrej nocy");
    if (hour < 12) return t("dashboard.artist.greeting_morning", "Dzień dobry");
    if (hour < 18)
      return t("dashboard.artist.greeting_afternoon", "Dobrego popołudnia");
    return t("dashboard.artist.greeting_evening", "Dobry wieczór");
  }, [t]);

  return {
    isLoading,
    isError,
    adminStats,
    invitationStats,
    nextProject,
    nextProjectStats,
    nextRehearsal,
    greeting,
  };
};
