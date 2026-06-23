/**
 * @file useArchiveData.ts
 * @description Encapsulates purely visual state, filtering logic, and modal visibility
 * for the Archive domain. Server state is fully delegated to React Query hooks.
 * @architecture Enterprise SaaS 2026
 */

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/shared/api/errors";
import { useTranslation } from "react-i18next";
import {
  usePieces,
  useComposers,
  useDeletePiece,
} from "../api/archive.queries";
import { useVoiceLines } from "@/shared/api/options.queries";
import type { Piece } from "@/shared/types";
import { EnrichedPiece } from "../types/archive.dto";
import { hasPdf } from "../constants/piecePdfs";

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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [epochFilter, setEpochFilter] = useState<string>("");
  const [composerFilter, setComposerFilter] = useState<string>("");
  const [voicingFilter, setVoicingFilter] = useState<string>("");
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  // Modal & Context State
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);
  const [pieceToDelete, setPieceToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // PieceSerializer embeds composer as a nested object directly — no manual
  // enrichment, just a fetch for the filter dropdown.
  const displayPieces: EnrichedPiece[] = useMemo(() => {
    return pieces.filter((piece) => {
      const composerLabel = piece.composer
        ? `${piece.composer.first_name ?? ""} ${piece.composer.last_name}`
            .toLowerCase()
            .trim()
        : "";
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        piece.title.toLowerCase().includes(normalizedSearchTerm) ||
        composerLabel.includes(normalizedSearchTerm);
      const matchesEpoch = epochFilter ? piece.epoch === epochFilter : true;
      const matchesComposer = composerFilter
        ? piece.composer?.id === composerFilter
        : true;
      const matchesVoicing = voicingFilter
        ? piece.voicing === voicingFilter
        : true;

      return (
        matchesSearch && matchesEpoch && matchesComposer && matchesVoicing
      );
    });
  }, [
    pieces,
    normalizedSearchTerm,
    epochFilter,
    composerFilter,
    voicingFilter,
  ]);

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
    normalizedSearchTerm || epochFilter || composerFilter || voicingFilter,
  );

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
        t("archive.toast.delete_success", "Utwór został usunięty z archiwum."),
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
    composers,
    voiceLines,
    libraryStats,
    availableVoicings,
    hasActiveFilters,
    activeFilterCount,

    // Filters
    searchTerm,
    setSearchTerm,
    epochFilter,
    setEpochFilter,
    composerFilter,
    setComposerFilter,
    voicingFilter,
    setVoicingFilter,
    resetFilters,

    // UI Context
    isPanelOpen,
    setIsPanelOpen,
    editingPiece,
    setEditingPiece,
    pieceToDelete,
    setPieceToDelete,

    // Actions
    handleDeleteRequest,
    executeDelete,
    isDeleting: deleteMutation.isPending,
  };
};
