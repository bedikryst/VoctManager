/**
 * @file useProjectDashboard.ts
 * @description Controller hook for the Project Dashboard list.
 * Filters + sorts the hydrated projects and owns the list-level delete flow.
 * Deep editing now lives on dedicated `/panel/projects/:id/*` routes, so this
 * hook no longer carries any slide-over panel state.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/hooks/useProjectDashboard
 */

import { startTransition, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import type { Project } from "@/shared/types";
import { useDeleteProject } from "../api/project.queries";
import { useEnrichedProjects } from "./useEnrichedProjects";

import {
  PROJECT_STATUS,
  PROJECT_FILTER,
  type ProjectFilterId,
} from "../constants/projectDomain";
import { compareProjectDateDesc } from "../lib/projectPresentation";

interface UseProjectDashboardReturn {
  filteredProjects: Project[];
  listFilter: ProjectFilterId;
  setListFilter: (filter: ProjectFilterId) => void;
  projectToDelete: string | null;
  setProjectToDelete: (id: string | null) => void;
  isDeleting: boolean;
  executeDelete: () => Promise<void>;
}

const isArchiveStatus = (
  status: Project["status"] | null | undefined,
): boolean =>
  status === PROJECT_STATUS.DONE || status === PROJECT_STATUS.CANCELLED;

export const useProjectDashboard = (): UseProjectDashboardReturn => {
  const { t } = useTranslation();

  const [listFilter, setListFilterState] = useState<ProjectFilterId>(
    PROJECT_FILTER.ACTIVE,
  );
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const deleteProjectMutation = useDeleteProject();

  const projects = useEnrichedProjects();

  const filteredProjects = useMemo<Project[]>(
    () =>
      projects
        .filter((project: Project) => {
          const status = project.status || PROJECT_STATUS.DRAFT;

          if (listFilter === PROJECT_FILTER.ACTIVE) {
            return !isArchiveStatus(status);
          }

          if (listFilter === PROJECT_FILTER.DONE) {
            return isArchiveStatus(status);
          }

          return true;
        })
        .sort((left: Project, right: Project) =>
          compareProjectDateDesc(left.date_time, right.date_time),
        ),
    [listFilter, projects],
  );

  const setListFilter = useCallback((filter: ProjectFilterId): void => {
    startTransition(() => {
      setListFilterState(filter);
    });
  }, []);

  const executeDelete = useCallback(async (): Promise<void> => {
    if (!projectToDelete) {
      return;
    }

    const toastId = toast.loading(
      t("projects.toast.delete_loading", "Usuwanie projektu..."),
    );

    try {
      await deleteProjectMutation.mutateAsync(projectToDelete);
      toast.success(
        t("projects.toast.delete_success", "Projekt usunięty pomyślnie"),
        { id: toastId },
      );
    } catch {
      toast.error(t("projects.toast.delete_error_title", "Błąd usuwania"), {
        id: toastId,
        description: t(
          "projects.toast.delete_error_desc",
          "Sprawdź powiązania projektu w bazie. Projekt może mieć przypisane umowy lub obecności.",
        ),
      });
    } finally {
      setProjectToDelete(null);
    }
  }, [deleteProjectMutation, projectToDelete, t]);

  return {
    filteredProjects,
    listFilter,
    setListFilter,
    projectToDelete,
    setProjectToDelete,
    isDeleting: deleteProjectMutation.isPending,
    executeDelete,
  };
};
