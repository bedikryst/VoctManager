/**
 * @file useDetailsForm.ts
 * @description Encapsulates dirty-state tracking, payload construction,
 * and optimistic form mutations for the Project Details tab.
 * Implements the Baseline State Pattern to prevent Stale Dirty State loops.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useDetailsForm
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Project, RunSheetItem } from "../../../../shared/types";
import { useCreateProject, useUpdateProject } from "../../api/project.queries";
import type {
  ProjectCreateDTO,
  ProjectUpdateDTO,
} from "../../types/project.dto";

export interface ProjectFormData {
  title: string;
  date_time: string;
  call_time: string;
  location: string;
  dress_code_male: string;
  dress_code_female: string;
  spotify_playlist_url: string;
  description: string;
}

const toLocalISOString = (dateString?: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const useDetailsForm = (
  project: Project | null,
  onSuccess: (updatedProject?: Project) => void,
  onDirtyStateChange?: (isDirty: boolean) => void,
) => {
  const { t } = useTranslation();
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();

  const [baseline, setBaseline] = useState<Project | null>(project);

  const [formData, setFormData] = useState<ProjectFormData>({
    title: project?.title || "",
    date_time: toLocalISOString(project?.date_time),
    call_time: toLocalISOString(project?.call_time),
    location: project?.location || "",
    dress_code_male: project?.dress_code_male || "",
    dress_code_female: project?.dress_code_female || "",
    spotify_playlist_url: project?.spotify_playlist_url || "",
    description: project?.description || "",
  });

  const [runSheet, setRunSheet] = useState<RunSheetItem[]>(() => {
    const initialSheet = project?.run_sheet || [];
    return initialSheet.map((item, index) => ({
      ...item,
      id: item.id ? String(item.id) : `runsheet-init-${index}-${Date.now()}`,
    }));
  });

  const resetFormToProject = useCallback((source: Project) => {
    setBaseline(source);
    setFormData({
      title: source.title || "",
      date_time: toLocalISOString(source.date_time),
      call_time: toLocalISOString(source.call_time),
      location: source.location || "",
      dress_code_male: source.dress_code_male || "",
      dress_code_female: source.dress_code_female || "",
      spotify_playlist_url: source.spotify_playlist_url || "",
      description: source.description || "",
    });
    setRunSheet(
      (source.run_sheet || []).map((item, index) => ({
        ...item,
        id: item.id ? String(item.id) : `runsheet-init-${index}-${Date.now()}`,
      })),
    );
  }, []);

  useEffect(() => {
    if (project && String(project.id) !== String(baseline?.id)) {
      resetFormToProject(project);
    }
  }, [project?.id, baseline?.id, resetFormToProject]);

  const isDirty = useMemo(() => {
    if (!baseline) {
      return (
        formData.title.trim() !== "" ||
        formData.date_time !== "" ||
        runSheet.length > 0
      );
    }

    const basicFieldsChanged =
      formData.title !== (baseline.title || "") ||
      formData.date_time !== toLocalISOString(baseline.date_time) ||
      formData.call_time !== toLocalISOString(baseline.call_time) ||
      formData.location !== (baseline.location || "") ||
      formData.dress_code_male !== (baseline.dress_code_male || "") ||
      formData.dress_code_female !== (baseline.dress_code_female || "") ||
      formData.spotify_playlist_url !== (baseline.spotify_playlist_url || "") ||
      formData.description !== (baseline.description || "");

    const cleanLocalRunSheet = runSheet.map((item) => ({
      time: item.time,
      title: item.title,
      description: item.description || "",
    }));
    const cleanBaselineRunSheet = (baseline.run_sheet || []).map((item) => ({
      time: item.time,
      title: item.title,
      description: item.description || "",
    }));

    const runSheetChanged =
      JSON.stringify(cleanLocalRunSheet) !==
      JSON.stringify(cleanBaselineRunSheet);

    return basicFieldsChanged || runSheetChanged;
  }, [formData, baseline, runSheet]);

  // Synchronize internal dirty state with the parent orchestrator
  useEffect(() => {
    if (onDirtyStateChange) {
      onDirtyStateChange(isDirty);
    }
  }, [isDirty, onDirtyStateChange]);

  const sortedRunSheet = useMemo(() => {
    return [...runSheet].sort((a, b) => a.time.localeCompare(b.time));
  }, [runSheet]);

  const handleAddRunSheetItem = useCallback(() => {
    const newItem: RunSheetItem = {
      id: `temp-${Date.now()}`,
      time: "12:00",
      title: "",
      description: "",
    };
    setRunSheet((prev) => [...prev, newItem]);
  }, []);

  const handleUpdateRunSheetItem = useCallback(
    (id: string, field: keyof RunSheetItem, value: string) => {
      setRunSheet((prev) =>
        prev.map((item) =>
          String(item.id) === id ? { ...item, [field]: value } : item,
        ),
      );
    },
    [],
  );

  const handleRemoveRunSheetItem = useCallback((id: string) => {
    setRunSheet((prev) => prev.filter((item) => String(item.id) !== id));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;

    const toastId = toast.loading(
      t("projects.details.toast.saving", "Zapisywanie szczegółów projektu..."),
    );

    try {
      const sanitizedRunSheet = sortedRunSheet.map((item) => ({
        time: item.time,
        title: item.title,
        description: item.description || "",
      }));

      const payload: ProjectCreateDTO | ProjectUpdateDTO = {
        title: formData.title,
        date_time: new Date(formData.date_time).toISOString(),
        call_time: formData.call_time
          ? new Date(formData.call_time).toISOString()
          : null,
        location: formData.location || "",
        dress_code_male: formData.dress_code_male || "",
        dress_code_female: formData.dress_code_female || "",
        spotify_playlist_url: formData.spotify_playlist_url || "",
        description: formData.description || "",
        run_sheet: sanitizedRunSheet,
      };

      if (baseline?.id) {
        const updatedProject = await updateProjectMutation.mutateAsync({
          id: String(baseline.id),
          data: payload as ProjectUpdateDTO,
        });
        toast.success(
          t(
            "projects.details.toast.update_success",
            "Zaktualizowano projekt i harmonogram",
          ),
          { id: toastId },
        );
        resetFormToProject(updatedProject);
        onSuccess(updatedProject);
      } else {
        const createdProject = await createProjectMutation.mutateAsync(
          payload as ProjectCreateDTO,
        );
        toast.success(
          t(
            "projects.details.toast.create_success",
            "Utworzono nowy projekt z harmonogramem",
          ),
          { id: toastId },
        );
        resetFormToProject(createdProject);
        onSuccess(createdProject);
      }
    } catch (error: unknown) {
      const isAxiosError = (
        err: unknown,
      ): err is { response?: { data?: Record<string, string[]> } } =>
        typeof err === "object" && err !== null && "response" in err;

      const errorMessage =
        isAxiosError(error) && error.response?.data
          ? Object.values(error.response.data).flat().join(" | ")
          : t(
              "common.errors.save_problem",
              "Wystąpił problem podczas zapisywania danych.",
            );

      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        id: toastId,
        description: errorMessage,
      });
    }
  };

  return {
    formData,
    setFormData,
    sortedRunSheet,
    isDirty,
    isSubmitting:
      createProjectMutation.isPending || updateProjectMutation.isPending,
    handleAddRunSheetItem,
    handleUpdateRunSheetItem,
    handleRemoveRunSheetItem,
    handleSubmit,
  };
};
