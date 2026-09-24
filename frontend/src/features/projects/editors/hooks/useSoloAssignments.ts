/**
 * @file useSoloAssignments.ts
 * @description Draft controller for a piece's named solos, beside the divisi
 * board. It holds at most one draft — the open piece's — and commits it through
 * its own declarative write, so a board save and a solo save never carry each
 * other's rows. Legacy SOLO rows are read-only here; the one action on them is
 * conversion into a named position, which the server performs atomically.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/hooks/useSoloAssignments
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
  PieceCasting,
  ProjectSoloAssignment,
} from "@/shared/types";
import {
  useConvertLegacySolo,
  useProjectSolos,
  useSavePieceSolos,
} from "../../api/project.queries";
import {
  hasBlankSoloLabel,
  soloDraftsDiffer,
  soloPerformersByPiece,
  soloRowsFromServer,
  toSoloPayload,
  type SoloDraftRow,
} from "../../lib/soloAssignments";

type SoloRowPatch = Partial<
  Pick<
    SoloDraftRow,
    "label" | "scoreReference" | "participation" | "notes" | "givesPitch"
  >
>;

interface SoloDraft {
  readonly pieceId: string;
  readonly rows: SoloDraftRow[];
}

export interface UseSoloAssignmentsResult {
  /** The rows to show for a piece: the draft when it is the one being edited. */
  rowsFor: (pieceId: string) => readonly SoloDraftRow[];
  legacyFor: (pieceId: string) => readonly PieceCasting[];
  /** Participations holding a filled named or legacy solo, per piece. */
  performersByPiece: ReadonlyMap<string, ReadonlySet<string>>;
  isDirty: boolean;
  isSaving: boolean;
  hasBlankLabel: boolean;
  /** A save was refused for a blank name; the fields say which ones. */
  showLabelErrors: boolean;
  addRow: (pieceId: string) => void;
  updateRow: (pieceId: string, key: string, patch: SoloRowPatch) => void;
  moveRow: (pieceId: string, key: string, delta: -1 | 1) => void;
  removeRow: (pieceId: string, key: string) => void;
  /** Resolves true when nothing is left to save; false keeps the draft. */
  save: () => Promise<boolean>;
  discard: () => void;
  convertLegacy: (
    pieceId: string,
    castingId: string,
    label: string,
  ) => Promise<boolean>;
}

const EMPTY_ROWS: readonly SoloDraftRow[] = [];
const EMPTY_LEGACY: readonly PieceCasting[] = [];

const groupByPiece = <TItem extends { piece: string }>(
  items: readonly TItem[],
): Map<string, TItem[]> => {
  const grouped = new Map<string, TItem[]>();
  items.forEach((item) => {
    const pieceId = String(item.piece);
    grouped.set(pieceId, [...(grouped.get(pieceId) ?? []), item]);
  });
  return grouped;
};

