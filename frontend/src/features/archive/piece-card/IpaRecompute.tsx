/**
 * @file IpaRecompute.tsx
 * @description "Wymowa łaciny ⌄ · Przelicz" beside the piece's IPA guide, for
 * a piece the server says can be transcribed again.
 *
 * The recompute reads the SAVED sung text, so its dispatch goes through the
 * card's autosave queue (`schedule`) and starts only after the text, the guide
 * and the language have been written. It runs in Celery; `usePiece` polls while
 * the job runs, and the outcome is read off the job's transition out of
 * "running", because a failure lingers on the server for minutes and must not
 * toast again on every refetch.
 *
 * A guide a person has edited or confirmed is replaced only after a
 * confirmation; the server enforces the same rule, so a stale card cannot skip it.
 * @module features/archive/piece-card/IpaRecompute
 */

import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { parseApiError } from "@/shared/api/errors";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Label } from "@/shared/ui/primitives/typography";
import type { IpaRecomputeJob, LatinPronunciationCode, Piece } from "@/shared/types";

import { useRecomputeIpa } from "../api/archive.queries";
import { pieceFieldProvenance } from "../components/ProvenanceChip";
import {
  DEFAULT_LATIN_PRONUNCIATION,
  LATIN_SAMPLE_WORDS,
  getLatinPronunciationOptions,
  isLatinPronunciationCode,
} from "../constants/latinPronunciation";

const jobFailureMessage = (reason: IpaRecomputeJob["reason"], t: TFunction): string => {
  if (reason === "overloaded") return t("archive.piece_card.ipa.failed_overloaded");
  if (reason === "budget") return t("archive.piece_card.ipa.failed_budget");
  return t("archive.piece_card.ipa.failed");
};

const dispatchErrorMessage = (code: string | null, t: TFunction): string => {
  if (code === "running") return t("archive.piece_card.ipa.already_running");
  if (code === "budget") return jobFailureMessage("budget", t);
  return t("archive.piece_card.ipa.dispatch_failed");
};

type ScheduleIpa = (dispatch: () => Promise<Piece>) => Promise<Piece | undefined>;

export const useIpaRecompute = (piece: Piece, schedule: ScheduleIpa) => {
  const { t } = useTranslation();
  const recompute = useRecomputeIpa();
  const [pickedSystem, setSystem] = useState<LatinPronunciationCode>();
  const system = pickedSystem || piece.lyrics_ipa_system || DEFAULT_LATIN_PRONUNCIATION;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const job = piece.lyrics_ipa_job ?? null;
  const isRunning = job?.state === "running" || dispatching;
  const isHandEdited = pieceFieldProvenance(piece, "lyrics_ipa")?.source === "MAN";
  const options = getLatinPronunciationOptions(t);
  const selected = options.find((option) => option.value === system);

  const previousJobState = useRef<IpaRecomputeJob["state"] | null>(job?.state ?? null);
  useEffect(() => {
    const before = previousJobState.current;
    const now = job?.state ?? null;
    previousJobState.current = now;
    if (before !== "running" || now === "running") return;
    if (job === null) toast.success(t("archive.piece_card.ipa.done"));
    else toast.error(jobFailureMessage(job.reason, t));
  }, [job, t]);

  const dispatch = (replaceManual: boolean): void => {
    setDispatching(true);
    void schedule(() => recompute.mutateAsync({ pieceId: String(piece.id), system, replaceManual })).then(
      () => setIsConfirmOpen(false),
      (error: unknown) => {
        const { code } = parseApiError(error);
        // The server may have received a manual correction while the job was queued.
        setIsConfirmOpen(code === "hand_edited");
        if (code !== "hand_edited") toast.error(dispatchErrorMessage(code, t));
      },
    ).finally(() => setDispatching(false));
  };

  return {
    job, system, options, selected, setSystem, isRunning, isConfirmOpen,
    setIsConfirmOpen, isHandEdited, dispatch, dispatching,
  };
};

export const IpaRecomputeActions = ({ piece, ipa }: {
  readonly piece: Piece;
  readonly ipa: ReturnType<typeof useIpaRecompute>;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const selectId = useId();
  const pronunciationLabel = t("archive.piece_card.ipa.system_pick");
  const {
    job, system, options, selected, setSystem, isRunning, isConfirmOpen,
    setIsConfirmOpen, isHandEdited, dispatch, dispatching,
  } = ipa;
  return (
    <>
      {piece.lyrics_ipa_recomputable ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Label as="label" htmlFor={selectId} size="base" color="graphite">{pronunciationLabel}</Label>
            <div className="min-w-28">
              <Select
                id={selectId}
                size="sm"
                ariaLabel={pronunciationLabel}
                value={system}
                onValueChange={(value) => {
                  if (isLatinPronunciationCode(value)) setSystem(value);
                }}
                options={options.map(({ value, label }) => ({ value, label }))}
                disabled={isRunning}
                variant="property"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              casing="sentence"
              leftIcon={<RefreshCw size={14} aria-hidden="true" />}
              isLoading={isRunning}
              disabled={isRunning}
              onClick={() => (isHandEdited ? setIsConfirmOpen(true) : dispatch(false))}
            >
              {isRunning
                ? t("archive.piece_card.ipa.recomputing")
                : t("archive.piece_card.recompute_pronunciation_short")}
            </Button>
          </div>
          {selected ? (
            <Caption color="muted" className="ml-1 block">
              {`${LATIN_SAMPLE_WORDS} [${selected.sample}]`}
            </Caption>
          ) : null}
          {job?.state === "failed" ? (
            <Caption color="crimson" className="ml-1 block">
              {jobFailureMessage(job.reason, t)}
            </Caption>
          ) : null}
        </div>
      ) : null}
      <ConfirmModal
        isOpen={isConfirmOpen}
        title={t("archive.piece_card.ipa.confirm_title")}
        description={t("archive.piece_card.ipa.confirm_body", { system: selected?.label ?? "" })}
        confirmText={t("archive.piece_card.ipa.confirm_replace")}
        onConfirm={() => dispatch(true)}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={dispatching}
      />
    </>
  );
};
