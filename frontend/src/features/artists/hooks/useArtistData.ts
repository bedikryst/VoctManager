/**
 * @file useArtistData.ts
 * @description The roster's list state, its client-side filtering and sorting,
 * and the counts the tabs and the census line state. Reads data exclusively
 * from the React Query cache.
 *
 * The section comes from the address (`?sekcja=`, the tabs are links); the
 * search, the range filter, the order and the quick filter are read from it
 * once on arrival and mirrored back into it as they change (`rosterScope`).
 * The section counts and the section filter share one taxonomy
 * (`voiceSections`), so mezzo, countertenor and baritone are always counted
 * and filterable. The range chip and the range filter share
 * `vocalRangeProposal`, so they read a proposal the same way.
 *
 * `?focus=<id>` (the command palette, a thread) opens that member's dossier
 * and `?new=1` the create panel, once the roster has loaded; both then leave
 * the address.
 * @module hooks/useArtistData
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { toastApiError } from "@/shared/api/errors";
import { useTranslation } from "react-i18next";
import {
  useArtists,
  useBulkToggleArtistStatus,
  useResendActivation,
  useToggleArtistStatus,
} from "../api/artist.queries";
import { useVoiceTypes } from "@/shared/api/options.queries";
import { foldDiacritics } from "@/shared/lib/text";
import type { Artist } from "@/shared/types";
import {
  getVoiceSection,
  sectionOrder,
  type SectionKey,
} from "../constants/voiceSections";
import {
  matchesQuickFilter,
  ROSTER_QUICK_FILTERS,
  rosterFiltersFromParams,
  rosterQuery,
  sectionFromParams,
  type RosterFilters,
  type RosterQuickFilter,
  type RosterSort,
} from "../lib/rosterScope";
import { matchesRangeFilter, type RangeFilter } from "../lib/vocalRangeProposal";

const sortName = (artist: Artist): string =>
  `${artist.last_name} ${artist.first_name}`.trim().toLowerCase();

const searchHaystack = (artist: Artist): string =>
  foldDiacritics(`${artist.first_name} ${artist.last_name}`);

const FOCUS_PARAM = "focus";
const NEW_PARAM = "new";

export const useArtistData = () => {
  const { t } = useTranslation();
  // Archived members are fetched too: they leave the default list, but the
  // archive chip lists them, and restoring somebody is only reachable if they
  // are on screen to be selected.
  const {
    data: artists = [],
    isLoading: isArtistsLoading,
    isError: isArtistsError,
  } = useArtists(true);

  const { data: voiceTypes = [], isLoading: isVoiceTypesLoading } =
    useVoiceTypes();

  const toggleStatusMutation = useToggleArtistStatus();
  const resendActivationMutation = useResendActivation();
  // Track resends per-artist so a second click (on a different singer) while one
  // is in flight is honoured, not silently dropped by a single shared lock.
  const [resendingIds, setResendingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const isLoading = isArtistsLoading || isVoiceTypesLoading;
  const isError = isArtistsError;

  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const section: SectionKey | "" = sectionFromParams(params);
  const focusId = params.get(FOCUS_PARAM);
  const wantsNew = params.get(NEW_PARAM) === "1";

  // Read once, on arrival: while the roster is open the inputs own these and
  // the address only mirrors them, so a keystroke never waits on a navigation.
  const [arrivalFilters] = useState<RosterFilters>(() =>
    rosterFiltersFromParams(new URLSearchParams(location.search)),
  );
  const [searchTerm, setSearchTerm] = useState<string>(arrivalFilters.search);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(arrivalFilters.range);
  const [sortBy, setSortBy] = useState<RosterSort>(arrivalFilters.sort);
  const [quickFilter, setQuickFilter] = useState<RosterQuickFilter | "">(arrivalFilters.only);
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

  const filters = useMemo<RosterFilters>(
    () => ({ search: searchTerm, range: rangeFilter, sort: sortBy, only: quickFilter }),
    [searchTerm, rangeFilter, sortBy, quickFilter],
  );

  // Replaced, not pushed: the back button leaves the roster rather than undoing
  // a filter one keystroke at a time. A tab is a link and pushes its own entry.
  // A deep link waits for its effect below, which consumes it first.
  const query = rosterQuery(section, filters);
  const hasDeepLink = focusId !== null || wantsNew;
  useEffect(() => {
    if (hasDeepLink) return;
    const search = query ? `?${query}` : "";
    if (search === location.search) return;
    navigate({ search }, { replace: true });
  }, [hasDeepLink, query, location.search, navigate]);

  const activeArtists = useMemo(
    () => artists.filter((artist) => artist.is_active),
    [artists],
  );

  // The ensemble's balance, on the tabs: active members only, whatever the
  // quick filter shows.
  const sectionCounts = useMemo(() => {
    const counts: Record<SectionKey, number> = { S: 0, A: 0, T: 0, B: 0 };
    for (const artist of activeArtists) {
      const key = getVoiceSection(artist.voice_type);
      if (key) counts[key] += 1;
    }
    return { ...counts, all: activeArtists.length };
  }, [activeArtists]);

  // A chip's size belongs to the roster, not to the current section or search,
  // like the total beside it.
  const quickFilterCounts = useMemo(() => {
    const counts: Record<RosterQuickFilter, number> = {
      pending: 0,
      range: 0,
      archived: 0,
      no_push: 0,
    };
    for (const artist of artists) {
      for (const filter of ROSTER_QUICK_FILTERS) {
        if (matchesQuickFilter(artist, filter)) counts[filter] += 1;
      }
    }
    return counts;
  }, [artists]);

  // A chip whose count reaches zero (the last invitation answered, the last
  // member restored) switches itself off: it is gone, so nothing else could,
  // and the list behind it would stay empty.
  if (quickFilter && !isArtistsLoading && quickFilterCounts[quickFilter] === 0) {
    setQuickFilter("");
  }

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

  // The list the census counts: the archive while its chip is pressed, the
  // active roster otherwise. Anything else narrows it, and the census says so.
  const baseTotal =
    quickFilter === "archived" ? quickFilterCounts.archived : activeArtists.length;
  const isNarrowed =
    Boolean(searchTerm.trim()) ||
    section !== "" ||
    rangeFilter !== "all" ||
    (quickFilter !== "" && quickFilter !== "archived");

  const displayArtists = useMemo(() => {
    // Folded, so "zielinska" finds Zielińska — a Polish roster is typed
    // without diacritics far more often than with them.
    const term = foldDiacritics(searchTerm.trim());

    const filtered = artists.filter((artist) => {
      const inBase = quickFilter ? matchesQuickFilter(artist, quickFilter) : artist.is_active;
      const matchesSearch = term ? searchHaystack(artist).includes(term) : true;
      const matchesSection = section ? getVoiceSection(artist.voice_type) === section : true;
      return inBase && matchesSearch && matchesSection && matchesRangeFilter(artist, rangeFilter);
    });

    return filtered.sort((a, b) => {
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
  }, [artists, searchTerm, section, rangeFilter, sortBy, quickFilter]);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setRangeFilter("all");
  }, []);

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

  // Read whenever the address carries one, so a palette jump made while the
  // roster is already open works too. The whole roster is searched: a thread
  // can name an archived member.
  useEffect(() => {
    if (!hasDeepLink || isLoading) return;
    if (wantsNew) {
      openPanel(null);
    } else if (focusId) {
      const target = artists.find((artist) => String(artist.id) === focusId);
      if (target) openDossier(target);
    }
    navigate({ search: query ? `?${query}` : "" }, { replace: true });
  }, [hasDeepLink, isLoading, wantsNew, focusId, artists, openPanel, openDossier, navigate, query]);

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
    } catch (error) {
      toastApiError(error, t, { id: toastId });
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

  const handleResendActivation = useCallback(
    async (artist: Artist) => {
      // Re-entrancy guard scoped to this artist only (a double-tap), so resends
      // to other singers can still run in parallel.
      if (resendingIds.has(artist.id)) return;
      setResendingIds((prev) => new Set(prev).add(artist.id));
      const toastId = toast.loading(
        t("artists.toast.resending_activation", "Wysyłanie zaproszenia..."),
      );
      try {
        await resendActivationMutation.mutateAsync(artist.id);
        toast.success(
          t("artists.toast.resent_activation_success", {
            defaultValue: "Ponownie wysłano zaproszenie na {{email}}.",
            email: artist.email ?? "",
          }),
          { id: toastId },
        );
      } catch (err) {
        toastApiError(err, t, {
          id: toastId,
          fallbackDescription: t(
            "artists.toast.resend_activation_error_desc",
            "Nie udało się wysłać zaproszenia aktywacyjnego.",
          ),
        });
      } finally {
        setResendingIds((prev) => {
          const next = new Set(prev);
          next.delete(artist.id);
          return next;
        });
      }
    },
    [resendActivationMutation, resendingIds, t],
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
      toastApiError(err, t, {
        id: toastId,
        fallbackDescription: t(
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
    section,
    filters,
    searchTerm,
    setSearchTerm,
    rangeFilter,
    setRangeFilter,
    sortBy,
    setSortBy,
    quickFilter,
    setQuickFilter,
    resetFilters,
    sectionCounts,
    quickFilterCounts,
    baseTotal,
    isNarrowed,
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
    handleResendActivation,
    resendingIds,
  };
};
