/**
 * @file project.project.mutations.ts
 * @description React Query mutations for the primary Project entity.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Project } from "@/shared/types";

import { ProjectService } from "./project.service";
import { projectKeys } from "./project.query-keys";
import {
  buildOptimisticId,
  removeEntityById,
  replaceOptimisticEntity,
  replaceEntityById,
} from "./project.query-utils";
import { buildOptimisticProject } from "./project.optimistic";
import type {
  ProjectCreateDTO,
  ProjectUpdateDTO,
} from "../types/project.dto";

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProjectCreateDTO) => ProjectService.create(data),
    onMutate: async (data) => {
      const optimisticId = buildOptimisticId("project");

      await queryClient.cancelQueries({ queryKey: projectKeys.projects.all });

      const previousProjects = queryClient.getQueryData<Project[]>(
        projectKeys.projects.all,
      );

      queryClient.setQueryData<Project[]>(
        projectKeys.projects.all,
        (currentProjects = []) => [
          buildOptimisticProject(data, optimisticId),
          ...currentProjects,
        ],
      );

      return { optimisticId, previousProjects };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          projectKeys.projects.all,
          context.previousProjects,
        );
      }
    },
    onSuccess: (project, _variables, context) => {
      queryClient.setQueryData<Project[]>(
        projectKeys.projects.all,
        (currentProjects) =>
          replaceOptimisticEntity(
            currentProjects,
            context?.optimisticId,
            project,
          ),
      );
      queryClient.setQueryData(projectKeys.projects.details(project.id), project);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdateDTO }) =>
      ProjectService.update(id, data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.projects.all });
      await queryClient.cancelQueries({
        queryKey: projectKeys.projects.details(variables.id),
      });

      const previousProjects = queryClient.getQueryData<Project[]>(
        projectKeys.projects.all,
      );
      const previousProjectDetails = queryClient.getQueryData<Project>(
        projectKeys.projects.details(variables.id),
      );

      queryClient.setQueryData<Project[]>(
        projectKeys.projects.all,
        (currentProjects) =>
          currentProjects?.map((project) =>
            String(project.id) === variables.id
              ? { ...project, ...variables.data }
              : project,
          ),
      );

      queryClient.setQueryData<Project>(
        projectKeys.projects.details(variables.id),
        (currentProject) =>
          currentProject
            ? { ...currentProject, ...variables.data }
            : currentProject,
      );

      return { previousProjects, previousProjectDetails };
    },
    onError: (_error, variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          projectKeys.projects.all,
          context.previousProjects,
        );
      }

      if (context?.previousProjectDetails) {
        queryClient.setQueryData(
          projectKeys.projects.details(variables.id),
          context.previousProjectDetails,
        );
      }
    },
    onSuccess: (project, variables) => {
      queryClient.setQueryData<Project[]>(
        projectKeys.projects.all,
        (currentProjects) =>
          replaceEntityById(currentProjects, variables.id, project) ??
          currentProjects,
      );
      queryClient.setQueryData(projectKeys.projects.details(variables.id), project);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      queryClient.invalidateQueries({
        queryKey: projectKeys.projects.details(variables.id),
      });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ProjectService.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.projects.all });
      await queryClient.cancelQueries({
        queryKey: projectKeys.projects.details(id),
      });

      const previousProjects = queryClient.getQueryData<Project[]>(
        projectKeys.projects.all,
      );
      const previousProjectDetails = queryClient.getQueryData<Project>(
        projectKeys.projects.details(id),
      );

      queryClient.setQueryData<Project[]>(
        projectKeys.projects.all,
        (currentProjects) => removeEntityById(currentProjects, id),
      );
      queryClient.removeQueries({ queryKey: projectKeys.projects.details(id) });

      return { previousProjects, previousProjectDetails };
    },
    onError: (_error, id, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          projectKeys.projects.all,
          context.previousProjects,
        );
      }

      if (context?.previousProjectDetails) {
        queryClient.setQueryData(
          projectKeys.projects.details(id),
          context.previousProjectDetails,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
    },
  });
};

export const useUpdateProjectStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: ProjectUpdateDTO["status"];
    }) => ProjectService.update(id, { status }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.projects.all });
      await queryClient.cancelQueries({
        queryKey: projectKeys.projects.details(variables.id),
      });

      const previousProjects = queryClient.getQueryData<Project[]>(
        projectKeys.projects.all,
      );
      const previousProjectDetails = queryClient.getQueryData<Project>(
        projectKeys.projects.details(variables.id),
      );

      queryClient.setQueryData<Project[]>(
        projectKeys.projects.all,
        (currentProjects) =>
          currentProjects?.map((project) =>
            String(project.id) === variables.id
              ? { ...project, status: variables.status ?? project.status }
              : project,
          ),
      );
      queryClient.setQueryData<Project>(
        projectKeys.projects.details(variables.id),
        (currentProject) =>
          currentProject
            ? { ...currentProject, status: variables.status ?? currentProject.status }
            : currentProject,
      );

      return { previousProjects, previousProjectDetails };
    },
    onError: (_error, variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          projectKeys.projects.all,
          context.previousProjects,
        );
      }

      if (context?.previousProjectDetails) {
        queryClient.setQueryData(
          projectKeys.projects.details(variables.id),
          context.previousProjectDetails,
        );
      }
    },
    onSuccess: (project, variables) => {
      queryClient.setQueryData<Project[]>(
        projectKeys.projects.all,
        (currentProjects) =>
          replaceEntityById(currentProjects, variables.id, project) ??
          currentProjects,
      );
      queryClient.setQueryData(projectKeys.projects.details(variables.id), project);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
      queryClient.invalidateQueries({
        queryKey: projectKeys.projects.details(variables.id),
      });
    },
  });
};
