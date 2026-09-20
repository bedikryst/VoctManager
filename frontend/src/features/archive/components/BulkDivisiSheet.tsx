/**
 * @file BulkDivisiSheet.tsx
 * @description One divisi for many pieces. Opens from the archive's selection
 * mode with the selected pieces, offers the same [DivisiEditor] the Piece
 * Card uses, and writes the layout to every piece as one act
 * (`PUT /api/pieces/voice-requirements/`).
 *
 * Writes the PIECE-WIDE layer only. An edition that declares its own divisi
 * is a statement about that arrangement and keeps overriding — the sheet says
 * so, because "apply to 40 pieces" must not quietly undo the one unison
 * edition somebody set on purpose.
 *
 * The draft opens pre-filled with the layout most of the selected pieces
 * already share (when any do): the common case is "these thirty are SATB
 * like the rest", and an empty editor would make the user rebuild the
 * layout they can see on the rows behind the sheet.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/BulkDivisiSheet
 */

import React, { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { VoiceLineOption, VoiceRequirement } from "@/shared/types";
import { toastApiError } from "@/shared/api/errors";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";

import { useBulkSetVoiceLayout } from "../api/archive.queries";
import { useDivisiDraft } from "../hooks/useDivisiDraft";
import type { EnrichedPiece, VoiceRequirementDTO } from "../types/archive.dto";
import { DivisiEditor } from "./DivisiEditor";

interface BulkDivisiSheetProps {
  readonly isOpen: boolean;
  readonly pieces: readonly EnrichedPiece[];
  readonly voiceLines: VoiceLineOption[];
  readonly onClose: () => void;
  /** Fires after a successful write — the caller leaves selection mode. */
  readonly onApplied: () => void;
}

interface SharedLayout {
  readonly requirements: VoiceRequirementDTO[];
  /** How many of the selected pieces already carry exactly this layout. */
  readonly count: number;
}

const pieceWideLayer = (piece: EnrichedPiece): VoiceRequirement[] =>
  (piece.voice_requirements_read ?? []).filter((r) => (r.edition ?? null) === null);

/**
 * The piece-wide layout most of the selection shares, keyed by its lines and
 * quantities. Pieces with no piece-wide layer do not vote: "no divisi yet" is
 * exactly what the user is here to fix, and it would otherwise win every
 * fresh archive.
 */
const mostCommonLayout = (
  pieces: readonly EnrichedPiece[],
): SharedLayout | null => {
  const tally = new Map<string, SharedLayout>();
  for (const piece of pieces) {
    const layer = pieceWideLayer(piece);
    if (layer.length === 0) continue;
    const sorted = [...layer].sort((a, b) =>
      a.voice_line.localeCompare(b.voice_line),
    );
    const key = sorted.map((r) => `${r.voice_line}:${r.quantity}`).join("|");
    const existing = tally.get(key);
    if (existing) {
      tally.set(key, { ...existing, count: existing.count + 1 });
    } else {
      tally.set(key, {
        count: 1,
        requirements: sorted.map((r) => ({
          voice_line: r.voice_line,
          quantity: r.quantity,
          edition: null,
        })),
      });
    }
  }
  let best: SharedLayout | null = null;
  for (const candidate of tally.values()) {
    if (!best || candidate.count > best.count) best = candidate;
  }
  return best;
};

export const BulkDivisiSheet = ({
  isOpen,
  pieces,
  voiceLines,
  onClose,
  onApplied,
}: BulkDivisiSheetProps): React.JSX.Element => {
  const { t } = useTranslation();
  const bulkSet = useBulkSetVoiceLayout();

  const shared = useMemo(() => mostCommonLayout(pieces), [pieces]);
  const editionOverrides = useMemo(
    () =>
      pieces.filter((piece) =>
        (piece.voice_requirements_read ?? []).some(
          (r) => (r.edition ?? null) !== null,
        ),
      ).length,
    [pieces],
  );

  const draft = useDivisiDraft();
  const { setRequirements } = draft;

  // Each opening starts from the selection at hand, not from the last
  // sheet's leftovers — and ONLY the opening. `pieces` is a slice of the live
  // list, which the ingestion poll rewrites every few seconds while a PDF is
  // in the pipeline; re-seeding on every change would wipe the user's edits
  // mid-sheet.
  const wasOpen = useRef<boolean>(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) setRequirements(shared?.requirements ?? []);
    wasOpen.current = isOpen;
  }, [isOpen, shared, setRequirements]);

  const count = pieces.length;
  const isEmpty = draft.requirements.length === 0;

  const apply = async () => {
    if (isEmpty || bulkSet.isPending) return;
    try {
      const result = await bulkSet.mutateAsync({
        piece_ids: pieces.map((piece) => String(piece.id)),
        voice_requirements: draft.requirements.map(({ voice_line, quantity }) => ({
          voice_line,
          quantity,
        })),
      });
      toast.success(
        t("archive.bulk_divisi.toast_success", {
          defaultValue: "Rozkład głosów zapisany w {{count}} utworach",
          count: result.updated,
        }),
      );
      onApplied();
    } catch (error) {
      toastApiError(error, t, {
        title: t("archive.bulk_divisi.toast_error", "Nie udało się zapisać rozkładu"),
      });
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("archive.bulk_divisi.title", "Rozkład głosów")}
      subtitle={t("archive.bulk_divisi.subtitle", {
        defaultValue: "Dla {{count}} zaznaczonych utworów",
        count,
      })}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={bulkSet.isPending}>
            {t("common.cancel", "Anuluj")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void apply()}
            disabled={isEmpty || bulkSet.isPending}
            isLoading={bulkSet.isPending}
          >
            {t("archive.bulk_divisi.apply", {
              defaultValue: "Zapisz w {{count}} utworach",
              count,
            })}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Text size="sm" color="graphite">
          {t(
            "archive.bulk_divisi.explainer",
            "Ten rozkład zastąpi wspólny rozkład głosów każdego zaznaczonego utworu.",
          )}
        </Text>

        {shared ? (
          <Caption color="muted">
            {t("archive.bulk_divisi.prefilled", {
              defaultValue:
                "Wypełniono rozkładem, który ma już {{count}} z zaznaczonych utworów.",
              count: shared.count,
            })}
          </Caption>
        ) : (
          <Caption color="muted">
            {t(
              "archive.bulk_divisi.hint",
              "Kliknij głos, by dodać. Liczba mówi ilu śpiewaków potrzeba na tę partię.",
            )}
          </Caption>
        )}

        <DivisiEditor
          voiceLines={voiceLines}
          requirements={draft.requirements}
          editionId={null}
          showHeading={false}
          addRequirement={draft.addRequirement}
          adjustRequirement={draft.adjustRequirement}
          removeRequirement={draft.removeRequirement}
          isBusy={bulkSet.isPending}
        />

        {editionOverrides > 0 && (
          <Caption color="muted">
            {t("archive.bulk_divisi.editions_untouched", {
              defaultValue:
                "{{count}} z zaznaczonych utworów ma rozkład zapisany na wydaniu — te wydania zostają bez zmian.",
              count: editionOverrides,
            })}
          </Caption>
        )}

        {isEmpty && (
          <Caption color="muted">
            {t("archive.bulk_divisi.empty", "Dodaj co najmniej jeden głos, żeby zapisać.")}
          </Caption>
        )}
      </div>
    </BottomSheet>
  );
};
