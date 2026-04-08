/**
 * @file useProjectDashboard.ts
 * @description Master controller hook for the Project Dashboard.
 * Orchestrates local UI state while delegating server state to domain queries.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/hooks/useProjectDashboard
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import type { Project } from "../../../shared/types";
import { useDeleteProject, useProjects } from "../api/project.queries";

import {
  PROJECT_STATUS,
  PROJECT_FILTER,
  PROJECT_TABS,
  type ProjectFilterId,
  type ProjectTabId,
} from "../constants/projectDomain";

interface UseProjectDashboardReturn {
  isLoading: boolean;
  filteredProjects: Project[];
  listFilter: ProjectFilterId;
  setListFilter: (filter: ProjectFilterId) => void;
  isPanelOpen: boolean;
  activeTab: ProjectTabId;
  setActiveTab: (tab: ProjectTabId) => void;
  editingProject: Project | null;
  projectToDelete: string | null;
  setProjectToDelete: (id: string | null) => void;
  isDeleting: boolean;
  openPanel: (project?: Project | null, tab?: ProjectTabId) => void;
  closePanel: () => void;
  executeDelete: () => Promise<void>;
}

export const useProjectDashboard = (): UseProjectDashboardReturn => {
  const { t } = useTranslation();

  const [listFilter, setListFilter] = useState<ProjectFilterId>(
    PROJECT_FILTER.ACTIVE,
  );
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ProjectTabId>(
    PROJECT_TABS.DETAILS,
  );
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const deleteProjectMutation = useDeleteProject();

  const projectsQuery = useProjects();

  const editingProjectRef = useRef<Project | null>(null);

  useEffect(() => {
    editingProjectRef.current = editingProject;
  }, [editingProject]);

  const isLoading = projectsQuery.isLoading;
  const isError = projectsQuery.isError;
  const projects = projectsQuery.data ?? [];

  useEffect(() => {
    if (isError) {
      toast.error(t("projects.toast.sync_error_title", "Błąd synchronizacji"), {
        description: t(
          "projects.toast.sync_error_desc",
          "Nie udało się pobrać listy projektów.",
        ),
      });
    }
  }, [isError, t]);

  const filteredProjects = useMemo<Project[]>(() => {
    return projects
      .filter((project) => {
        const status = project.status || PROJECT_STATUS.DRAFT;

        if (listFilter === PROJECT_FILTER.ACTIVE) {
          return (
            status !== PROJECT_STATUS.DONE &&
            status !== PROJECT_STATUS.CANCELLED
          );
        }
        if (listFilter === PROJECT_FILTER.DONE) {
          return (
            status === PROJECT_STATUS.DONE ||
            status === PROJECT_STATUS.CANCELLED
          );
        }
        return true;
      })
      .sort(
        (left, right) =>
          new Date(right.date_time).getTime() -
          new Date(left.date_time).getTime(),
      );
  }, [projects, listFilter]);

  const openPanel = useCallback(
    (
      project: Project | null = null,
      tab: ProjectTabId = PROJECT_TABS.DETAILS,
    ): void => {
      setEditingProject(project);
      setActiveTab(tab);
      setIsPanelOpen(true);
    },
    [],
  );

  const closePanel = useCallback((): void => {
    setIsPanelOpen(false);
    setTimeout(() => setEditingProject(null), 300);
  }, []);

  const executeDelete = useCallback(async (): Promise<void> => {
    if (!projectToDelete) return;

    const toastId = toast.loading(
      t("projects.toast.delete_loading", "Usuwanie projektu..."),
    );

    try {
      await deleteProjectMutation.mutateAsync(projectToDelete);
      toast.success(
        t("projects.toast.delete_success", "Projekt usunięty pomyślnie"),
        { id: toastId },
      );

      if (editingProjectRef.current?.id === projectToDelete) {
        closePanel();
      }
    } catch {
      toast.error(t("projects.toast.delete_error_title", "Błąd usuwania"), {
        id: toastId,
        description: t(
          "projects.toast.delete_error_desc",
          "Sprawdź powiązania projektu w bazie (być może ma przypisane umowy lub obecności).",
        ),
      });
    } finally {
      setProjectToDelete(null);
    }
  }, [projectToDelete, deleteProjectMutation, closePanel, t]);

  return {
    isLoading,
    filteredProjects,
    listFilter,
    setListFilter,
    isPanelOpen,
    activeTab,
    setActiveTab,
    editingProject,
    projectToDelete,
    setProjectToDelete,
    isDeleting: deleteProjectMutation.isPending,
    openPanel,
    closePanel,
    executeDelete,
  };
};
