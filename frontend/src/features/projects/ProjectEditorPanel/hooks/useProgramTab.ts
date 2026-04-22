/**
 * @file useProgramTab.ts
 * @description Encapsulates DnD logic, API synchronization, and dirty-state tracking
 * for the Project Program manager. Strictly synchronizes unsaved changes with the parent panel.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/hooks/useProgramTab
 */

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Piece, ProgramItem } from "@/shared/types";
import {
  projectKeys,
  useCreateProgramItem,
  useDeleteProgramItem,
  useProjectPiecesDictionary,
  useProjectProgram,
  useUpdateProgramItem,
} from "../../api/project.queries";
import { ProjectService } from "../../api/project.service";
import type { ProgramTabItem } from "../types";

export interface UseProgramTabResult {
  programItems: ProgramTabItem[];
  isSaving: boolean;
  isDirty: boolean;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
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
  item: ProgramItem,
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
  const queryClient = useQueryClient();

  const { data: pieces } = useProjectPiecesDictionary();
  const { data: fetchedProgram } = useProjectProgram(projectId);

  const createProgramMutation = useCreateProgramItem(projectId);
  const updateProgramMutation = useUpdateProgramItem(projectId);
  const deleteProgramMutation = useDeleteProgramItem(projectId);

  const [programItems, setProgramItems] = useState<ProgramTabItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setProgramItems(
      fetchedProgram.map((programItem) => normalizeProgramItem(programItem, pieces)),
    );
  }, [fetchedProgram, pieces]);

  const isDirty = useMemo(() => {
    const currentOrderIds = programItems.map((item) => item.id).join(",");
    const originalOrderIds = fetchedProgram.map((item) => String(item.id)).join(",");
    return currentOrderIds !== originalOrderIds;
  }, [fetchedProgram, programItems]);

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  const totalConcertDurationSeconds = useMemo(
    () =>
      programItems.reduce((sum, item) => {
        const pieceId = item.piece_id ?? item.piece;
        const piece = pieces.find((candidate) => String(candidate.id) === pieceId);
        return sum + (piece?.estimated_duration || 0);
      }, 0),
    [pieces, programItems],
  );

  const addedPieceIds = useMemo(
    () => programItems.map((item) => item.piece_id || item.piece),
    [programItems],
  );

  const filteredPieces = useMemo(() => {
    if (!searchQuery) {
      return pieces;
    }

    const normalizedQuery = searchQuery.toLowerCase();

    return pieces.filter((piece) =>
      piece.title.toLowerCase().includes(normalizedQuery),
    );
  }, [pieces, searchQuery]);

  const handleAddPiece = async (pieceId: string): Promise<void> => {
    if (addedPieceIds.includes(pieceId)) {
      return;
    }

    const targetPiece = pieces.find((piece) => String(piece.id) === pieceId);

    if (!targetPiece) {
      return;
    }

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
    } catch {
      toast.error(t("common.errors.save_error", "BĹ‚Ä…d zapisu"), {
        id: toastId,
        description: t(
          "projects.program.toast.add_error",
          "Nie powiodĹ‚o siÄ™ dodanie utworu.",
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
          "Status BIS zostaĹ‚ zaktualizowany",
        ),
      );
    } catch {
      toast.error(
        t(
          "projects.program.toast.encore_error",
          "BĹ‚Ä…d poĹ‚Ä…czenia. Nie udaĹ‚o siÄ™ zmieniÄ‡ statusu BIS.",
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
        t("projects.program.toast.remove_success", "UsuniÄ™to z programu"),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.actions.delete_error", "BĹ‚Ä…d usuwania"), {
        id: toastId,
        description: t(
          "common.errors.server_problem",
          "WystÄ…piĹ‚ problem z serwerem.",
        ),
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setProgramItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return items;
      }

      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleCancel = (): void => {
    setProgramItems(
      fetchedProgram.map((programItem) => normalizeProgramItem(programItem, pieces)),
    );
  };

  const handleSaveChanges = async (): Promise<void> => {
    if (!isDirty) {
      return;
    }

    setIsSaving(true);

    const toastId = toast.loading(
      t("projects.program.toast.saving_order", "Zapisywanie nowego ukĹ‚adu..."),
    );

    const persistOrders = async (
      items: ProgramTabItem[],
      targetOrderById: Map<string, number>,
      tempOrderBase: number,
    ): Promise<void> => {
      for (const [index, item] of items.entries()) {
        await ProjectService.updateProgramItem(item.id, {
          order: tempOrderBase + index,
        });
      }

      const sortedByTargetOrder = [...items].sort(
        (left, right) =>
          (targetOrderById.get(left.id) ?? 0) - (targetOrderById.get(right.id) ?? 0),
      );

      for (const item of sortedByTargetOrder) {
        const targetOrder = targetOrderById.get(item.id);

        if (targetOrder === undefined) {
          continue;
        }

        await ProjectService.updateProgramItem(item.id, { order: targetOrder });
      }
    };

    try {
      const reorderedItems = programItems.map((item, index) => ({
        ...item,
        order: index + 1,
      }));

      const originalById = new Map(
        fetchedProgram.map((programItem) => [String(programItem.id), programItem]),
      );
      const targetOrderById = new Map(
        reorderedItems.map((item) => [item.id, item.order]),
      );
      const changedItems = reorderedItems.filter((item) => {
        const originalItem = originalById.get(item.id);
        return originalItem && originalItem.order !== item.order;
      });

      if (changedItems.length === 0) {
        setIsSaving(false);
        toast.dismiss(toastId);
        return;
      }

      const originalOrderById = new Map(
        changedItems.map((item) => [
          item.id,
          originalById.get(item.id)?.order ?? item.order,
        ]),
      );
      const maxKnownOrder = Math.max(
        0,
        ...fetchedProgram.map((programItem) => programItem.order),
        ...reorderedItems.map((item) => item.order),
      );
      const tempOrderBase = maxKnownOrder + changedItems.length + 1;

      await persistOrders(changedItems, targetOrderById, tempOrderBase);

      const nextProgram = fetchedProgram
        .map((programItem) => ({
          ...programItem,
          order:
            targetOrderById.get(String(programItem.id)) ?? programItem.order,
        }))
        .sort((left, right) => left.order - right.order);

      queryClient.setQueryData<ProgramItem[]>(
        projectKeys.program.byProject(projectId),
        nextProgram,
      );
      setProgramItems(
        reorderedItems.map((programItem) => normalizeProgramItem(programItem, pieces)),
      );

      await queryClient.invalidateQueries({
        queryKey: projectKeys.program.byProject(projectId),
      });
      await queryClient.invalidateQueries({
        queryKey: projectKeys.program.all,
      });

      toast.success(
        t(
          "projects.program.toast.save_order_success",
          "UkĹ‚ad zapisany pomyĹ›lnie",
        ),
        { id: toastId },
      );
    } catch {
      const reorderedItems = programItems.map((item, index) => ({
        ...item,
        order: index + 1,
      }));
      const originalById = new Map(
        fetchedProgram.map((programItem) => [String(programItem.id), programItem]),
      );
      const changedItems = reorderedItems.filter((item) => {
        const originalItem = originalById.get(item.id);
        return originalItem && originalItem.order !== item.order;
      });
      const originalOrderById = new Map(
        changedItems.map((item) => [
          item.id,
          originalById.get(item.id)?.order ?? item.order,
        ]),
      );
      const maxKnownOrder = Math.max(
        0,
        ...fetchedProgram.map((programItem) => programItem.order),
        ...reorderedItems.map((item) => item.order),
      );

      try {
        await persistOrders(
          changedItems,
          originalOrderById,
          maxKnownOrder + changedItems.length * 2 + 1,
        );
      } catch {
      }

      await queryClient.invalidateQueries({
        queryKey: projectKeys.program.byProject(projectId),
      });
      await queryClient.invalidateQueries({
        queryKey: projectKeys.program.all,
      });

      toast.error(t("common.errors.save_error", "BĹ‚Ä…d zapisu"), {
        id: toastId,
        description: t(
          "projects.program.toast.save_order_error",
          "Serwer odrzuciĹ‚ czÄ™Ĺ›Ä‡ zmian.",
        ),
      });

      handleCancel();
    } finally {
      setIsSaving(false);
    }
  };

  return {
    programItems,
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
