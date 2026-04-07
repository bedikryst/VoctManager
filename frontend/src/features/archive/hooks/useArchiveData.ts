/**
 * @file useArchiveData.ts
 * @description Encapsulates purely visual state, filtering logic, and modal visibility
 * for the Archive domain. Server state is fully delegated to React Query hooks.
 * @architecture Enterprise SaaS 2026
 */

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  usePieces,
  useComposers,
  useDeletePiece,
} from "../api/archive.queries";
import { useVoiceLines } from "../../../shared/api/options.queries";
import type { Piece } from "../../../shared/types";
import { EnrichedPiece } from "../types/archive.dto";

export const useArchiveData = () => {
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

  // Modal & Context State
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);
  const [pieceToDelete, setPieceToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // 3. Derived State (Client-side Filtering & Enrichment)
  const displayPieces: EnrichedPiece[] = useMemo(() => {
    return pieces
      .map((piece) => ({
        ...piece,
        composer: composers.find((c) => c.id === piece.composer) || undefined,
      }))
      .filter((piece) => {
        const matchesSearch =
          piece.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          piece.composer_name?.toLowerCase().includes(searchTerm.toLowerCase());
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
    composers,
    searchTerm,
    epochFilter,
    composerFilter,
    voicingFilter,
  ]);

  // 4. Derived State (Library Statistics) - WYMAGANE PRZEZ ARCHIVE MANAGEMENT
  const libraryStats = useMemo(() => {
    return {
      totalPieces: pieces.length,
      withPdf: pieces.filter((p) => !!p.sheet_music).length,
      totalAudio: pieces.reduce((sum, p) => sum + (p.tracks?.length || 0), 0),
    };
  }, [pieces]);

  // 5. UI Actions
  const handleDeleteRequest = useCallback((id: string, title: string) => {
    setPieceToDelete({ id, title });
  }, []);

  const executeDelete = async () => {
    if (!pieceToDelete) return;

    const toastId = toast.loading(`Deleting "${pieceToDelete.title}"...`);

    try {
      await deleteMutation.mutateAsync(pieceToDelete.id);
      toast.success("Piece permanently removed from the archive.", {
        id: toastId,
      });
    } catch (err) {
      toast.error("Deletion failed.", {
        id: toastId,
        description: "Ensure this piece is not linked to active projects.",
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

    // Filters
    searchTerm,
    setSearchTerm,
    epochFilter,
    setEpochFilter,
    composerFilter,
    setComposerFilter,
    voicingFilter,
    setVoicingFilter,

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
