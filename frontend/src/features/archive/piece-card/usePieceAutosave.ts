/**
 * @file usePieceAutosave.ts
 * @description Serial commits, unresolved drafts, and conditional undo on the piece card.
 */

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { parseApiError, toastApiError } from "@/shared/api/errors";
import type { Piece } from "@/shared/types";
import { archiveKeys, useVerifyPieceField } from "../api/archive.queries";
import { ArchiveService, type PieceFieldTarget } from "../api/archive.service";
import { childFieldProvenance, isAiProvenance, pieceFieldProvenance } from "../components/ProvenanceChip";
import type { PiecePatchDTO } from "../types/archive.dto";

type EditableFields = Omit<PiecePatchDTO, "starting_pitches" | "voice_requirements">;
type Field = keyof EditableFields;
type ReviewField = Field | "text";
type SavedValue = string | number | boolean | null;

interface Draft {
  label: string;
  id: string;
  discard: () => void;
  retry?: () => void;
}

export interface DraftField {
  key: string;
  label: string;
  setDraft: (key: string, draft: Draft | null) => void;
}

export const fieldKey = (field: string, objectId?: string) => objectId ? `${objectId}:${field}` : field;

const tails = new Map<string, Promise<void>>();

export const usePieceAutosave = (pieceId: string) => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { mutateAsync: verify } = useVerifyPieceField();
  const [status, setStatus] = useState({ pending: 0, failed: false });
  const confirmations = useRef(new Set<string>());
  const [confirming, setConfirming] = useState<ReadonlySet<string>>(new Set());
  const detailKey = archiveKeys.pieces.details(pieceId);
  const draftMap = useRef(new Map<string, Draft>());
  const [drafts, setDrafts] = useState<readonly Draft[]>([]);

  const setDraft = useCallback<DraftField["setDraft"]>((key, draft) => {
    if (draft) draftMap.current.set(key, draft);
    else if (!draftMap.current.delete(key)) return;
    setDrafts([...draftMap.current.values()]);
  }, []);

  const track = (field: string, label: string, objectId?: string): DraftField => ({
    key: fieldKey(field, objectId), label, setDraft,
  });

  const enqueue = <T,>(write: () => Promise<T>): Promise<T> => {
    setStatus(({ pending, failed }) => ({ pending: pending + 1, failed: pending > 0 && failed }));
    const request = (tails.get(pieceId) ?? Promise.resolve()).then(write);
    const tail = request.then(() => undefined, () => undefined);
    tails.set(pieceId, tail);

    return request
      .catch((error: unknown) => {
        setStatus((state) => ({ ...state, failed: true }));
        throw error;
      })
      .finally(() => {
        if (tails.get(pieceId) === tail) tails.delete(pieceId);
        setStatus((state) => ({ ...state, pending: state.pending - 1 }));
      });
  };

  const afterFieldsSaved = <T,>(fields: readonly string[] | null, write: () => Promise<T>) =>
    enqueue(async () => {
      const blocked = fields ? fields.some((key) => draftMap.current.has(key)) : draftMap.current.size > 0;
      if (!blocked) return write();
      toast.error(t("archive.piece_card.resolve_drafts_first"));
    });

  const showSaveError = (error: unknown) => toastApiError(error, t, {
    fallbackDescription: t("archive.piece_card.autosave_failed"),
  });

  const applyEdit = async (write: () => Promise<{ piece: Piece; receipt: string | null }>) => {
    await qc.cancelQueries({ queryKey: detailKey });
    const result = await write();
    await qc.cancelQueries({ queryKey: detailKey });
    qc.setQueryData(detailKey, result.piece);
    void qc.invalidateQueries({ queryKey: archiveKeys.pieces.all, exact: true });
    return result.receipt;
  };

  /**
   * A list-valued piece write, outside the field-edit endpoint and its undo
   * receipts. Call it inside `enqueue`: the server merges the PATCH into the
   * full record, so it must not overtake another write to the same piece.
   */
  const patchPiece = async (patch: Pick<PiecePatchDTO, "voice_requirements">): Promise<void> => {
    await applyEdit(async () => ({ piece: await ArchiveService.updatePiece(pieceId, patch), receipt: null }));
  };

  const commitDraft = <T,>(key: string, write: () => Promise<T>): Promise<T> => {
    const draft = draftMap.current.get(key);
    return enqueue(async () => {
      const result = await write();
      if (draft && draftMap.current.get(key) === draft) setDraft(key, null);
      return result;
    });
  };

  const saveField = (target: PieceFieldTarget, next: SavedValue): Promise<void> => {
    const key = fieldKey(target.field, target.object_id);
    return commitDraft(key, async () => {
      const receipt = await applyEdit(() => ArchiveService.editPieceField(pieceId, target, next));
      if (!receipt) return;

      toast.success(t("common.autosave.saved"), {
        id: `piece-field:${pieceId}:${key}`,
        action: {
          label: t("common.actions.undo"),
          onClick: () => {
            void afterFieldsSaved([key], async () => {
              try {
                await applyEdit(() => ArchiveService.undoPieceField(pieceId, target, receipt));
              } catch (error) {
                if (parseApiError(error).code !== "edit_superseded") throw error;
                void qc.invalidateQueries({ queryKey: detailKey });
                toast.info(t("archive.piece_card.undo_superseded"));
              }
            }).catch(showSaveError);
          },
        },
      });
    });
  };

  const save = <K extends Field>(field: K, next: Exclude<EditableFields[K], undefined>) => saveField({ field }, next);

  const saveChoice = (target: PieceFieldTarget, next: SavedValue, id: string, label: string) => {
    const key = fieldKey(target.field, target.object_id);
    const write = () => saveField(target, next);
    setDraft(key, {
      id, label,
      discard: () => setDraft(key, null),
      retry: () => void write().catch(showSaveError),
    });
    return write();
  };

  const confirm = (field: ReviewField, objectId?: string): void => {
    const key = fieldKey(field, objectId);
    if (confirmations.current.has(key)) return;
    confirmations.current.add(key);
    setConfirming(new Set(confirmations.current));
    void afterFieldsSaved([key], async () => {
      const piece = qc.getQueryData<Piece>(detailKey);
      if (!piece) return;
      const entry = objectId
        ? childFieldProvenance(piece, objectId, field)
        : pieceFieldProvenance(piece, field);
      if (!isAiProvenance(entry)) return;
      await qc.cancelQueries({ queryKey: detailKey });
      await verify({ pieceId, field, objectId });
    }).catch(() => {
      toast.error(t("archive.piece_card.verify_failed"));
    }).finally(() => {
      confirmations.current.delete(key);
      setConfirming(new Set(confirmations.current));
    });
  };

  return {
    save, saveField, saveChoice, patchPiece, track, drafts, enqueue, commitDraft, afterFieldsSaved, confirm, showSaveError,
    isConfirming: (field: ReviewField, objectId?: string) => confirming.has(fieldKey(field, objectId)),
    isSaving: status.pending > 0,
    saveFailed: status.failed || drafts.length > 0,
  };
};

export type PieceAutosave = ReturnType<typeof usePieceAutosave>;
