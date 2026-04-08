/**
 * @file useCastTab.ts
 * @description State and mutation controller for the Primary Casting Manager.
 * Resolves dictionaries from shared project queries and delegates writes to the Project domain layer.
 * @module panel/projects/ProjectEditorPanel/hooks/useCastTab
 */

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import {
  useCreateParticipation,
  useDeleteParticipation,
  useUpdateParticipation,
} from "../../api/project.queries";
import { useProjectData } from "../../hooks/useProjectData";

export const useCastTab = (projectId: string) => {
  const { t } = useTranslation();
  const { artists, participations, isLoading } = useProjectData(projectId);

  const createParticipationMutation = useCreateParticipation(projectId);
  const updateParticipationMutation = useUpdateParticipation(projectId);
  const deleteParticipationMutation = useDeleteParticipation(projectId);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [processingId, setProcessingId] = useState<string | number | null>(
    null,
  );
  const [mobileView, setMobileView] = useState<"AVAILABLE" | "ASSIGNED">(
    "AVAILABLE",
  );

  const allArtists = useMemo(() => {
    if (!artists || artists.length === 0) return [];

    let activeArtists = artists.filter((artist) => artist.is_active !== false);

    if (searchQuery.trim() !== "") {
      const normalizedQuery = searchQuery.toLowerCase();
      activeArtists = activeArtists.filter(
        (artist) =>
          artist.first_name.toLowerCase().includes(normalizedQuery) ||
          artist.last_name.toLowerCase().includes(normalizedQuery) ||
          artist.voice_type_display?.toLowerCase().includes(normalizedQuery),
      );
    }

    return activeArtists.sort((left, right) => {
      const voiceCompare = (left.voice_type || "").localeCompare(
        right.voice_type || "",
      );
      if (voiceCompare !== 0) {
        return voiceCompare;
      }
      return left.last_name.localeCompare(right.last_name);
    });
  }, [artists, searchQuery]);

  const assignedIds = useMemo(
    () =>
      new Set(
        participations.map((participation) => String(participation.artist)),
      ),
    [participations],
  );

  const toggleCasting = async (
    artistId: string | number,
    isCurrentlyCasted: boolean,
    participationId?: string | number,
  ): Promise<void> => {
    const artistKey = String(artistId);
    setProcessingId(artistKey);

    try {
      if (isCurrentlyCasted && participationId) {
        await deleteParticipationMutation.mutateAsync(String(participationId));
        toast.success(t("projects.cast.toast.removed", "Usunięto z obsady"));
      } else {
        const existingDeclined = participations.find(
          (participation) =>
            String(participation.artist) === artistKey &&
            participation.status === "DEC",
        );

        if (existingDeclined) {
          await updateParticipationMutation.mutateAsync({
            id: String(existingDeclined.id),
            data: { status: "CON" },
          });
        } else {
          await createParticipationMutation.mutateAsync({
            artist: artistKey,
            project: projectId,
            status: "INV",
          });
        }

        toast.success(t("projects.cast.toast.added", "Dodano do obsady"));
      }
    } catch {
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        description: t(
          "common.errors.database_error",
          "Wystąpił problem z połączeniem z bazą danych.",
        ),
      });
    } finally {
      setProcessingId(null);
    }
  };

  return {
    participations,
    isFetching: isLoading,
    searchQuery,
    setSearchQuery,
    processingId,
    mobileView,
    setMobileView,
    allArtists,
    assignedIds,
    toggleCasting,
  };
};
