/**
 * @file useArtistDashboardData.ts
 * @description Encapsulates data fetching and scheduling logic for the Artist Dashboard.
 * Computes upcoming events strictly filtered by the authenticated user's ID to prevent data leaks.
 * @module panel/dashboard/hooks/useArtistDashboardData
 */

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import api from "../../../shared/api/api";
import { queryKeys } from "../../../shared/lib/queryKeys";
import type { Project, Rehearsal, Participation } from "../../../shared/types";

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
        queryKey: queryKeys.projects.active,
        queryFn: async () =>
          (await api.get<Project[]>("/api/projects/?status=ACTIVE")).data,
      },
    ],
  });

  const isLoading = results.some((r) => r.isLoading);
  const participations = results[0].data || [];
  const rehearsals = results[1].data || [];
  const projects = results[2].data || [];

  const upNextEvent = useMemo(() => {
    const now = new Date();
    const myProjectIds = participations.map((p) => String(p.project));
    const myProjects = projects.filter((p) =>
      myProjectIds.includes(String(p.id)),
    );

    const allEvents = [
      ...rehearsals.map((r) => ({
        type: "REHEARSAL" as const,
        date: new Date(r.date_time),
        data: r,
        title: `${t("dashboard.artist.event_prefix_rehearsal", "Próba:")} ${r.focus || t("dashboard.artist.general_work", "Praca bieżąca")}`,
        absences: r.absent_count || 0,
      })),
      ...myProjects.map((p) => ({
        type: "PROJECT" as const,
        date: new Date(p.date_time),
        data: p,
        title: `${t("dashboard.artist.event_prefix_project", "Wydarzenie:")} ${p.title}`,
        absences: 0,
      })),
    ];

    const displayThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const futureEvents = allEvents
      .filter((e) => !isNaN(e.date.getTime()) && e.date >= displayThreshold)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return futureEvents.length > 0 ? futureEvents[0] : null;
  }, [participations, rehearsals, projects, t]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return t("dashboard.artist.greeting_night", "Dobrej nocy");
    if (hour < 12) return t("dashboard.artist.greeting_morning", "Dzień dobry");
    if (hour < 18) return t("dashboard.artist.greeting_morning", "Dzień dobry");
    return t("dashboard.artist.greeting_evening", "Dobry wieczór");
  }, [t]);

  return { isLoading, upNextEvent, greeting };
};
