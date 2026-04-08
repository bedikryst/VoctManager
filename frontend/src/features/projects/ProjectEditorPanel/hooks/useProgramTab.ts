/**
 * @file useProgramTab.ts
 * @description Encapsulates DnD logic, API synchronization, and dirty-state tracking
 * for the Project Program manager. Strictly synchronizes unsaved changes with the parent panel.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useProgramTab
 */

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import type { Piece } from "../../../../shared/types";
import {
  useProjectProgram,
  useCreateProgramItem,
  useUpdateProgramItem,
  useDeleteProgramItem,
} from "../../api/project.queries";
import { useProjectData } from "../../hooks/useProjectData";

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
  const { pieces } = useProjectData(projectId);

  const createProgramMutation = useCreateProgramItem(projectId);
  const updateProgramMutation = useUpdateProgramItem(projectId);
  const deleteProgramMutation = useDeleteProgramItem(projectId);

  const [programItems, setProgramItems] = useState<ProgramItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: fetchedProgram, isLoading } = useProjectProgram(projectId);

  useEffect(() => {
    if (fetchedProgram) setProgramItems(fetchedProgram as ProgramItem[]);
  }, [fetchedProgram]);

  const isDirty = useMemo(() => {
    if (!fetchedProgram) return false;
    const currentOrderIds = programItems.map((item) => item.id).join(",");
    const originalOrderIds = fetchedProgram.map((item) => item.id).join(",");
    return currentOrderIds !== originalOrderIds;
  }, [programItems, fetchedProgram]);

  useEffect(() => {
    if (onDirtyStateChange) {
      onDirtyStateChange(isDirty);
    }
  }, [isDirty, onDirtyStateChange]);

  const totalConcertDurationSeconds = useMemo<number>(() => {
    return programItems.reduce((sum, item) => {
      const pieceId = item.piece_id || item.piece;
      const piece = pieces.find(
        (candidate) => String(candidate.id) === pieceId,
      );
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

    const targetPiece = pieces.find((p) => String(p.id) === pieceId);
    if (!targetPiece) return;

    const toastId = toast.loading(
      t("projects.program.toast.adding", "Dodawanie utworu..."),
    );

    try {
      const safeTimeOrder = Math.floor(Date.now() / 10) % 100000000;
      await createProgramMutation.mutateAsync({
        title: targetPiece.title,
        project: projectId,
        piece: pieceId,
        order: safeTimeOrder,
        is_encore: false,
      });
      toast.success(
        t("projects.program.toast.add_success", "Dodano do setlisty"),
        { id: toastId },
      );
    } catch (error: unknown) {
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
      await updateProgramMutation.mutateAsync({
        id: item.id,
        data: { is_encore: !item.is_encore },
      });
      toast.success(
        t(
          "projects.program.toast.encore_toggled",
          "Status BIS został zaktualizowany",
        ),
      );
    } catch (error: unknown) {
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
      await deleteProgramMutation.mutateAsync(itemId);
      toast.success(
        t("projects.program.toast.remove_success", "Usunięto z programu"),
        { id: toastId },
      );
    } catch (error: unknown) {
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
          updateProgramMutation.mutateAsync({
            id: item.id,
            data: { order: baseSaveOrder + index },
          }),
        ),
      );

      toast.success(
        t(
          "projects.program.toast.save_order_success",
          "Układ zapisany pomyślnie",
        ),
        { id: toastId },
      );
    } catch (error: unknown) {
      toast.error(t("common.errors.save_error", "Błąd zapisu"), {
        id: toastId,
        description: t(
          "projects.program.toast.save_order_error",
          "Serwer odrzucił część zmian.",
        ),
      });
      handleCancel(); // Wycofaj zmiany na froncie w razie błędu
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
