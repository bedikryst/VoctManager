/**
 * @file project.publication.ts
 * @description React Query layer for publishing a project. Deliberately separate
 * from the ordinary status mutation: publication is not a field edit but the act
 * that ends a project's silence and writes to the whole cast at once, so it has
 * its own endpoint, its own preview read and its own cache invalidation.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toastApiError } from "@/shared/api/errors";
import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import { projectKeys } from "./project.query-keys";
import { ProjectService } from "./project.service";

/**
 * The preview behind the publish confirmation. Fetched only while the dialog is
 * open — it is a decision aid, not background state, and it counts people whose
 * RSVPs move underneath it.
 */
export const useProjectPublicationPreview = (
  projectId: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: projectKeys.publication.preview(projectId),
    queryFn: () => ProjectService.getPublicationPreview(projectId),
    enabled: Boolean(projectId) && enabled,
    ...RECONCILING_REFETCH,
  });

export const usePublishProject = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ProjectService.publish(projectId),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.projects.details(projectId), project);
      // Publication reveals the project to its cast, so every list that filtered
      // drafts out server-side is now wrong — including the artist-facing ones.
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      queryClient.invalidateQueries({
        queryKey: projectKeys.publication.preview(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: projectKeys.participations.byProject(projectId),
      });
    },
    onError: (error) => toastApiError(error),
  });
};
