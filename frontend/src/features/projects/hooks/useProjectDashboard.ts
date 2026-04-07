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
import {
  useDeleteProject,
  useProjectArtistsDictionary,
  useProjectCollaboratorsDictionary,
  useProjectPiecesDictionary,
  useProjects,
  useProjectVoiceLinesDictionary,
} from "../api/project.queries";

export type FilterStatus = "ACTIVE" | "DONE" | "ALL";

interface UseProjectDashboardReturn {
  isLoading: boolean;
  filteredProjects: Project[];
  listFilter: FilterStatus;
  setListFilter: (filter: FilterStatus) => void;
  isPanelOpen: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  editingProject: Project | null;
  projectToDelete: string | null;
  setProjectToDelete: (id: string | null) => void;
  isDeleting: boolean;
  openPanel: (project?: Project | null, tab?: string) => void;
  closePanel: () => void;
  executeDelete: () => Promise<void>;
}

export const useProjectDashboard = (): UseProjectDashboardReturn => {
  const { t } = useTranslation();
  const [listFilter, setListFilter] = useState<FilterStatus>("ACTIVE");
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("DETAILS");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const deleteProjectMutation = useDeleteProject();
  const projectsQuery = useProjects();
  const piecesQuery = useProjectPiecesDictionary();
  const voiceLinesQuery = useProjectVoiceLinesDictionary();
  const artistsQuery = useProjectArtistsDictionary();
  const collaboratorsQuery = useProjectCollaboratorsDictionary();

  const editingProjectRef = useRef<Project | null>(null);

  useEffect(() => {
    editingProjectRef.current = editingProject;
  }, [editingProject]);

  const isLoading =
    projectsQuery.isLoading ||
    piecesQuery.isLoading ||
    voiceLinesQuery.isLoading ||
    artistsQuery.isLoading ||
    collaboratorsQuery.isLoading;

  const isError =
    projectsQuery.isError ||
    piecesQuery.isError ||
    voiceLinesQuery.isError ||
    artistsQuery.isError ||
    collaboratorsQuery.isError;

  const projects = projectsQuery.data ?? [];

  useEffect(() => {
    if (isError) {
      toast.error(t("projects.toast.sync_error_title", "Błąd synchronizacji"), {
        description: t(
          "projects.toast.sync_error_desc",
          "Słowniki nie zostały pobrane poprawnie.",
        ),
      });
    }
  }, [isError, t]);

  const filteredProjects = useMemo<Project[]>(() => {
    return projects
      .filter((project) => {
        const status = project.status || "DRAFT";
        if (listFilter === "ACTIVE") {
          return status !== "DONE" && status !== "CANC";
        }
        if (listFilter === "DONE") {
          return status === "DONE" || status === "CANC";
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
    (project: Project | null = null, tab: string = "DETAILS"): void => {
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
