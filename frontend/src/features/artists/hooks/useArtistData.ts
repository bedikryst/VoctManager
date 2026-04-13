/**
 * @file useArtistData.ts
 * @description Manages UI state, client-side filtering, and aggregates.
 * Reads data exclusively from the React Query cache via custom hooks.
 * Fully internationalized.
 * @module hooks/useArtistData
 */

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useArtists, useToggleArtistStatus } from "../api/artist.queries";
import { useVoiceTypes } from "@/shared/api/options.queries";
import type { Artist } from "@/shared/types";

export const useArtistData = () => {
  const { t } = useTranslation();
  const {
    data: artists = [],
    isLoading: isArtistsLoading,
    isError: isArtistsError,
  } = useArtists();

  const { data: voiceTypes = [], isLoading: isVoiceTypesLoading } =
    useVoiceTypes();

  const toggleStatusMutation = useToggleArtistStatus();

  const isLoading = isArtistsLoading || isVoiceTypesLoading;
  const isError = isArtistsError;

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [voiceFilter, setVoiceFilter] = useState<string>("");
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<string>("");
  const [artistToToggle, setArtistToToggle] = useState<{
    id: string;
    willBeActive: boolean;
  } | null>(null);

  const activeArtists = useMemo(
    () => artists.filter((a) => a.is_active),
    [artists],
  );

  const ensembleBalance = useMemo(() => {
    return {
      S: activeArtists.filter((a) => a.voice_type?.startsWith("S")).length,
      A: activeArtists.filter(
        (a) => a.voice_type?.startsWith("A") || a.voice_type === "MEZ",
      ).length,
      T: activeArtists.filter(
        (a) => a.voice_type?.startsWith("T") || a.voice_type === "CT",
      ).length,
      B: activeArtists.filter((a) => a.voice_type?.startsWith("B")).length,
      Total: activeArtists.length,
    };
  }, [activeArtists]);

  const displayArtists = useMemo(() => {
    return artists.filter((a) => {
      const matchesSearch = `${a.first_name} ${a.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesVoice = voiceFilter
        ? a.voice_type === voiceFilter || a.voice_type?.startsWith(voiceFilter)
        : true;
      return matchesSearch && matchesVoice;
    });
  }, [artists, searchTerm, voiceFilter]);

  const openPanel = useCallback(
    (artist: Artist | null = null, initialNameContext: string = "") => {
      setEditingArtist(artist);
      setInitialSearchContext(initialNameContext);
      setIsPanelOpen(true);
    },
    [],
  );

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    setTimeout(() => {
      setEditingArtist(null);
      setInitialSearchContext("");
    }, 300);
  }, []);

  const handleToggleRequest = useCallback(
    (id: string, willBeActive: boolean) => {
      setArtistToToggle({ id, willBeActive });
    },
    [],
  );

  const executeStatusToggle = async () => {
    if (!artistToToggle) return;
    const toastId = toast.loading(
      artistToToggle.willBeActive
        ? t("artists.toast.activating", "Aktywowanie konta...")
        : t("artists.toast.archiving", "Archiwizowanie artysty..."),
    );

    try {
      await toggleStatusMutation.mutateAsync({
        id: artistToToggle.id,
        isActive: artistToToggle.willBeActive,
      });
      toast.success(
        artistToToggle.willBeActive
          ? t("artists.toast.activated_success", "Konto artysty aktywowane")
          : t("artists.toast.archived_success", "Artysta zarchiwizowany"),
        { id: toastId },
      );
    } catch (err) {
      toast.error(t("common.errors.server_error", "Błąd serwera"), {
        id: toastId,
        description: t(
          "artists.toast.toggle_error_desc",
          "Nie udało się zmienić statusu artysty.",
        ),
      });
    } finally {
      setArtistToToggle(null);
    }
  };

  return {
    isLoading,
    isError,
    voiceTypes,
    searchTerm,
    setSearchTerm,
    voiceFilter,
    setVoiceFilter,
    ensembleBalance,
    displayArtists,
    isPanelOpen,
    editingArtist,
    initialSearchContext,
    artistToToggle,
    setArtistToToggle,
    isTogglingStatus: toggleStatusMutation.isPending,
    openPanel,
    closePanel,
    handleToggleRequest,
    executeStatusToggle,
  };
};
