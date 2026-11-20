/**
 * @file usePieceAutosave.ts
 * @description Serial commits and field-scoped undo for piece card edits.
 */

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { toastApiError } from "@/shared/api/errors";
import type { Piece } from "@/shared/types";
import { archiveKeys, useUpdatePiece, useVerifyPieceField } from "../api/archive.queries";
import { isAiProvenance, pieceFieldProvenance } from "../components/ProvenanceChip";
import type { PiecePatchDTO } from "../types/archive.dto";

type EditableFields = Omit<PiecePatchDTO, "starting_pitches" | "voice_requirements">;
type Field = keyof EditableFields;

const readField = <K extends Field>(piece: Piece, field: K): EditableFields[K] => {
  const values: EditableFields = {
    ...piece,
    composer_id: piece.composer ? String(piece.composer.id) : null,
    composition_year: piece.composition_year ?? null,
    estimated_duration: piece.estimated_duration ?? null,
  };
  return values[field];
};

// PATCH merges with the stored piece on the server. Two requests for the same
// piece must not read the same starting state, even if the route remounts.
const tails = new Map<string, Promise<void>>();

export const usePieceAutosave = (pieceId: string) => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { mutateAsync: update } = useUpdatePiece({ primeDetail: true });
  const { mutateAsync: verify } = useVerifyPieceField();
  const [status, setStatus] = useState({ pending: 0, failed: false });
  const confirmations = useRef(new Set<string>());
  const [confirming, setConfirming] = useState<ReadonlySet<string>>(new Set());
  const detailKey = archiveKeys.pieces.details(pieceId);
  const getPiece = () => qc.getQueryData<Piece>(detailKey);

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

  const showSaveError = (error: unknown) => toastApiError(error, t, {
    fallbackDescription: t("archive.piece_card.autosave_failed"),
  });

  const save = <K extends Field>(field: K, next: Exclude<EditableFields[K], undefined>): Promise<void> =>
    enqueue(async () => {
      const piece = getPiece();
      if (!piece) throw new Error("Piece missing from the detail cache");
      const previous = readField(piece, field) ?? (field === "composer_id" ||
        field === "composition_year" || field === "estimated_duration" ? null : "");
      if (previous === next) return;

      const saved = await update({ id: pieceId, data: { [field]: next } });
      const savedValue = readField(saved, field);
      const toastId = `piece-field:${pieceId}:${field}`;
      toast.success(t("common.autosave.saved"), {
        id: toastId,
        action: {
          label: t("common.actions.undo"),
          onClick: () => {
            void enqueue(async () => {
              const current = getPiece();
              if (!current || readField(current, field) !== savedValue) {
                toast.info(t("archive.piece_card.undo_superseded"));
                return;
              }
              await update({ id: pieceId, data: { [field]: previous } });
            }).catch(showSaveError);
          },
        },
      });
    });

  const confirm = (field: Field): void => {
    const key = `${pieceId}:${field}`;
    if (confirmations.current.has(key)) return;
    confirmations.current.add(key);
    setConfirming(new Set(confirmations.current));
    void enqueue(async () => {
      const piece = getPiece();
      if (!piece || !isAiProvenance(pieceFieldProvenance(piece, field))) return;
      await qc.cancelQueries({ queryKey: detailKey });
      await verify({ pieceId, field });
    }).catch(() => {
      toast.error(t("archive.piece_card.verify_failed"));
    }).finally(() => {
      confirmations.current.delete(key);
      setConfirming(new Set(confirmations.current));
    });
  };

  return {
    save,
    confirm,
    isConfirming: (field: Field) => confirming.has(`${pieceId}:${field}`),
    showSaveError,
    isSaving: status.pending > 0,
    saveFailed: status.failed,
  };
};

export type PieceAutosave = ReturnType<typeof usePieceAutosave>;