export const useSoloAssignments = (
  projectId: string,
): UseSoloAssignmentsResult => {
  const { t } = useTranslation();
  const { data: solos } = useProjectSolos(projectId);
  const saveMutation = useSavePieceSolos(projectId);
  const convertMutation = useConvertLegacySolo(projectId);
  const [draft, setDraft] = useState<SoloDraft | null>(null);
  const [saveRefused, setSaveRefused] = useState(false);

  const savedRowsByPiece = useMemo(() => {
    const rows = new Map<string, SoloDraftRow[]>();
    groupByPiece<ProjectSoloAssignment>(solos.solo_assignments).forEach(
      (pieceSolos, pieceId) => rows.set(pieceId, soloRowsFromServer(pieceSolos)),
    );
    return rows;
  }, [solos.solo_assignments]);

  const legacyByPiece = useMemo(
    () => groupByPiece<PieceCasting>(solos.legacy_solos),
    [solos.legacy_solos],
  );

  const savedRowsFor = useCallback(
    (pieceId: string): readonly SoloDraftRow[] =>
      savedRowsByPiece.get(pieceId) ?? EMPTY_ROWS,
    [savedRowsByPiece],
  );

  const rowsFor = useCallback(
    (pieceId: string): readonly SoloDraftRow[] =>
      draft?.pieceId === pieceId ? draft.rows : savedRowsFor(pieceId),
    [draft, savedRowsFor],
  );

  const legacyFor = useCallback(
    (pieceId: string): readonly PieceCasting[] =>
      legacyByPiece.get(pieceId) ?? EMPTY_LEGACY,
    [legacyByPiece],
  );

  const isDirty =
    draft !== null && soloDraftsDiffer(draft.rows, savedRowsFor(draft.pieceId));
  const hasBlankLabel = draft !== null && hasBlankSoloLabel(draft.rows);

  // The rail and the instrumental reading follow the draft of the open piece,
  // so a position filled a moment ago already counts before it is saved.
  const performersByPiece = useMemo(() => {
    const performers = soloPerformersByPiece(
      solos.solo_assignments,
      solos.legacy_solos,
    );
    if (draft) {
      const drafted = new Set<string>(
        legacyFor(draft.pieceId).map((casting) => String(casting.participation)),
      );
      draft.rows.forEach((row) => {
        if (row.participation) drafted.add(row.participation);
      });
      performers.set(draft.pieceId, drafted);
    }
    return performers;
  }, [draft, legacyFor, solos.legacy_solos, solos.solo_assignments]);

  const edit = useCallback(
    (
      pieceId: string,
      transform: (rows: readonly SoloDraftRow[]) => SoloDraftRow[],
    ): void => {
      setDraft((previous) => ({
        pieceId,
        rows: transform(
          previous?.pieceId === pieceId ? previous.rows : savedRowsFor(pieceId),
        ),
      }));
    },
    [savedRowsFor],
  );

  const addRow = useCallback(
    (pieceId: string): void =>
      edit(pieceId, (rows) => [
        ...rows,
        {
          key: `temp-${Date.now()}-${rows.length}`,
          id: null,
          label: "",
          scoreReference: "",
          participation: null,
          notes: "",
          givesPitch: false,
          referenceNeedsReview: false,
        },
      ]),
    [edit],
  );

  const updateRow = useCallback(
    (pieceId: string, key: string, patch: SoloRowPatch): void =>
      edit(pieceId, (rows) =>
        rows.map((row) =>
          row.key === key
            ? {
                ...row,
                ...patch,
                referenceNeedsReview:
                  patch.scoreReference !== undefined
                    ? false
                    : row.referenceNeedsReview,
              }
            : row,
        ),
      ),
    [edit],
  );

  const moveRow = useCallback(
    (pieceId: string, key: string, delta: -1 | 1): void =>
      edit(pieceId, (rows) => {
        const index = rows.findIndex((row) => row.key === key);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= rows.length) return [...rows];
        const next = [...rows];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      }),
    [edit],
  );

  const removeRow = useCallback(
    (pieceId: string, key: string): void =>
      edit(pieceId, (rows) => rows.filter((row) => row.key !== key)),
    [edit],
  );

  const discard = useCallback((): void => {
    setDraft(null);
    setSaveRefused(false);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!draft || !isDirty) {
      setDraft(null);
      return true;
    }
    if (hasBlankSoloLabel(draft.rows)) {
      setSaveRefused(true);
      toast.error(
        t("projects.micro_cast.solos.blank_label", "Każda solówka potrzebuje nazwy."),
      );
      return false;
    }
    try {
      await saveMutation.mutateAsync({
        project: projectId,
        piece: draft.pieceId,
        solo_assignments: toSoloPayload(draft.rows),
      });
      setDraft(null);
      setSaveRefused(false);
      toast.success(t("projects.micro_cast.solos.saved", "Solówki zapisane"));
      return true;
    } catch {
      // The mutation already toasted the reason; the draft stays for a retry.
      return false;
    }
  }, [draft, isDirty, projectId, saveMutation, t]);

  const convertLegacy = useCallback(
    async (pieceId: string, castingId: string, label: string): Promise<boolean> => {
      const saved = savedRowsFor(pieceId);
      const position =
        solos.solo_assignments
          .filter((solo) => String(solo.piece) === pieceId)
          .reduce((highest, solo) => Math.max(highest, solo.position + 1), 0);
      try {
        await convertMutation.mutateAsync({
          piece: pieceId,
          data: {
            casting: castingId,
            label: label.trim(),
            score_reference: "",
            position: Math.max(position, saved.length),
          },
        });
        return true;
      } catch {
        return false;
      }
    },
    [convertMutation, savedRowsFor, solos.solo_assignments],
  );

  return {
    rowsFor,
    legacyFor,
    performersByPiece,
    isDirty,
    isSaving: saveMutation.isPending || convertMutation.isPending,
    hasBlankLabel,
    showLabelErrors: saveRefused && hasBlankLabel,
    addRow,
    updateRow,
    moveRow,
    removeRow,
    save,
    discard,
    convertLegacy,
  };
};
