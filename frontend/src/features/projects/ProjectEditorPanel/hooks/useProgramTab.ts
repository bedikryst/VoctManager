/**
 * @file useProgramTab.ts
 * @description Encapsulates DnD logic, API synchronization, and dirty-state tracking
 * for the Project Program manager. Strictly synchronizes unsaved changes with the parent panel.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useProgramTab
 */

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import type { Piece } from "../../../../shared/types";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { useProjectProgram } from "../../api/project.queries";
import { ProjectService } from "../../api/project.service";
import { useProjectData } from "../../hooks/useProjectData";

// Zmienione ID na czysty string (zgodnie z UUID na backendzie)
export interface ProgramItem {
  id: string;
  order: number;
  piece: string;
  piece_id?: string;
  piece_title: string;
  is_encore: boolean;
}

export const useProgramTab = (
  projectId: string,
  onDirtyStateChange?: (isDirty: boolean) => void,
) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pieces } = useProjectData(projectId);
  const [programItems, setProgramItems] = useState<ProgramItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const {
    data: fetchedProgram,
    isLoading,
    refetch,
  } = useProjectProgram(projectId);

  useEffect(() => {
    if (fetchedProgram) setProgramItems(fetchedProgram as ProgramItem[]);
  }, [fetchedProgram]);

  const isDirty = useMemo(() => {
    if (!fetchedProgram) return false;
    const currentOrderIds = programItems.map((item) => item.id).join(",");
    const originalOrderIds = fetchedProgram.map((item) => item.id).join(",");
    return currentOrderIds !== originalOrderIds;
  }, [programItems, fetchedProgram]);

  // Synchronizacja brudnego stanu z rodzicem
  useEffect(() => {
    if (onDirtyStateChange) {
      onDirtyStateChange(isDirty);
    }
  }, [isDirty, onDirtyStateChange]);

  const totalConcertDurationSeconds = useMemo<number>(() => {
    return programItems.reduce((sum, item) => {
      const pieceId = item.piece_id || item.piece;
      const piece = pieces.find((candidate) => candidate.id === pieceId);
      return sum + (piece?.estimated_duration || 0);
    }, 0);
  }, [programItems, pieces]);

  const addedPieceIds = useMemo<string[]>(
    () => programItems.map((item) => item.piece_id || item.piece),
    [programItems],
  );

  const filteredPieces = useMemo<Piece[]>(() => {
    if (!searchQuery) return pieces;
    const normalizedQuery = searchQuery.toLowerCase();
    return pieces.filter((piece) =>
      piece.title.toLowerCase().includes(normalizedQuery),
    );
  }, [pieces, searchQuery]);

  const handleAddPiece = async (pieceId: string): Promise<void> => {
    if (addedPieceIds.includes(pieceId)) return;

    // Pobieramy cały obiekt utworu, aby wyciągnąć jego tytuł (wymagany przez DTO)
    const targetPiece = pieces.find((p) => p.id === pieceId);
    if (!targetPiece) return;

    const toastId = toast.loading(
      t("projects.program.toast.adding", "Dodawanie utworu..."),
    );

    try {
      const safeTimeOrder = Math.floor(Date.now() / 10) % 100000000;
      await ProjectService.createProgramItem({
        title: targetPiece.title, // Rozwiązanie problemu TS2345
        project: projectId,
        piece: pieceId,
        order: safeTimeOrder,
        is_encore: false,
      });
      await refetch();
      toast.success(
        t("projects.program.toast.add_success", "Dodano do setlisty"),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        id: toastId,
        description: t(
          "projects.program.toast.add_error",
          "Nie powiodło się dodanie utworu.",
        ),
      });
    }
  };

  const handleToggleEncore = async (item: ProgramItem): Promise<void> => {
    try {
      await ProjectService.updateProgramItem(item.id, {
        is_encore: !item.is_encore,
      });
      await refetch();
      toast.success(
        t(
          "projects.program.toast.encore_toggled",
          "Status BIS został zaktualizowany",
        ),
      );
    } catch {
      toast.error(
        t(
          "projects.program.toast.encore_error",
          "Błąd połączenia. Nie udało się zmienić statusu BIS.",
        ),
      );
    }
  };

  const handleDeleteItem = async (itemId: string): Promise<void> => {
    const toastId = toast.loading(
      t("projects.program.toast.removing", "Usuwanie utworu..."),
    );

    try {
      await ProjectService.deleteProgramItem(itemId);
      await refetch();
      toast.success(
        t("projects.program.toast.remove_success", "Usunięto z programu"),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.actions.delete_error", "Błąd usuwania"), {
        id: toastId,
        description: t(
          "common.errors.server_problem",
          "Wystąpił problem z serwerem.",
        ),
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setProgramItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleCancel = () => {
    if (fetchedProgram) setProgramItems(fetchedProgram as ProgramItem[]);
  };

  const handleSaveChanges = async (): Promise<void> => {
    if (!isDirty) return;

    setIsSaving(true);
    const toastId = toast.loading(
      t("projects.program.toast.saving_order", "Zapisywanie nowego układu..."),
    );

    try {
      const baseSaveOrder = Math.floor(Date.now() / 10) % 100000000;
      await Promise.all(
        programItems.map((item, index) =>
          ProjectService.updateProgramItem(item.id, {
            order: baseSaveOrder + index,
          }),
        ),
      );

      await refetch();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.pieceCastings.all,
      });

      toast.success(
        t(
          "projects.program.toast.save_order_success",
          "Układ zapisany pomyślnie",
        ),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        id: toastId,
        description: t(
          "projects.program.toast.save_order_error",
          "Serwer odrzucił część zmian. Odświeżam widok.",
        ),
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
