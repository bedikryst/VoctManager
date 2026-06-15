/**
 * @file useArtistData.ts
 * @description Manages UI state, client-side filtering/sorting, and ensemble
 * aggregates for the roster. Reads data exclusively from the React Query cache.
 * Section balance and the section filter share one taxonomy (voiceSections) so
 * mezzo / countertenor / baritone are always counted and filterable.
 * @module hooks/useArtistData
 */

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  useArtists,
  useBulkToggleArtistStatus,
  useToggleArtistStatus,
} from "../api/artist.queries";
import { useVoiceTypes } from "@/shared/api/options.queries";
import type { Artist } from "@/shared/types";
import {
  getVoiceSection,
  sectionOrder,
  type SectionKey,
} from "../constants/voiceSections";

export type RosterSort = "name" | "section" | "skill";
export type RosterView = "grid" | "list";

const VIEW_STORAGE_KEY = "voct:roster:view";

const readStoredView = (): RosterView => {
  if (typeof window === "undefined") return "grid";
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "list" || stored === "grid" ? stored : "grid";
  } catch {
    return "grid";
  }
};

const sortName = (artist: Artist): string =>
  `${artist.last_name} ${artist.first_name}`.trim().toLowerCase();

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
  const [voiceFilter, setVoiceFilter] = useState<SectionKey | "">("");
  const [sortBy, setSortBy] = useState<RosterSort>("name");
  const [viewMode, setViewModeState] = useState<RosterView>(readStoredView);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<string>("");
  const [artistToToggle, setArtistToToggle] = useState<{
    id: string;
    willBeActive: boolean;
  } | null>(null);
  const [messageTarget, setMessageTarget] = useState<Artist | null>(null);
  const [isMessageOpen, setIsMessageOpen] = useState<boolean>(false);
  const [dossierTarget, setDossierTarget] = useState<Artist | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);

  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<{
    isActive: boolean;
    ids: string[];
  } | null>(null);
  const bulkToggleMutation = useBulkToggleArtistStatus();

  const setViewMode = useCallback((next: RosterView) => {
    setViewModeState(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — keep the in-memory value only */
    }
  }, []);

  const activeArtists = useMemo(
    () => artists.filter((artist) => artist.is_active),
    [artists],
  );

  const ensembleBalance = useMemo(() => {
    const counts: Record<SectionKey, number> = { S: 0, A: 0, T: 0, B: 0 };
    for (const artist of activeArtists) {
      const section = getVoiceSection(artist.voice_type);
      if (section) counts[section] += 1;
    }
    return { ...counts, Total: activeArtists.length };
  }, [activeArtists]);

  const accountPendingCount = useMemo(
    () => activeArtists.filter((artist) => !artist.user).length,
    [activeArtists],
  );

  const selectionStats = useMemo(() => {
    let active = 0;
    let archived = 0;
    for (const artist of artists) {
      if (selectedIds.has(artist.id)) {
        if (artist.is_active) active += 1;
        else archived += 1;
      }
    }
    return { active, archived, total: selectedIds.size };
  }, [artists, selectedIds]);

  const displayArtists = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = artists.filter((artist) => {
      const matchesSearch = term
        ? `${artist.first_name} ${artist.last_name}`
            .toLowerCase()
            .includes(term)
        : true;
      const matchesVoice = voiceFilter
        ? getVoiceSection(artist.voice_type) === voiceFilter
        : true;
      return matchesSearch && matchesVoice;
    });

    return filtered.sort((a, b) => {
      // Active singers always lead; archived sink to the bottom of any view.
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;

      if (sortBy === "section") {
        const bySection = sectionOrder(a.voice_type) - sectionOrder(b.voice_type);
        if (bySection !== 0) return bySection;
      } else if (sortBy === "skill") {
        const bySkill =
          (b.sight_reading_skill ?? -1) - (a.sight_reading_skill ?? -1);
        if (bySkill !== 0) return bySkill;
      }

      return sortName(a).localeCompare(sortName(b), undefined, {
        sensitivity: "base",
      });
    });
  }, [artists, searchTerm, voiceFilter, sortBy]);

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

  const openMessage = useCallback((artist: Artist) => {
    setMessageTarget(artist);
    setIsMessageOpen(true);
  }, []);

  const closeMessage = useCallback(() => {
    setIsMessageOpen(false);
    setTimeout(() => setMessageTarget(null), 300);
  }, []);

  const openDossier = useCallback((artist: Artist) => {
    setDossierTarget(artist);
    setIsDossierOpen(true);
  }, []);

  const closeDossier = useCallback(() => {
    setIsDossierOpen(false);
    setTimeout(() => setDossierTarget(null), 300);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(displayArtists.map((artist) => artist.id)));
  }, [displayArtists]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((previous) => {
      if (previous) setSelectedIds(new Set());
      return !previous;
    });
  }, []);

  const requestBulkToggle = useCallback(
    (isActive: boolean) => {
      // isActive === resulting state: restore→true targets archived, archive→false targets active.
      const ids = artists
        .filter(
          (artist) =>
            selectedIds.has(artist.id) && artist.is_active === !isActive,
        )
        .map((artist) => artist.id);
      if (ids.length > 0) setPendingBulk({ isActive, ids });
    },
    [artists, selectedIds],
  );

  const executeBulkToggle = async () => {
    if (!pendingBulk) return;
    const { isActive, ids } = pendingBulk;
    const toastId = toast.loading(
      isActive
        ? t("artists.bulk.restoring", "Przywracanie zaznaczonych...")
        : t("artists.bulk.archiving", "Archiwizowanie zaznaczonych..."),
    );
    try {
      const result = await bulkToggleMutation.mutateAsync({ ids, isActive });
      if (result.failed > 0) {
        toast.error(
          t("artists.bulk.partial_error", {
            defaultValue: "Nie udało się zmienić {{failed}} z {{total}}.",
            failed: result.failed,
            total: result.total,
          }),
          { id: toastId },
        );
      } else {
        toast.success(
          isActive
            ? t("artists.bulk.restored_success", {
                defaultValue: "Przywrócono artystów: {{n}}.",
                n: result.total,
              })
            : t("artists.bulk.archived_success", {
                defaultValue: "Zarchiwizowano artystów: {{n}}.",
                n: result.total,
              }),
          { id: toastId },
        );
      }
    } catch {
      toast.error(t("common.errors.server_error", "Błąd serwera"), {
        id: toastId,
      });
    } finally {
      setPendingBulk(null);
      setSelectedIds(new Set());
    }
  };

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
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    ensembleBalance,
    accountPendingCount,
    displayArtists,
    isPanelOpen,
    editingArtist,
    initialSearchContext,
    artistToToggle,
    setArtistToToggle,
    isTogglingStatus: toggleStatusMutation.isPending,
    messageTarget,
    isMessageOpen,
    openMessage,
    closeMessage,
    dossierTarget,
    isDossierOpen,
    openDossier,
    closeDossier,
    selectionMode,
    toggleSelectionMode,
    selectedIds,
    selectionStats,
    toggleSelect,
    clearSelection,
    selectAllVisible,
    pendingBulk,
    setPendingBulk,
    requestBulkToggle,
    executeBulkToggle,
    isBulkPending: bulkToggleMutation.isPending,
    openPanel,
    closePanel,
    handleToggleRequest,
    executeStatusToggle,
  };
};
