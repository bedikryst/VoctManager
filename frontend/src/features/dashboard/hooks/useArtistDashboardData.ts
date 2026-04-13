/**
 * @file useArtistDashboardData.ts
 * @description Encapsulates data fetching and scheduling logic for the Artist Dashboard.
 * Computes upcoming events strictly filtered by the authenticated user's ID to prevent data leaks.
 * @module panel/dashboard/hooks/useArtistDashboardData
 */

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import api from "@/shared/api/api";
import { queryKeys } from "@/shared/lib/queryKeys";
import type {
  Project,
  Rehearsal,
  Participation,
  Attendance,
} from "@/shared/types";

export interface EnrichedRehearsal extends Rehearsal {
  absent_count?: number;
}

export const useArtistDashboardData = (artistId?: string | number) => {
  const { t } = useTranslation();

  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.participations.byArtist(artistId!),
        queryFn: async () =>
          (
            await api.get<Participation[]>(
              `/api/participations/?artist=${artistId}`,
            )
          ).data,
        enabled: !!artistId,
      },
      {
        queryKey: queryKeys.rehearsals.byArtist(artistId!),
        queryFn: async () =>
          (
            await api.get<EnrichedRehearsal[]>(
              `/api/rehearsals/?invited_participations__artist=${artistId}`,
            )
          ).data,
        enabled: !!artistId,
      },
      {
        queryKey: queryKeys.projects.all,
        queryFn: async () => (await api.get<Project[]>("/api/projects/")).data,
      },
      {
        queryKey: queryKeys.attendances.byArtist(artistId!),
        queryFn: async () =>
          (
            await api.get<Attendance[]>(
              `/api/attendances/?participation__artist=${artistId}`,
            )
          ).data,
        enabled: !!artistId,
      },
    ],
  });

  const isLoading = results.some((r) => r.isLoading);
  const participations = results[0].data || [];
  const rehearsals = results[1].data || [];
  const projects = results[2].data || [];
  const attendances = results[3].data || [];

  const { upNextRehearsal, upNextProject } = useMemo(() => {
    const now = new Date();
    const activeParticipations = participations.filter(
      (p) => p.status !== "DEC",
    );
    const myProjectIds = activeParticipations.map((p) => String(p.project));

    const myProjects = projects.filter(
      (p) => myProjectIds.includes(String(p.id)) && p.status !== "CANC",
    );

    const displayThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // 1. Znajdź najbliższą próbę (dołącz status obecności)
    const futureRehearsals = rehearsals
      .filter((r) => {
        const date = new Date(r.date_time);
        return !isNaN(date.getTime()) && date >= displayThreshold;
      })
      .map((r) => {
        const myParticipation = activeParticipations.find(
          (p) => String(p.project) === String(r.project),
        );
        const myAttendance = attendances.find(
          (a) =>
            String(a.rehearsal) === String(r.id) &&
            String(a.participation) === String(myParticipation?.id),
        );
        const project = projects.find(
          (p) => String(p.id) === String(r.project),
        );
        return {
          type: "REHEARSAL" as const,
          date: new Date(r.date_time),
          data: r,
          title:
            project?.title ||
            t("dashboard.artist.general_work", "Praca bieżąca"),
          absences: r.absent_count || 0,
          participationId: myParticipation?.id,
          attendance: myAttendance,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // 2. Znajdź najbliższy koncert/projekt
    const futureProjects = myProjects
      .filter((p) => {
        const date = new Date(p.date_time);
        return !isNaN(date.getTime()) && date >= displayThreshold;
      })
      .map((p) => ({
        type: "PROJECT" as const,
        date: new Date(p.date_time),
        data: p,
        title: p.title,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      upNextRehearsal: futureRehearsals.length > 0 ? futureRehearsals[0] : null,
      upNextProject: futureProjects.length > 0 ? futureProjects[0] : null,
    };
  }, [participations, rehearsals, projects, attendances, t]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return t("dashboard.artist.greeting_night", "Dobrej nocy");
    if (hour < 12) return t("dashboard.artist.greeting_morning", "Dzień dobry");
    if (hour < 18) return t("dashboard.artist.greeting_morning", "Dzień dobry");
    return t("dashboard.artist.greeting_evening", "Dobry wieczór");
  }, [t]);

  return { isLoading, upNextRehearsal, upNextProject, greeting };
};
