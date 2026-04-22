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
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Project, RunSheetItem } from "@/shared/types";
import { useCreateProject, useUpdateProject } from "../../api/project.queries";
import type {
  ProjectCreateDTO,
  ProjectUpdateDTO,
} from "../../types/project.dto";
import type { ProjectFormData } from "../types";

export interface UseDetailsFormResult {
  formData: ProjectFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
  sortedRunSheet: RunSheetItem[];
  isDirty: boolean;
  isSubmitting: boolean;
  handleAddRunSheetItem: () => void;
  handleUpdateRunSheetItem: (
    id: string,
    field: keyof RunSheetItem,
    value: string,
  ) => void;
  handleRemoveRunSheetItem: (id: string) => void;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
}

const normalizeRunSheetItem = (
  item: RunSheetItem,
  fallbackId: string,
): RunSheetItem => ({
  ...item,
  id: item.id ? String(item.id) : fallbackId,
  time: typeof item.time === "string" ? item.time : "",
  title: typeof item.title === "string" ? item.title : "",
  description: typeof item.description === "string" ? item.description : "",
});

const getProjectLocationId = (project: Project | null | undefined): string | null => {
  if (!project?.location) {
    return null;
  }

  if (typeof project.location === "string") {
    return project.location;
  }

  return project.location.id;
};

const getProjectConductorId = (
  project: Project | null | undefined,
): string | null => {
  if (!project?.conductor) {
    return null;
  }

  if (typeof project.conductor === "string") {
    return project.conductor;
  }

  return project.conductor.id;
};

const toZonedInputString = (
  dateString?: string | null,
  timezone: string = "Europe/Warsaw",
): string => {
  if (!dateString) return "";
  try {
    return formatInTimeZone(
      new Date(dateString),
      timezone,
      "yyyy-MM-dd'T'HH:mm",
    );
  } catch {
    return "";
  }
};

export const useDetailsForm = (
  project: Project | null,
  onSuccess: (updatedProject?: Project) => void,
  onDirtyStateChange?: (isDirty: boolean) => void,
): UseDetailsFormResult => {
  const { t } = useTranslation();
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();

  const [baseline, setBaseline] = useState<Project | null>(project);

  const [formData, setFormData] = useState<ProjectFormData>({
    title: project?.title || "",
    timezone: project?.timezone || "Europe/Warsaw",
    date_time: toZonedInputString(project?.date_time, project?.timezone),
    call_time: toZonedInputString(project?.call_time, project?.timezone),
    location_id: getProjectLocationId(project),
    conductor: getProjectConductorId(project),
    dress_code_male: project?.dress_code_male || "",
    dress_code_female: project?.dress_code_female || "",
    spotify_playlist_url: project?.spotify_playlist_url || "",
    description: project?.description || "",
  });

  const [runSheet, setRunSheet] = useState<RunSheetItem[]>(() => {
    const initialSheet = project?.run_sheet || [];
    return initialSheet.map((item, index) =>
      normalizeRunSheetItem(
        item,
        `runsheet-init-${index}-${Date.now()}`,
      ),
    );
  });

  const resetFormToProject = useCallback((source: Project) => {
    setBaseline(source);
    setFormData({
      title: source.title || "",
      timezone: source.timezone || "Europe/Warsaw",
      date_time: toZonedInputString(source.date_time, source.timezone),
      call_time: toZonedInputString(source.call_time, source.timezone),
      location_id: getProjectLocationId(source),
      conductor: getProjectConductorId(source),
      dress_code_male: source.dress_code_male || "",
      dress_code_female: source.dress_code_female || "",
      spotify_playlist_url: source.spotify_playlist_url || "",
      description: source.description || "",
    });
    setRunSheet(
      (source.run_sheet || []).map((item, index) =>
        normalizeRunSheetItem(
          item,
          `runsheet-init-${index}-${Date.now()}`,
        ),
      ),
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

    const baselineTimezone = baseline.timezone || "Europe/Warsaw";

    const basicFieldsChanged =
      formData.title !== (baseline.title || "") ||
      formData.timezone !== baselineTimezone ||
      formData.date_time !==
        toZonedInputString(baseline.date_time, baselineTimezone) ||
      formData.call_time !==
        toZonedInputString(baseline.call_time, baselineTimezone) ||
      formData.location_id !== getProjectLocationId(baseline) ||
      formData.conductor !== getProjectConductorId(baseline) ||
      formData.dress_code_male !== (baseline.dress_code_male || "") ||
      formData.dress_code_female !== (baseline.dress_code_female || "") ||
      formData.spotify_playlist_url !== (baseline.spotify_playlist_url || "") ||
      formData.description !== (baseline.description || "");

    const cleanLocalRunSheet = runSheet.map((item) => ({
      time: item.time || "",
      title: item.title || "",
      description: item.description || "",
    }));
    const cleanBaselineRunSheet = (baseline.run_sheet || []).map((item) => ({
      time: item.time || "",
      title: item.title || "",
      description: item.description || "",
    }));

    const runSheetChanged =
      JSON.stringify(cleanLocalRunSheet) !==
      JSON.stringify(cleanBaselineRunSheet);

    return basicFieldsChanged || runSheetChanged;
  }, [formData, baseline, runSheet]);

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
          String(item.id) === id
            ? normalizeRunSheetItem(
                { ...item, [field]: value },
                String(item.id),
              )
            : item,
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
        time: item.time || "",
        title: item.title || "",
        description: item.description || "",
      }));

      const safeDateTimeStr =
        formData.date_time.length === 16
          ? `${formData.date_time}:00`
          : formData.date_time;

      const safeCallTimeStr =
        formData.call_time?.length === 16
          ? `${formData.call_time}:00`
          : formData.call_time;

      const absoluteDateTime = fromZonedTime(
        safeDateTimeStr,
        formData.timezone,
      ).toISOString();

      const absoluteCallTime = safeCallTimeStr
        ? fromZonedTime(safeCallTimeStr, formData.timezone).toISOString()
        : null;

      const payload: ProjectCreateDTO | ProjectUpdateDTO = {
        title: formData.title,
        timezone: formData.timezone,
        date_time: absoluteDateTime,
        call_time: absoluteCallTime,
        location_id: formData.location_id,
        conductor: formData.conductor,
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
