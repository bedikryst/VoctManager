/**
 * @file useCastTab.ts
 * @description State and mutation controller for the Primary Casting Manager.
 * Resolves dictionaries from shared project queries and delegates writes to the domain layer.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/hooks/useCastTab
 */

import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import type { Artist, Participation } from "@/shared/types";
import {
  useCreateParticipation,
  useDeleteParticipation,
  useProjectArtistsDictionary,
  useProjectParticipations,
  useUpdateParticipation,
} from "../../api/project.queries";
import type { CastTabMobileView } from "../types";

export interface UseCastTabResult {
  participations: Participation[];
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  processingId: string | null;
  mobileView: CastTabMobileView;
  setMobileView: Dispatch<SetStateAction<CastTabMobileView>>;
  allArtists: Artist[];
  assignedIds: Set<string>;
  toggleCasting: (
    artistId: string | number,
    isCurrentlyCasted: boolean,
    participationId?: string | number,
  ) => Promise<void>;
}

const EMPTY_ARTISTS: Artist[] = [];
const EMPTY_PARTICIPATIONS: Participation[] = [];

export const useCastTab = (projectId: string): UseCastTabResult => {
  const { t } = useTranslation();

  const artistsQuery = useProjectArtistsDictionary();
  const participationsQuery = useProjectParticipations(projectId);
  const artists = artistsQuery.data ?? EMPTY_ARTISTS;
  const participations = participationsQuery.data ?? EMPTY_PARTICIPATIONS;

  const createParticipationMutation = useCreateParticipation(projectId);
  const updateParticipationMutation = useUpdateParticipation(projectId);
  const deleteParticipationMutation = useDeleteParticipation(projectId);

  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<CastTabMobileView>("AVAILABLE");

  const allArtists = useMemo(() => {
    let filteredArtists = artists.filter((artist) => artist.is_active !== false);

    if (searchQuery.trim()) {
      const normalizedQuery = searchQuery.toLowerCase();
      filteredArtists = filteredArtists.filter(
        (artist) =>
          artist.first_name.toLowerCase().includes(normalizedQuery) ||
          artist.last_name.toLowerCase().includes(normalizedQuery) ||
          artist.voice_type_display?.toLowerCase().includes(normalizedQuery),
      );
    }

    return [...filteredArtists].sort((left, right) => {
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
    () => new Set(participations.map((participation) => String(participation.artist))),
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
