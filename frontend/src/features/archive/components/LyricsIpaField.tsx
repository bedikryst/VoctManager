/**
 * @file LyricsIpaField.tsx
 * @description The Piece Card's IPA guide: the editable transcription, the Latin
 * system it is written in beside its label, and — for a piece sung in Latin —
 * "Przelicz wymowę" with a choice of system, German preselected.
 *
 * The recompute reads the SAVED sung text, so it waits while the text, the guide
 * or the language hold an unsaved edit: it would otherwise transcribe words the
 * manager has already changed, or replace a correction still sitting in the
 * textarea. It runs in Celery; `usePiece` polls while the job runs, and when the
 * job clears this field takes the new guide in place — even when other fields
 * hold unsaved edits and the page therefore leaves the rest of the form alone.
 *
 * A guide a human has edited or verified is replaced only after a confirmation;
 * the server enforces the same rule, so a stale card cannot skip it.
 * @module features/archive/components/LyricsIpaField
 */

import React, { useEffect, useId, useRef, useState } from "react";
import { useFormState, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { parseApiError } from "@/shared/api/errors";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Label } from "@/shared/ui/primitives/typography";
import type {
  IpaRecomputeJob,
  LatinPronunciationCode,
  Piece,
} from "@/shared/types";

import { useRecomputeIpa } from "../api/archive.queries";
import {
  DEFAULT_LATIN_PRONUNCIATION,
  LATIN_SAMPLE_WORDS,
  getLatinPronunciationLabel,
  getLatinPronunciationOptions,
  isLatinPronunciationCode,
} from "../constants/latinPronunciation";
import { LabeledField } from "./CockpitSection";
import { pieceFieldProvenance } from "./ProvenanceChip";
import type { PieceCardFormValues } from "./PieceMetadataForm";

/** The saved values a recompute reads or overwrites. */
const RECOMPUTE_INPUT_FIELDS = ["lyrics_original", "lyrics_ipa", "language"] as const;

const jobFailureMessage = (
  reason: IpaRecomputeJob["reason"],
  t: TFunction,
): string => {
  if (reason === "overloaded") {
    return t(
      "archive.piece_card.ipa.failed_overloaded",
      "Usługa AI była przeciążona. Spróbuj ponownie za kilka minut.",
    );
  }
  if (reason === "budget") {
    return t(
      "archive.piece_card.ipa.failed_budget",
      "Dzienny budżet AI się wyczerpał. Spróbuj jutro.",
    );
  }
  return t(
    "archive.piece_card.ipa.failed",
    "Nie udało się przeliczyć wymowy. Dotychczasowa transkrypcja została bez zmian.",
  );
};

const dispatchErrorMessage = (code: string | null, t: TFunction): string => {
  if (code === "running") {
    return t("archive.piece_card.ipa.already_running", "Wymowa jest już przeliczana.");
  }
  if (code === "budget") return jobFailureMessage("budget", t);
  return t(
    "archive.piece_card.ipa.dispatch_failed",
    "Nie udało się uruchomić przeliczania wymowy.",
  );
};

interface LyricsIpaFieldProps {
  readonly piece: Piece;
  readonly form: UseFormReturn<PieceCardFormValues>;
  /** The field's provenance dot, as every other field on the card wears it. */
  readonly chip: React.ReactNode;
}

type ScheduleIpa = (dispatch: () => Promise<Piece>) => Promise<Piece>;

