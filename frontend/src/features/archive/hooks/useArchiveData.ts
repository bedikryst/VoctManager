/**
 * @file useArchiveData.ts
 * @description Encapsulates purely visual state, filtering logic, and modal visibility
 * for the Archive domain. Server state is fully delegated to React Query hooks.
 * The search and filters survive a visit to a piece card: they are read from
 * the library's query string on arrival and mirrored back into it as they
 * change (`libraryScope.ts`).
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { toastApiError } from "@/shared/api/errors";
import { useTranslation } from "react-i18next";
import {
  usePieces,
  useComposers,
  useDeletePiece,
} from "../api/archive.queries";
import { useVoiceLines } from "@/shared/api/options.queries";
import { EnrichedPiece } from "../types/archive.dto";
import { hasPdf } from "../constants/piecePdfs";
import {
  filtersFromParams,
  filtersToParams,
  matchesLibraryFilters,
  matchesQuickFilter,
  type LibraryFilters,
  type LibraryQuickFilter,
} from "../constants/libraryScope";

export const useArchiveData = () => {
  const { t } = useTranslation();
  // 1. Server State delegation (Zero HTTP logic here)
  const {
    data: pieces = [],
    isLoading: isLoadingPieces,
    isError: isErrorPieces,
  } = usePieces();
  const { data: composers = [], isLoading: isLoadingComposers } =
    useComposers();
  const { data: voiceLines = [], isLoading: isLoadingVoiceLines } =
    useVoiceLines();
  const deleteMutation = useDeletePiece();

  // 2. Client UI State
  // The URL is read once, on arrival. While the library is open the inputs own
  // the filters and the query string only mirrors them, so a keystroke never
  // waits on a navigation.
  const location = useLocation();
  const navigate = useNavigate();
  const [arrivalFilters] = useState<LibraryFilters>(() =>
    filtersFromParams(new URLSearchParams(location.search)),
  );
  const [searchTerm, setSearchTerm] = useState<string>(arrivalFilters.search);
  const [epochFilter, setEpochFilter] = useState<string>(arrivalFilters.epoch);
  const [composerFilter, setComposerFilter] = useState<string>(arrivalFilters.composer);
  const [voicingFilter, setVoicingFilter] = useState<string>(arrivalFilters.voicing);
  const [quickFilter, setQuickFilter] = useState<LibraryQuickFilter | "">(arrivalFilters.only);
  const normalizedSearchTerm = searchTerm.trim();

  const filters = useMemo<LibraryFilters>(
    () => ({
      search: searchTerm,
      epoch: epochFilter,
      composer: composerFilter,
      voicing: voicingFilter,
      only: quickFilter,
    }),
    [searchTerm, epochFilter, composerFilter, voicingFilter, quickFilter],
  );

  // Replaced, not pushed: the back button leaves the library rather than
  // undoing a filter one keystroke at a time.
  const filterQuery = filtersToParams(filters).toString();
  useEffect(() => {
    const search = filterQuery ? `?${filterQuery}` : "";
    if (search === location.search) return;
    navigate({ search }, { replace: true });
  }, [filterQuery, location.search, navigate]);

  // Modal & Context State
  const [pieceToDelete, setPieceToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // PieceSerializer embeds composer as a nested object directly — no manual
  // enrichment, just a fetch for the filter dropdown.
  const displayPieces: EnrichedPiece[] = useMemo(
    () => pieces.filter((piece) => matchesLibraryFilters(piece, filters)),
    [pieces, filters],
  );

  const availableVoicings = useMemo(
    () =>
      Array.from(
        new Set(
          pieces
            .map((piece) => piece.voicing?.trim())
            .filter((voicing): voicing is string => Boolean(voicing)),
        ),
      ).sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" }),
      ),
    [pieces],
  );

  // A quick filter's size belongs to the LIBRARY, not to the current filter:
  // read against a filtered list the review backlog silently reported zero
  // whenever a composer filter happened to exclude it, while the total beside
  // it stayed library-wide.
  const quickFilterCounts = useMemo<Readonly<Record<LibraryQuickFilter, number>>>(
    () => ({
      review: pieces.filter((piece) => matchesQuickFilter(piece, "review")).length,
      no_pdf: pieces.filter((piece) => matchesQuickFilter(piece, "no_pdf")).length,
    }),
    [pieces],
  );

  // A quick filter whose count reaches zero (the last piece reviewed, the last
  // PDF uploaded) switches itself off: its chip is gone, so nothing else could,
  // and the list behind it would stay empty.
  if (quickFilter && !isLoadingPieces && quickFilterCounts[quickFilter] === 0) {
    setQuickFilter("");
  }

  const libraryStats = useMemo(() => {
    const uniqueComposers = new Set(
      pieces
        .map((piece) => piece.composer?.id)
        .filter((value): value is string => Boolean(value)),
    );
    const uniqueVoicings = new Set(
      pieces
        .map((piece) => piece.voicing?.trim())
        .filter((value): value is string => Boolean(value)),
    );

    return {
      totalPieces: pieces.length,
      withPdf: pieces.filter((p) => hasPdf(p)).length,
      piecesWithAudio: pieces.filter((p) => (p.tracks?.length ?? 0) > 0).length,
      totalAudio: pieces.reduce((sum, p) => sum + (p.tracks?.length || 0), 0),
      withReferenceLinks: pieces.filter(
        (p) => (p.recordings?.length ?? 0) > 0,
      ).length,
      uniqueComposers: uniqueComposers.size,
      uniqueVoicings: uniqueVoicings.size,
    };
  }, [pieces]);

  const hasActiveFilters = Boolean(
    normalizedSearchTerm || epochFilter || composerFilter || voicingFilter || quickFilter,
  );

  // What the "Filtry" toggle counts: the search and the panel's filters, not
  // the quick filter, whose own chip already shows it pressed.
  const activeFilterCount = [
    normalizedSearchTerm,
    epochFilter,
    composerFilter,
    voicingFilter,
  ].filter(Boolean).length;

  // 5. UI Actions
  const handleDeleteRequest = useCallback((id: string, title: string) => {
    setPieceToDelete({ id, title });
  }, []);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setEpochFilter("");
    setComposerFilter("");
    setVoicingFilter("");
    setQuickFilter("");
  }, []);

  const executeDelete = async () => {
    if (!pieceToDelete) return;

    const toastId = toast.loading(
      t("archive.toast.delete_loading", 'Usuwanie "{{title}}"...', {
        title: pieceToDelete.title,
      }),
    );

    try {
      await deleteMutation.mutateAsync(pieceToDelete.id);
      toast.success(
        t("archive.toast.delete_success", "Utwór został usunięty z biblioteki."),
        {
          id: toastId,
        },
      );
    } catch (err) {
      toastApiError(err, t, {
        id: toastId,
        fallbackDescription: t(
          "archive.toast.delete_error_desc",
          "Upewnij się, że utwór nie jest powiązany z aktywnymi projektami.",
        ),
      });
    } finally {
      setPieceToDelete(null);
    }
  };

  return {
    // State
    isLoading: isLoadingPieces || isLoadingComposers || isLoadingVoiceLines,
    isError: isErrorPieces,
    displayPieces,
    quickFilterCounts,
    composers,
    voiceLines,
    libraryStats,
    availableVoicings,
    hasActiveFilters,
    activeFilterCount,

    // Filters
    filters,
    searchTerm,
    setSearchTerm,
    epochFilter,
    setEpochFilter,
    composerFilter,
    setComposerFilter,
    voicingFilter,
    setVoicingFilter,
    quickFilter,
    setQuickFilter,
    resetFilters,

    // UI Context
    pieceToDelete,
    setPieceToDelete,

    // Actions
    handleDeleteRequest,
    executeDelete,
    isDeleting: deleteMutation.isPending,
  };
};
