/**
 * @file panelDataPreloaders.ts
 * @description Authenticated panel data warm-up pipeline for React Query.
 * @architecture Enterprise SaaS 2026
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { AuthUser } from "@/shared/auth/auth.types";
import type { Project } from "@/shared/types";
import type { DashboardDataPreloader } from "@/widgets/panel-shell/DashboardLayout";
import { archiveKeys } from "@/features/archive/api/archive.queries";
import { ArchiveService } from "@/features/archive/api/archive.service";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { ArtistService } from "@/features/artists/api/artist.service";
import { ContractsService } from "@/features/contracts/api/contracts.service";
import { crewKeys } from "@/features/crew/api/crew.queries";
import { CrewService } from "@/features/crew/api/crew.service";
import { logisticsQueryKeys } from "@/features/logistics/api/logistics.queries";
import { logisticsService } from "@/features/logistics/api/logistics.service";
import { materialsKeys } from "@/features/materials/api/materials.queries";
import { MaterialsService } from "@/features/materials/api/materials.service";
import { notificationKeys } from "@/features/notifications/api/notifications.queries";
import { NotificationService } from "@/features/notifications/api/notifications.service";
import { PROJECT_STATUS } from "@/features/projects/constants/projectDomain";
import { projectKeys } from "@/features/projects/api/project.query-keys";
import { ProjectService } from "@/features/projects/api/project.service";
import {
  FAST_CHANGING_STALE_TIME,
  PROJECT_RELATION_STALE_TIME,
  STATIC_DICTIONARY_STALE_TIME,
} from "@/features/projects/api/project.query-utils";
import { rehearsalKeys } from "@/features/rehearsals/api/rehearsals.queries";
import { RehearsalsService } from "@/features/rehearsals/api/rehearsals.service";
import { scheduleKeys } from "@/features/schedule/api/schedule.queries";
import { ScheduleService } from "@/features/schedule/api/schedule.service";

interface DashboardDataPreloadContext {
  readonly queryClient: QueryClient;
  readonly user: AuthUser;
}

const WORKSPACE_STALE_TIME = 1000 * 60 * 5;
const NOTIFICATION_STALE_TIME = 1000 * 30;

const prefetchQuery = <TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  staleTime: number,
): Promise<void> =>
  queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime,
  });

const isOperationalProject = (project: Project): boolean =>
  project.status !== PROJECT_STATUS.DONE &&
  project.status !== PROJECT_STATUS.CANCELLED;

const getProjectTimestamp = (project: Project): number => {
  const timestamp = Date.parse(project.date_time);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

const selectNearestOperationalProject = (
  projects: readonly Project[],
): Project | null => {
  const now = Date.now();
  const sortedProjects = [...projects]
    .filter(isOperationalProject)
    .sort(
      (left, right) => getProjectTimestamp(left) - getProjectTimestamp(right),
    );

  return (
    sortedProjects.find((project) => getProjectTimestamp(project) >= now) ??
    sortedProjects[0] ??
    null
  );
};

const preloadSessionNotifications = ({
  queryClient,
}: DashboardDataPreloadContext): Promise<unknown> =>
  Promise.allSettled([
    prefetchQuery(
      queryClient,
      notificationKeys.unreadCount(),
      NotificationService.getUnreadCount,
      NOTIFICATION_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      notificationKeys.lists(),
      NotificationService.getAll,
      NOTIFICATION_STALE_TIME,
    ),
  ]);

const preloadNearestProjectGraph = async (
  queryClient: QueryClient,
): Promise<unknown> => {
  const projects = queryClient.getQueryData<Project[]>(
    projectKeys.projects.all,
  ) ?? [];
  const nearestProject = selectNearestOperationalProject(projects);

  if (!nearestProject) {
    return Promise.resolve();
  }

  const projectId = String(nearestProject.id);

  return Promise.allSettled([
    prefetchQuery(
      queryClient,
      projectKeys.participations.byProject(projectId),
      () => ProjectService.getParticipationsByProject(projectId),
      PROJECT_RELATION_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      projectKeys.rehearsals.byProject(projectId),
      () => ProjectService.getRehearsalsByProject(projectId),
      PROJECT_RELATION_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      projectKeys.crewAssignments.byProject(projectId),
      () => ProjectService.getCrewAssignmentsByProject(projectId),
      PROJECT_RELATION_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      projectKeys.program.byProject(projectId),
      () => ProjectService.getProgramByProject(projectId),
      FAST_CHANGING_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      projectKeys.pieceCastings.byProject(projectId),
      () => ProjectService.getPieceCastingsByProject(projectId),
      FAST_CHANGING_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      projectKeys.attendances.byProject(projectId),
      () => ProjectService.getAttendancesByProject(projectId),
      FAST_CHANGING_STALE_TIME,
    ),
  ]);
};

const preloadManagerWorkspace = async ({
  queryClient,
  user,
}: DashboardDataPreloadContext): Promise<unknown> => {
  await Promise.allSettled([
    prefetchQuery(
      queryClient,
      projectKeys.projects.all,
      ProjectService.getAll,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      rehearsalKeys.rehearsals.all,
      RehearsalsService.getRehearsals,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      projectKeys.participations.all,
      RehearsalsService.getParticipations,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      rehearsalKeys.attendances.all,
      RehearsalsService.getAttendances,
      FAST_CHANGING_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      artistKeys.artists.all,
      ArtistService.getAll,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      archiveKeys.pieces.all,
      ArchiveService.getPieces,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      archiveKeys.composers.all,
      ArchiveService.getComposers,
      STATIC_DICTIONARY_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      crewKeys.collaborators.all,
      CrewService.getCrewMembers,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      projectKeys.crewAssignments.all,
      ContractsService.getCrewAssignments,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      logisticsQueryKeys.lists(),
      logisticsService.getLocations,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      projectKeys.dictionaries.voiceLines,
      ProjectService.getVoiceLinesDictionary,
      STATIC_DICTIONARY_STALE_TIME,
    ),
  ]);

  if (user.artist_profile_id) {
    await prefetchQuery(
      queryClient,
      artistKeys.artists.details(user.artist_profile_id),
      () => ArtistService.getById(user.artist_profile_id!),
      WORKSPACE_STALE_TIME,
    );
  }

  return preloadNearestProjectGraph(queryClient);
};

const preloadArtistWorkspace = ({
  queryClient,
  user,
}: DashboardDataPreloadContext): Promise<unknown> => {
  const artistId = user.artist_profile_id;

  if (!artistId) {
    return Promise.resolve();
  }

  // The artist home + calendar both read the server-joined schedule dashboard
  // (and the materials dashboard for readiness). The former per-collection
  // `*ByArtist` prefetches fed the retired client-side join and are no longer
  // read by any surface — warming them would be three wasted round-trips.
  return Promise.allSettled([
    prefetchQuery(
      queryClient,
      projectKeys.projects.all,
      ProjectService.getAll,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      artistKeys.artists.details(artistId),
      () => ArtistService.getById(artistId),
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      materialsKeys.dashboard,
      MaterialsService.getArtistMaterialsDashboard,
      WORKSPACE_STALE_TIME,
    ),
    prefetchQuery(
      queryClient,
      scheduleKeys.dashboard.byArtist(artistId),
      ScheduleService.getScheduleDashboard,
      WORKSPACE_STALE_TIME,
    ),
  ]);
};

export const PANEL_DATA_PRELOADERS: readonly DashboardDataPreloader[] = [
  { preload: preloadSessionNotifications },
  { scope: "manager", preload: preloadManagerWorkspace },
  { scope: "artist", preload: preloadArtistWorkspace },
];