export const useIpaRecompute = (
  piece: Piece,
  onDone?: () => void,
  schedule?: ScheduleIpa,
) => {
  const { t } = useTranslation();
  const recompute = useRecomputeIpa();
  const [pickedSystem, setSystem] = useState<LatinPronunciationCode>();
  const savedSystem = schedule ? piece.lyrics_ipa_system : undefined;
  const system = pickedSystem || savedSystem || DEFAULT_LATIN_PRONUNCIATION;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const job = piece.lyrics_ipa_job ?? null;
  const isRunning = job?.state === "running" || dispatching;
  const isHandEdited = pieceFieldProvenance(piece, "lyrics_ipa")?.source === "MAN";
  const options = getLatinPronunciationOptions(t);
  const selected = options.find((option) => option.value === system);

  // A settled job is read off the transition, not the state: a failure lingers
  // on the server for minutes and must not re-toast on every refetch.
  const previousJobState = useRef<IpaRecomputeJob["state"] | null>(job?.state ?? null);
  useEffect(() => {
    const before = previousJobState.current;
    const now = job?.state ?? null;
    previousJobState.current = now;
    if (before !== "running" || now === "running") return;
    if (job === null) {
      onDone?.();
      toast.success(t("archive.piece_card.ipa.done", "Wymowa przeliczona."));
    } else {
      toast.error(jobFailureMessage(job.reason, t));
    }
  }, [job, onDone, t]);

  const dispatch = (replaceManual: boolean): void => {
    setDispatching(true);
    const write = () => recompute.mutateAsync({ pieceId: String(piece.id), system, replaceManual });
    void (schedule ? schedule(write) : write()).then(
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

export const IpaRecomputeActions = ({ piece, ipa, inputDirty, compact }: {
  piece: Piece;
  ipa: ReturnType<typeof useIpaRecompute>;
  inputDirty?: boolean;
  compact?: boolean;
}) => {
  const { t } = useTranslation();
  const selectId = useId();
  const pronunciationLabel = t("archive.piece_card.ipa.system_pick", "Wymowa łaciny");
  const {
    job, system, options, selected, setSystem, isRunning, isConfirmOpen,
    setIsConfirmOpen, isHandEdited, dispatch, dispatching,
  } = ipa;
  return (
    <>
      {piece.lyrics_ipa_recomputable ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {compact && <Label as="label" htmlFor={selectId} size="base" color="graphite">{pronunciationLabel}</Label>}
            <div className={compact ? "min-w-28" : "w-56"}>
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
                variant={compact ? "property" : undefined}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              casing={compact ? "sentence" : undefined}
              leftIcon={<RefreshCw size={14} aria-hidden="true" />}
              isLoading={isRunning}
              disabled={isRunning || inputDirty}
              onClick={() => (isHandEdited ? setIsConfirmOpen(true) : dispatch(false))}
            >
              {isRunning
                ? t("archive.piece_card.ipa.recomputing", "Przeliczam…")
                : compact
                  ? t("archive.piece_card.recompute_pronunciation_short")
                  : t("archive.piece_card.ipa.recompute", "Przelicz wymowę")}
            </Button>
          </div>
          {selected ? (
            <Caption color="muted" className="ml-1 block">
              {`${LATIN_SAMPLE_WORDS} [${selected.sample}]`}
            </Caption>
          ) : null}
          {inputDirty && !isRunning ? (
            <Caption color="muted" className="ml-1 block">
              {t(
                "archive.piece_card.ipa.save_first",
                "Najpierw zapisz zmiany: wymowa powstaje z zapisanego tekstu.",
              )}
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
        title={t(
          "archive.piece_card.ipa.confirm_title",
          "Zastąpić poprawioną wymowę?",
        )}
        description={t(
          "archive.piece_card.ipa.confirm_body",
          "Tę transkrypcję ktoś poprawiał albo zatwierdzał ręcznie. Przeliczenie zastąpi ją w całości. Wymowa łaciny: {{system}}.",
          { system: selected?.label ?? "" },
        )}
        confirmText={t("archive.piece_card.ipa.confirm_replace", "Zastąp")}
        onConfirm={() => dispatch(true)}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={dispatching}
      />
    </>
  );
};

export const LyricsIpaField = ({ piece, form, chip }: LyricsIpaFieldProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { dirtyFields, errors } = useFormState({ control: form.control });
  const inputDirty = RECOMPUTE_INPUT_FIELDS.some((field) => Boolean(dirtyFields[field]));
  const ipa = useIpaRecompute(piece, () => {
    form.resetField("lyrics_ipa", { defaultValue: piece.lyrics_ipa ?? "" });
  });
  const fieldLabel = t("archive.piece_card.fields.lyrics_ipa", "Transkrypcja IPA");
  const systemLabel = getLatinPronunciationLabel(piece.lyrics_ipa_system, t);

  return (
    <LabeledField
      label={systemLabel ? `${fieldLabel} · ${systemLabel}` : fieldLabel}
      chip={chip}
    >
      <Textarea
        aria-label={fieldLabel}
        rows={3}
        readOnly={ipa.isRunning}
        error={errors.lyrics_ipa?.message}
        {...form.register("lyrics_ipa")}
      />
      <IpaRecomputeActions piece={piece} ipa={ipa} inputDirty={inputDirty} />
    </LabeledField>
  );
};
