/**
 * @file useArtistDashboardData.ts
 * @description Encapsulates data fetching and scheduling logic for the Artist Dashboard.
 * Computes upcoming events strictly filtered by the authenticated user's ID to prevent data leaks.
 * @module panel/dashboard/hooks/useArtistDashboardData
 */

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { rehearsalKeys } from "@/features/rehearsals/api/rehearsals.queries";
import { projectKeys } from "@/features/projects/api/project.queries";
import { ArtistService } from "@/features/artists/api/artist.service";
import { ProjectService } from "@/features/projects/api/project.service";
import { ScheduleService } from "@/features/schedule/api/schedule.service";
import { PROJECT_STATUS } from "@/features/projects/constants/projectDomain";

import type {
  Project,
  Rehearsal,
  Participation,
  Attendance,
} from "@/shared/types";
import { artistKeys } from "@/features/artists/api/artist.queries";

export interface EnrichedRehearsal extends Rehearsal {
  absent_count?: number;
}

const EMPTY_PROJECTS: Project[] = [];
const EMPTY_REHEARSALS: EnrichedRehearsal[] = [];
const EMPTY_ATTENDANCES: Attendance[] = [];
const EMPTY_PARTICIPATIONS: Participation[] = [];
const ANONYMOUS_ARTIST_QUERY_ID = "anonymous";
const FAST_CHANGING_STALE_TIME = 1000 * 60;
const WORKSPACE_STALE_TIME = 1000 * 60 * 5;

export const useArtistDashboardData = (artistId?: string | number) => {
  const { t } = useTranslation();

  const results = useQueries({
    queries: [
      {
        queryKey: projectKeys.participations.byArtist(
          artistId ?? ANONYMOUS_ARTIST_QUERY_ID,
        ),
        queryFn: () => ScheduleService.getParticipationsByArtist(artistId!),
        enabled: !!artistId,
        staleTime: WORKSPACE_STALE_TIME,
      },
      {
        queryKey: rehearsalKeys.rehearsals.byArtist(
          artistId ?? ANONYMOUS_ARTIST_QUERY_ID,
        ),
        queryFn: () => ScheduleService.getRehearsalsByArtist(artistId!),
        enabled: !!artistId,
        staleTime: WORKSPACE_STALE_TIME,
      },
      {
        queryKey: projectKeys.projects.all,
        queryFn: ProjectService.getAll,
        staleTime: WORKSPACE_STALE_TIME,
      },
      {
        queryKey: rehearsalKeys.attendances.byArtist(
          artistId ?? ANONYMOUS_ARTIST_QUERY_ID,
        ),
        queryFn: () => ScheduleService.getAttendancesByArtist(artistId!),
        enabled: !!artistId,
        staleTime: FAST_CHANGING_STALE_TIME,
      },
      {
        queryKey: artistKeys.artists.details(
          artistId ?? ANONYMOUS_ARTIST_QUERY_ID,
        ),
        queryFn: () => ArtistService.getById(artistId!),
        enabled: !!artistId,
        staleTime: WORKSPACE_STALE_TIME,
      },
    ],
  });

  const isLoading = results.slice(0, 4).some((result) => result.isLoading);
  const isError = results.slice(0, 4).some((result) => result.isError);
  const refetch = (): void => {
    results.forEach((result) => {
      void result.refetch();
    });
  };
  const participations = results[0].data ?? EMPTY_PARTICIPATIONS;
  const rehearsals = results[1].data ?? EMPTY_REHEARSALS;
  const projects = results[2].data ?? EMPTY_PROJECTS;
  const attendances = results[3].data ?? EMPTY_ATTENDANCES;
  const artistProfile = results[4].data ?? null;

  const { upNextRehearsal, upNextProject } = useMemo(() => {
    const now = new Date();
    const activeParticipations = participations.filter(
      (p) => p.status !== "DEC",
    );
    const myProjectIds = activeParticipations.map((p) => String(p.project));

    const myProjects = projects.filter(
      (p) =>
        myProjectIds.includes(String(p.id)) &&
        p.status !== PROJECT_STATUS.CANCELLED,
    );

    const displayThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);

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
    if (hour < 18)
      return t("dashboard.artist.greeting_afternoon", "Dobrego popołudnia");
    return t("dashboard.artist.greeting_evening", "Dobry wieczór");
  }, [t]);

  const firstNameVocative = artistProfile?.first_name_vocative || null;

  return {
    isLoading,
    isError,
    refetch,
    upNextRehearsal,
    upNextProject,
    greeting,
    firstNameVocative,
  };
};
