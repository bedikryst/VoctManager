/**
 * @file useProjectDashboard.ts
 * @description Master controller hook for the Project Dashboard.
 * Orchestrates local UI state while delegating server state to domain queries.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/hooks/useProjectDashboard
 */

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import type { Artist, Project } from "@/shared/types";
import { useLocations } from "@/features/logistics/api/logistics.queries";
import type { LocationDto } from "@/features/logistics/types/logistics.dto";
import {
  useDeleteProject,
  useProjectArtistsMap,
  useProjects,
} from "../api/project.queries";

import {
  PROJECT_STATUS,
  PROJECT_FILTER,
  PROJECT_TABS,
  type ProjectFilterId,
  type ProjectTabId,
} from "../constants/projectDomain";
import { compareProjectDateDesc } from "../lib/projectPresentation";

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

function extractData<T>(data: T[] | PaginatedResponse<T> | unknown): T[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data;
  }

  if (typeof data === "object" && data !== null && "results" in data) {
    const paginatedData = data as PaginatedResponse<T>;
    if (Array.isArray(paginatedData.results)) {
      return paginatedData.results;
    }
  }

  return [];
}

interface UseProjectDashboardReturn {
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
  handleProjectPersisted: (project: Project) => void;
  executeDelete: () => Promise<void>;
}

const PANEL_UNMOUNT_DELAY_MS = 300;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isArtistReference = (value: Project["conductor"]): value is Artist =>
  typeof value === "object" &&
  value !== null &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.first_name) &&
  isNonEmptyString(value.last_name);

const isLocationReference = (
  value: Project["location"],
): value is Exclude<Project["location"], string | null> =>
  typeof value === "object" && value !== null && isNonEmptyString(value.id);

const buildArtistDisplayName = (
  artist: Artist | null | undefined,
): string | null => {
  if (!artist) {
    return null;
  }

  const displayName = `${artist.first_name} ${artist.last_name}`.trim();
  return displayName.length > 0 ? displayName : null;
};

const resolveProjectLocation = (
  project: Project,
  locationMap: Map<string, LocationDto>,
): Project["location"] => {
  if (!project.location) {
    return null;
  }

  if (typeof project.location === "string") {
    return locationMap.get(project.location) ?? project.location;
  }

  if (!isLocationReference(project.location)) {
    return null;
  }

  return locationMap.get(project.location.id) ?? project.location;
};

const resolveProjectConductor = (
  project: Project,
  artistMap: Map<string, Artist>,
): Pick<Project, "conductor" | "conductor_name"> => {
  if (!project.conductor) {
    return {
      conductor: null,
      conductor_name: project.conductor_name ?? null,
    };
  }

  if (typeof project.conductor === "string") {
    const resolvedArtist = artistMap.get(project.conductor);

    return {
      conductor: resolvedArtist ?? project.conductor,
      conductor_name:
        project.conductor_name ?? buildArtistDisplayName(resolvedArtist),
    };
  }

  if (!isArtistReference(project.conductor)) {
    return {
      conductor: null,
      conductor_name: project.conductor_name ?? null,
    };
  }

  return {
    conductor: project.conductor,
    conductor_name:
      project.conductor_name ?? buildArtistDisplayName(project.conductor),
  };
};

const isArchiveStatus = (
  status: Project["status"] | null | undefined,
): boolean =>
  status === PROJECT_STATUS.DONE || status === PROJECT_STATUS.CANCELLED;

export const useProjectDashboard = (): UseProjectDashboardReturn => {
  const { t } = useTranslation();

  const [listFilter, setListFilterState] = useState<ProjectFilterId>(
    PROJECT_FILTER.ACTIVE,
  );
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ProjectTabId>(
    PROJECT_TABS.DETAILS,
  );
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const deleteProjectMutation = useDeleteProject();

  // Suspense Queries
  const { data: rawProjects } = useProjects();
  const { data: artistMap } = useProjectArtistsMap();
  const { data: locationsData } = useLocations();

  const editingProjectRef = useRef<Project | null>(null);
  const panelResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    editingProjectRef.current = editingProject;
  }, [editingProject]);

  useEffect(() => {
    return () => {
      if (panelResetTimeoutRef.current) {
        clearTimeout(panelResetTimeoutRef.current);
      }
    };
  }, []);

  const locationMap = useMemo(() => {
    // extractData samo wywnioskuje, jak wydobyć tablicę
    const validLocations = extractData<LocationDto>(locationsData);

    return new Map(
      validLocations.map((location) => [
        // TS już wie, że location to LocationDto
        String(location.id),
        location,
      ]),
    );
  }, [locationsData]);

  const projects = useMemo(() => {
    const validProjects = extractData<Project>(rawProjects);

    return validProjects.map((project) => {
      const location = resolveProjectLocation(project, locationMap);
      const conductor = resolveProjectConductor(project, artistMap);

      return {
        ...project,
        location,
        ...conductor,
      };
    });
  }, [artistMap, locationMap, rawProjects]);

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

  const openPanel = useCallback(
    (
      project: Project | null = null,
      tab: ProjectTabId = PROJECT_TABS.DETAILS,
    ): void => {
      if (panelResetTimeoutRef.current) {
        clearTimeout(panelResetTimeoutRef.current);
        panelResetTimeoutRef.current = null;
      }

      setEditingProject(project);
      setActiveTab(tab);
      setIsPanelOpen(true);
    },
    [],
  );

  const closePanel = useCallback((): void => {
    setIsPanelOpen(false);

    if (panelResetTimeoutRef.current) {
      clearTimeout(panelResetTimeoutRef.current);
    }

    panelResetTimeoutRef.current = setTimeout(() => {
      setEditingProject(null);
      panelResetTimeoutRef.current = null;
    }, PANEL_UNMOUNT_DELAY_MS);
  }, []);

  const handleProjectPersisted = useCallback((project: Project): void => {
    if (panelResetTimeoutRef.current) {
      clearTimeout(panelResetTimeoutRef.current);
      panelResetTimeoutRef.current = null;
    }

    setEditingProject(project);
    setActiveTab(PROJECT_TABS.DETAILS);
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

      if (editingProjectRef.current?.id === projectToDelete) {
        closePanel();
      }
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
  }, [closePanel, deleteProjectMutation, projectToDelete, t]);

  return {
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
    handleProjectPersisted,
    executeDelete,
  };
};
