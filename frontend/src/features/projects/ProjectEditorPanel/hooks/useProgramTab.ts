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
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import type { Piece, ProgramItem as ProjectProgramItem } from "@/shared/types";
import {
  useProjectProgram,
  useCreateProgramItem,
  useUpdateProgramItem,
  useDeleteProgramItem,
} from "../../api/project.queries";
import { useProjectData } from "../../hooks/useProjectData";
import type { ProgramTabItem } from "../types";

export interface UseProgramTabResult {
  programItems: ProgramTabItem[];
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  totalConcertDurationSeconds: number;
  addedPieceIds: string[];
  filteredPieces: Piece[];
  pieces: Piece[];
  handleAddPiece: (pieceId: string) => Promise<void>;
  handleToggleEncore: (item: ProgramTabItem) => Promise<void>;
  handleDeleteItem: (itemId: string) => Promise<void>;
  handleDragEnd: (event: DragEndEvent) => void;
  handleCancel: () => void;
  handleSaveChanges: () => Promise<void>;
}

const normalizeProgramItem = (
  item: ProjectProgramItem,
  pieces: Piece[],
): ProgramTabItem => {
  const pieceId = String(item.piece_id ?? item.piece);
  const matchedPiece = pieces.find((piece) => String(piece.id) === pieceId);

  return {
    id: String(item.id),
    order: item.order,
    piece: String(item.piece),
    piece_id: item.piece_id ? String(item.piece_id) : undefined,
    piece_title:
      item.piece_title ?? item.title ?? matchedPiece?.title ?? "Untitled piece",
    is_encore: item.is_encore,
  };
};

export const useProgramTab = (
  projectId: string,
  onDirtyStateChange?: (isDirty: boolean) => void,
): UseProgramTabResult => {
  const { t } = useTranslation();
  const { pieces } = useProjectData(projectId);

  const createProgramMutation = useCreateProgramItem(projectId);
  const updateProgramMutation = useUpdateProgramItem(projectId);
  const deleteProgramMutation = useDeleteProgramItem(projectId);

  const [programItems, setProgramItems] = useState<ProgramTabItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: fetchedProgram, isLoading } = useProjectProgram(projectId);

  useEffect(() => {
    if (fetchedProgram) {
      setProgramItems(
        fetchedProgram.map((item) => normalizeProgramItem(item, pieces)),
      );
    }
  }, [fetchedProgram, pieces]);

  const isDirty = useMemo(() => {
    if (!fetchedProgram) return false;
    const currentOrderIds = programItems.map((item) => item.id).join(",");
    const originalOrderIds = fetchedProgram
      .map((item) => String(item.id))
      .join(",");
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
    const nextOrder =
      programItems.reduce(
        (highestOrder, item) => Math.max(highestOrder, item.order),
        0,
      ) + 1;

    await createProgramMutation.mutateAsync({
      title: targetPiece.title,
      project: projectId,
      piece: pieceId,
      order: nextOrder,
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

  const handleToggleEncore = async (item: ProgramTabItem): Promise<void> => {
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
        if (oldIndex < 0 || newIndex < 0) {
          return items;
        }
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleCancel = () => {
    if (fetchedProgram) {
      setProgramItems(
        fetchedProgram.map((item) => normalizeProgramItem(item, pieces)),
      );
    }
  };

  const handleSaveChanges = async (): Promise<void> => {
    if (!isDirty) return;

    setIsSaving(true);
    const toastId = toast.loading(
      t("projects.program.toast.saving_order", "Zapisywanie nowego układu..."),
    );

    try {
      await Promise.all(
        programItems.map((item, index) =>
          updateProgramMutation.mutateAsync({
            id: item.id,
            data: { order: index + 1 },
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
      handleCancel();
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
