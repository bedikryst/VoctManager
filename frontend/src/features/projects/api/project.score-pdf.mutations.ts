/**
 * @file project.score-pdf.mutations.ts
 * @description React Query mutations for the Project score PDF resource.
 * Manages upload and removal with full cache synchronisation.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Project } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import { replaceEntityById } from "./project.query-utils";

export const useUploadProjectScorePdf = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      ProjectService.uploadScorePdf(id, file),
    onSuccess: (project, variables) => {
      queryClient.setQueryData<Project[]>(
        projectKeys.projects.all,
        (current) => replaceEntityById(current, variables.id, project) ?? current,
      );
      queryClient.setQueryData(
        projectKeys.projects.details(variables.id),
        project,
      );
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      queryClient.invalidateQueries({
        queryKey: projectKeys.projects.details(variables.id),
      });
    },
  });
};

export const useRemoveProjectScorePdf = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.removeScorePdf(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Project[]>(
        projectKeys.projects.all,
        (current) =>
          current?.map((p) =>
            String(p.id) === id ? { ...p, score_pdf: null } : p,
          ),
      );
      queryClient.setQueryData<Project>(
        projectKeys.projects.details(id),
        (current) => (current ? { ...current, score_pdf: null } : current),
      );
    },
    onSettled: (_data, _error, id) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      queryClient.invalidateQueries({
        queryKey: projectKeys.projects.details(id),
      });
    },
  });
};
