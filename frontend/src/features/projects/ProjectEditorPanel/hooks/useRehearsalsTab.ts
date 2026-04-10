/**
 * @file useRehearsalsTab.ts
 * @description Encapsulates mutation logic and state management for rehearsal scheduling.
 * Employs rapid Set lookups for audience targeting and synchronizes with Project domain queries.
 * Now fully supports CRUD lifecycle (Create, Read, Update, Delete) with intelligent form hydration.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useRehearsalsTab
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Artist, Rehearsal } from "../../../../shared/types";
import {
  useCreateRehearsal,
  useUpdateRehearsal,
  useDeleteRehearsal,
} from "../../api/project.queries";
import { useProjectData } from "../../hooks/useProjectData";

export interface RehearsalFormData {
  date_time: string;
  location: string;
  focus: string;
  is_mandatory: boolean;
}

export type TargetType = "TUTTI" | "SECTIONAL" | "CUSTOM";

export const useRehearsalsTab = (projectId: string) => {
  const { t } = useTranslation();
  const {
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

  const [formData, setFormData] = useState<RehearsalFormData>({
    date_time: "",
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
    setFormData({ date_time: "", location: "", focus: "", is_mandatory: true });
    setTargetType("TUTTI");
    setSelectedSections([]);
    setCustomParticipants([]);
  };

  const handleEditClick = (rehearsal: Rehearsal) => {
    setEditingRehearsalId(String(rehearsal.id));

    // Konwersja czasu z bazy (ISO/UTC) do lokalnego inputa datetime-local (YYYY-MM-DDTHH:mm)
    const localDate = new Date(rehearsal.date_time);
    // Poprawka uwzględniająca strefę czasową:
    const offset = localDate.getTimezoneOffset() * 60000;
    const localISOTime = new Date(localDate.getTime() - offset)
      .toISOString()
      .slice(0, 16);

    setFormData({
      date_time: localISOTime,
      location: rehearsal.location || "",
      focus: rehearsal.focus || "",
      is_mandatory: rehearsal.is_mandatory ?? true,
    });

    // Inteligentne odtworzenie typu targetowania
    const invitedIds = rehearsal.invited_participations?.map(String) || [];
    if (
      invitedIds.length === 0 ||
      invitedIds.length === projectParticipations.length
    ) {
      setTargetType("TUTTI");
      setCustomParticipants([]);
    } else {
      // Bezpieczny fallback do trybu niestandardowego dla edycji
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
      const payload = {
        ...formData,
        project: projectId,
        date_time: new Date(formData.date_time).toISOString(), // Formatujemy z powrotem na UTC
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
