/**
 * @file useRehearsalsTab.ts
 * @description Encapsulates mutation logic and state management for rehearsal scheduling.
 * Employs rapid Set lookups for audience targeting and synchronizes with Project domain queries.
 * Now fully supports CRUD lifecycle with Enterprise Contextual Timezones.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useRehearsalsTab
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"; // ✅ Najnowszy standard stref czasowych
import type { Artist, Rehearsal } from "@/shared/types";
import {
  useCreateRehearsal,
  useUpdateRehearsal,
  useDeleteRehearsal,
} from "../../api/project.queries";
import { useProjectData } from "../../hooks/useProjectData";

export interface RehearsalFormData {
  date_time: string;
  timezone: string; // ✅ WZORZEC ENTERPRISE: Kontekst strefy czasowej wydarzenia
  location: string;
  focus: string;
  is_mandatory: boolean;
}

export type TargetType = "TUTTI" | "SECTIONAL" | "CUSTOM";

// Funkcja pomocnicza: Absolute UTC -> Zoned Local String (do inputu)
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

export const useRehearsalsTab = (projectId: string) => {
  const { t } = useTranslation();
  const {
    project,
    artists,
    participations,
    rehearsals,
    isLoading: isContextLoading,
  } = useProjectData(projectId);

  const createRehearsalMutation = useCreateRehearsal(projectId);
  const updateRehearsalMutation = useUpdateRehearsal(projectId);
  const deleteRehearsalMutation = useDeleteRehearsal(projectId);

  // --- STATE ---
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
    location: "",
    focus: "",
    is_mandatory: true,
  });

  const [targetType, setTargetType] = useState<TargetType>("TUTTI");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [customParticipants, setCustomParticipants] = useState<string[]>([]);

  // --- COMPUTED DATA ---
  const projectRehearsals = useMemo<Rehearsal[]>(
    () =>
      [...rehearsals]
        .filter((rehearsal) => String(rehearsal.project) === String(projectId))
        .sort(
          (left, right) =>
            new Date(left.date_time).getTime() -
            new Date(right.date_time).getTime(),
        ),
    [rehearsals, projectId],
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
    artists.forEach((artist) => map.set(String(artist.id), artist));
    return map;
  }, [artists]);

  // --- LOGIC ---
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
          if (!artist || !artist.voice_type) return false;
          return selectedSections.some((section) =>
            artist.voice_type?.startsWith(section),
          );
        })
        .map((participation) => String(participation.id));
    }
    return customParticipants;
  }, [
    targetType,
    projectParticipations,
    artistMap,
    selectedSections,
    customParticipants,
  ]);

  const resetForm = () => {
    setEditingRehearsalId(null);
    setFormData({
      date_time: "",
      timezone: project?.timezone || "Europe/Warsaw",
      location: "",
      focus: "",
      is_mandatory: true,
    });
    setTargetType("TUTTI");
    setSelectedSections([]);
    setCustomParticipants([]);
  };

  const handleEditClick = (rehearsal: Rehearsal) => {
    setEditingRehearsalId(String(rehearsal.id));

    const rehearsalTimezone =
      rehearsal.timezone || project?.timezone || "Europe/Warsaw";

    setFormData({
      date_time: toZonedInputString(rehearsal.date_time, rehearsalTimezone),
      timezone: rehearsalTimezone,
      location: rehearsal.location || "",
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
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    const invitedParticipants = resolveInvitedParticipants();
    if (invitedParticipants.length === 0) {
      toast.warning(
        t(
          "projects.rehearsals.toast.select_target",
          "Wybierz przynajmniej jedną osobę lub sekcję na próbę!",
        ),
      );
      return;
    }

    const isEditing = !!editingRehearsalId;
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
        ...formData,
        project: projectId,
        date_time: absoluteDateTime,
        timezone: formData.timezone,
        invited_participations: invitedParticipants,
      };

      if (isEditing) {
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
    } catch (error: unknown) {
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        id: toastId,
        description: t(
          "projects.rehearsals.toast.save_error_desc",
          "Wystąpił problem z zapisem do bazy. Sprawdź formularz i połączenie.",
        ),
      });
    }
  };

  const handleDeleteClick = (id: string): void => setRehearsalToDelete(id);

  const executeDelete = async (): Promise<void> => {
    if (!rehearsalToDelete) return;
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
    } catch (error: unknown) {
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
  };

  const toggleSection = (section: string): void => {
    setSelectedSections((previous) =>
      previous.includes(section)
        ? previous.filter((value) => value !== section)
        : [...previous, section],
    );
  };

  const toggleCustomParticipant = (id: string): void => {
    setCustomParticipants((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    );
  };

  return {
    isLoading: isContextLoading,
    isSubmitting:
      createRehearsalMutation.isPending || updateRehearsalMutation.isPending,
    isEditing: !!editingRehearsalId,
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
    handleSubmit,
    handleEditClick,
    handleCancelEdit,
    handleDeleteClick,
    executeDelete,
    toggleSection,
    toggleCustomParticipant,
  };
};
