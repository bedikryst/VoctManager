/**
 * @file useRehearsalsTab.ts
 * @description Encapsulates mutation logic and state management for rehearsal scheduling.
 * Employs rapid Set lookups for audience targeting and synchronizes with Project domain queries.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useRehearsalsTab
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Artist, Rehearsal } from "../../../../shared/types";
import {
  useCreateRehearsal,
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
  const deleteRehearsalMutation = useDeleteRehearsal(projectId);

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

  const handleAdd = async (
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

    const toastId = toast.loading(
      t(
        "projects.rehearsals.toast.saving",
        "Zapisywanie próby w kalendarzu...",
      ),
    );

    try {
      await createRehearsalMutation.mutateAsync({
        ...formData,
        project: projectId,
        date_time: new Date(formData.date_time).toISOString(),
        invited_participations: invitedParticipants,
      });

      setFormData({
        date_time: "",
        location: "",
        focus: "",
        is_mandatory: true,
      });
      setTargetType("TUTTI");
      setSelectedSections([]);
      setCustomParticipants([]);

      toast.success(
        t("projects.rehearsals.toast.save_success", "Próba zapisana pomyślnie"),
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

  const handleDeleteClick = (id: string | number): void =>
    setRehearsalToDelete(String(id));

  const executeDelete = async (): Promise<void> => {
    if (!rehearsalToDelete) return;
    const toastId = toast.loading(
      t("projects.rehearsals.toast.removing", "Usuwanie próby..."),
    );

    try {
      await deleteRehearsalMutation.mutateAsync(rehearsalToDelete);
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
    isSubmitting: createRehearsalMutation.isPending,
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
    handleAdd,
    handleDeleteClick,
    executeDelete,
    toggleSection,
    toggleCustomParticipant,
  };
};
