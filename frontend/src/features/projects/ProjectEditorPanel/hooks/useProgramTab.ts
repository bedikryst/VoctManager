/**
 * @file useProgramTab.ts
 * @description Encapsulates DnD logic, API synchronization, and dirty-state tracking
 * for the Project Program (Setlist) manager.
 * Relies on React Query structural sharing (useProjectData) instead of Context APIs.
 * @module panel/projects/ProjectEditorPanel/hooks/useProgramTab
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import api from "../../../../shared/api/api";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { useProjectData } from "../../hooks/useProjectData";
import type { Piece } from "../../../../shared/types";

export interface ProgramItem {
  id: string | number;
  order: number;
  piece: string | number;
  piece_id?: string | number;
  piece_title: string;
  is_encore: boolean;
}

export const useProgramTab = (projectId: string) => {
  const queryClient = useQueryClient();

  // Zaciąganie słownika utworów
  const { pieces } = useProjectData(projectId);

  const [programItems, setProgramItems] = useState<ProgramItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const {
    data: fetchedProgram,
    isLoading,
    refetch,
  } = useQuery<ProgramItem[]>({
    queryKey: queryKeys.program.byProject(projectId),
    queryFn: async () => {
      const res = await api.get(`/api/program-items/?project=${projectId}`);
      const items = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      return items.sort((a: ProgramItem, b: ProgramItem) => a.order - b.order);
    },
  });

  useEffect(() => {
    if (fetchedProgram) setProgramItems(fetchedProgram);
  }, [fetchedProgram]);

  const isDirty = useMemo(() => {
    if (!fetchedProgram) return false;
    const currentOrderIds = programItems.map((i) => i.id).join(",");
    const originalOrderIds = fetchedProgram.map((i) => i.id).join(",");
    return currentOrderIds !== originalOrderIds;
  }, [programItems, fetchedProgram]);

  const totalConcertDurationSeconds = useMemo<number>(() => {
    return programItems.reduce((sum, item) => {
      const pieceId = item.piece_id || item.piece;
      const pieceObj = pieces.find((p) => String(p.id) === String(pieceId));
      return sum + (pieceObj?.estimated_duration || 0);
    }, 0);
  }, [programItems, pieces]);

  const addedPieceIds = useMemo<string[]>(() => {
    return programItems.map((item) => String(item.piece_id || item.piece));
  }, [programItems]);

  const filteredPieces = useMemo<Piece[]>(() => {
    if (!searchQuery) return pieces;
    const term = searchQuery.toLowerCase();
    return pieces.filter((p) => p.title.toLowerCase().includes(term));
  }, [pieces, searchQuery]);

  const handleAddPiece = async (pieceId: string | number): Promise<void> => {
    if (addedPieceIds.includes(String(pieceId))) return;

    const toastId = toast.loading("Dodawanie utworu...");
    try {
      const safeTimeOrder = Math.floor(Date.now() / 10) % 100000000;
      await api.post("/api/program-items/", {
        project: projectId,
        piece: pieceId,
        order: safeTimeOrder,
        is_encore: false,
      });
      await refetch();
      toast.success("Dodano do setlisty", { id: toastId });
    } catch (err) {
      toast.error("Błąd zapisu", {
        id: toastId,
        description: "Nie powiodło się dodanie utworu.",
      });
    }
  };

  const handleToggleEncore = async (item: ProgramItem): Promise<void> => {
    try {
      await api.patch(`/api/program-items/${item.id}/`, {
        is_encore: !item.is_encore,
      });
      await refetch();
      toast.success(
        `Utwór ${!item.is_encore ? "oznaczony jako" : "usunięty z"} BIS`,
      );
    } catch (err) {
      toast.error("Błąd połączenia. Nie udało się zmienić statusu BIS.");
    }
  };

  const handleDeleteItem = async (itemId: string | number): Promise<void> => {
    const toastId = toast.loading("Usuwanie utworu...");
    try {
      await api.delete(`/api/program-items/${itemId}/`);
      await refetch();
      toast.success("Usunięto z programu", { id: toastId });
    } catch (err) {
      toast.error("Błąd usuwania", {
        id: toastId,
        description: "Wystąpił problem z serwerem.",
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setProgramItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleCancel = () => {
    if (fetchedProgram) setProgramItems(fetchedProgram);
  };

  const handleSaveChanges = async (): Promise<void> => {
    if (!isDirty) return;
    setIsSaving(true);
    const toastId = toast.loading("Zapisywanie nowego układu...");

    try {
      const baseSaveOrder = Math.floor(Date.now() / 10) % 100000000;
      const syncPromises = programItems.map((item, index) =>
        api.patch(`/api/program-items/${item.id}/`, {
          order: baseSaveOrder + index,
        }),
      );

      await Promise.all(syncPromises);
      await refetch();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.pieceCastings.all,
      });

      toast.success("Układ zapisany pomyślnie", { id: toastId });
    } catch (err) {
      toast.error("Błąd zapisu", {
        id: toastId,
        description: "Serwer odrzucił część zmian. Odświeżam widok.",
      });
      await refetch();
    } finally {
      setIsSaving(false);
    }
  };

  return {
    programItems,
    isLoading,
    isSaving,
    isDirty,
    searchQuery,
    setSearchQuery,
    totalConcertDurationSeconds,
    addedPieceIds,
    filteredPieces,
    pieces,
    handleAddPiece,
    handleToggleEncore,
    handleDeleteItem,
    handleDragEnd,
    handleCancel,
    handleSaveChanges,
  };
};
