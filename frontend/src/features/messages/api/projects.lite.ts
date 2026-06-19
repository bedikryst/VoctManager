/**
 * @file projects.lite.ts
 * @description Non-suspense project list for the messaging surfaces — the composer's
 * "about a project" picker and the thread context-chip name resolution. Shares the
 * canonical `projectKeys.projects.all` cache, so it reuses whatever the dashboard /
 * projects tab already loaded. Deliberately NOT `useProjects` (that one is a
 * `useSuspenseQuery` and would suspend the modal / conversation pane on a cold cache).
 * @architecture Enterprise SaaS 2026
 * @module features/messages/api
 */

import { useQuery } from "@tanstack/react-query";

import type { Project } from "@/shared/types";
import { ProjectService } from "@/features/projects/api/project.service";
import { projectKeys } from "@/features/projects/api/project.query-keys";

const STALE_TIME = 1000 * 60 * 5;

export const useProjectsLite = (enabled = true) =>
  useQuery<Project[]>({
    queryKey: projectKeys.projects.all,
    queryFn: ProjectService.getAll,
    staleTime: STALE_TIME,
    enabled,
  });
