/**
 * @file useRehearsalsTab.ts
 * @description Encapsulates mutation logic and state management for rehearsal scheduling.
 * Uses explicit location relations and timezone-safe payload construction.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useRehearsalsTab
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { Artist, Rehearsal } from "@/shared/types";
import { useLocations } from "@/features/logistics/api/logistics.queries";
import {
  useCreateRehearsal,
  useDeleteRehearsal,
  useUpdateRehearsal,
} from "../../api/project.queries";
import { useProjectData } from "../../hooks/useProjectData";
import { compareProjectDateAsc } from "../../lib/projectPresentation";

export interface RehearsalFormData {
  date_time: string;
  timezone: string;
  location_id: string;
  focus: string;
  is_mandatory: boolean;
}

export type TargetType = "TUTTI" | "SECTIONAL" | "CUSTOM";

const toZonedInputString = (
  dateString?: string | null,
  timezone: string = "Europe/Warsaw",
): string => {
  if (!dateString) {
    return "";
  }

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

const getLocationId = (location: Rehearsal["location"]): string => {
  if (!location) {
    return "";
  }

  return typeof location === "string" ? location : location.id;
};

export const useRehearsalsTab = (projectId: string) => {
  const { t } = useTranslation();
  const {
    project,
    artists,
    participations,
    rehearsals,
    isLoading: isProjectContextLoading,
  } = useProjectData(projectId);
  const { data: locations = [], isLoading: isLocationsLoading } = useLocations();

  const createRehearsalMutation = useCreateRehearsal(projectId);
  const updateRehearsalMutation = useUpdateRehearsal(projectId);
  const deleteRehearsalMutation = useDeleteRehearsal(projectId);

  const [editingRehearsalId, setEditingRehearsalId] = useState<string | null>(
    null,
  );
  const [rehearsalToDelete, setRehearsalToDelete] = useState<string | null>(
    null,
  );

  const defaultTimezone = project?.timezone || "Europe/Warsaw";

  const [formData, setFormData] = useState<RehearsalFormData>({
    date_time: "",
    timezone: defaultTimezone,
    location_id: "",
    focus: "",
    is_mandatory: true,
  });

  const [targetType, setTargetType] = useState<TargetType>("TUTTI");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [customParticipants, setCustomParticipants] = useState<string[]>([]);

  const projectRehearsals = useMemo<Rehearsal[]>(
    () =>
      [...rehearsals]
        .filter((rehearsal) => String(rehearsal.project) === String(projectId))
        .sort((left, right) =>
          compareProjectDateAsc(left.date_time, right.date_time),
        ),
    [projectId, rehearsals],
  );

  const projectParticipations = useMemo(
    () =>
      participations.filter(
        (participation) => String(participation.project) === String(projectId),
      ),
    [participations, projectId],
  );

  const artistMap = useMemo<Map<string, Artist>>(() => {
    const map = new Map<string, Artist>();

    artists.forEach((artist) => {
      map.set(String(artist.id), artist);
    });

    return map;
  }, [artists]);

  const locationMap = useMemo(
    () => new Map(locations.map((location) => [String(location.id), location])),
    [locations],
  );

  const resolveInvitedParticipants = useCallback((): string[] => {
    if (targetType === "TUTTI") {
      return projectParticipations.map((participation) =>
        String(participation.id),
      );
    }

    if (targetType === "SECTIONAL") {
      return projectParticipations
        .filter((participation) => {
          const artist = artistMap.get(String(participation.artist));

          if (!artist?.voice_type) {
            return false;
          }

          return selectedSections.some((section) =>
            artist.voice_type.startsWith(section),
          );
        })
        .map((participation) => String(participation.id));
    }

    return customParticipants;
  }, [
    artistMap,
    customParticipants,
    projectParticipations,
    selectedSections,
    targetType,
  ]);

  const resetForm = useCallback(() => {
    setEditingRehearsalId(null);
    setFormData({
      date_time: "",
      timezone: project?.timezone || "Europe/Warsaw",
      location_id: "",
      focus: "",
      is_mandatory: true,
    });
    setTargetType("TUTTI");
    setSelectedSections([]);
    setCustomParticipants([]);
  }, [project?.timezone]);

  const handleEditClick = useCallback(
    (rehearsal: Rehearsal) => {
      const locationId = getLocationId(rehearsal.location);
      const resolvedLocation = locationMap.get(locationId);
      const rehearsalTimezone =
        resolvedLocation?.timezone ||
        rehearsal.timezone ||
        project?.timezone ||
        "Europe/Warsaw";

      setEditingRehearsalId(String(rehearsal.id));
      setFormData({
        date_time: toZonedInputString(rehearsal.date_time, rehearsalTimezone),
        timezone: rehearsalTimezone,
        location_id: locationId,
        focus: rehearsal.focus || "",
        is_mandatory: rehearsal.is_mandatory ?? true,
      });

      const invitedIds = rehearsal.invited_participations?.map(String) || [];

      if (
        invitedIds.length === 0 ||
        invitedIds.length === projectParticipations.length
      ) {
        setTargetType("TUTTI");
        setCustomParticipants([]);
      } else {
        setTargetType("CUSTOM");
        setCustomParticipants(invitedIds);
      }
    },
    [locationMap, project?.timezone, projectParticipations.length],
  );

  const handleCancelEdit = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (!formData.location_id) {
      toast.warning(
        t(
          "projects.rehearsals.toast.select_location",
          "Wybierz lokalizację próby przed zapisem.",
        ),
      );
      return;
    }

    const invitedParticipants = resolveInvitedParticipants();
    if (invitedParticipants.length === 0) {
      toast.warning(
        t(
          "projects.rehearsals.toast.select_target",
          "Wybierz przynajmniej jedną osobę lub sekcję na próbę.",
        ),
      );
      return;
    }

    const isEditing = editingRehearsalId !== null;
    const toastId = toast.loading(
      isEditing
        ? t("projects.rehearsals.toast.updating", "Aktualizowanie próby...")
        : t(
            "projects.rehearsals.toast.saving",
            "Zapisywanie próby w kalendarzu...",
          ),
    );

    try {
      const absoluteDateTime = fromZonedTime(
        formData.date_time,
        formData.timezone,
      ).toISOString();

      const payload = {
        project: projectId,
        date_time: absoluteDateTime,
        timezone: formData.timezone,
        location_id: formData.location_id,
        focus: formData.focus,
        is_mandatory: formData.is_mandatory,
        invited_participations: invitedParticipants,
      };

      if (isEditing && editingRehearsalId) {
        await updateRehearsalMutation.mutateAsync({
          id: editingRehearsalId,
          data: payload,
        });
      } else {
        await createRehearsalMutation.mutateAsync(payload);
      }

      resetForm();

      toast.success(
        isEditing
          ? t(
              "projects.rehearsals.toast.update_success",
              "Próba zaktualizowana pomyślnie",
            )
          : t(
              "projects.rehearsals.toast.save_success",
              "Próba zapisana pomyślnie",
            ),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        id: toastId,
        description: t(
          "projects.rehearsals.toast.save_error_desc",
          "Wystąpił problem z zapisem do bazy. Sprawdź formularz i połączenie.",
        ),
      });
    }
  };

  const handleDeleteClick = useCallback((id: string): void => {
    setRehearsalToDelete(id);
  }, []);

  const executeDelete = useCallback(async (): Promise<void> => {
    if (!rehearsalToDelete) {
      return;
    }

    const toastId = toast.loading(
      t("projects.rehearsals.toast.removing", "Usuwanie próby..."),
    );

    try {
      await deleteRehearsalMutation.mutateAsync(rehearsalToDelete);

      if (editingRehearsalId === rehearsalToDelete) {
        resetForm();
      }

      toast.success(
        t("projects.rehearsals.toast.remove_success", "Próba została usunięta"),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.actions.delete_error", "Błąd usuwania"), {
        id: toastId,
        description: t(
          "projects.rehearsals.toast.remove_error_desc",
          "Nie udało się usunąć próby. Serwer odrzucił żądanie.",
        ),
      });
    } finally {
      setRehearsalToDelete(null);
    }
  }, [
    deleteRehearsalMutation,
    editingRehearsalId,
    rehearsalToDelete,
    resetForm,
    t,
  ]);

  const toggleSection = useCallback((section: string): void => {
    setSelectedSections((previousSections) =>
      previousSections.includes(section)
        ? previousSections.filter((value) => value !== section)
        : [...previousSections, section],
    );
  }, []);

  const toggleCustomParticipant = useCallback((id: string): void => {
    setCustomParticipants((previousParticipants) =>
      previousParticipants.includes(id)
        ? previousParticipants.filter((value) => value !== id)
        : [...previousParticipants, id],
    );
  }, []);

  return {
    isLoading: isProjectContextLoading || isLocationsLoading,
    isSubmitting:
      createRehearsalMutation.isPending || updateRehearsalMutation.isPending,
    isEditing: editingRehearsalId !== null,
    rehearsalToDelete,
    setRehearsalToDelete,
    isDeleting: deleteRehearsalMutation.isPending,
    formData,
    setFormData,
    targetType,
    setTargetType,
    selectedSections,
    customParticipants,
    projectRehearsals,
    projectParticipations,
    artistMap,
    locations,
    handleSubmit,
    handleEditClick,
    handleCancelEdit,
    handleDeleteClick,
    executeDelete,
    toggleSection,
    toggleCustomParticipant,
  };
};
