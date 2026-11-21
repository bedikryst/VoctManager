/**
 * @file AudienceGenerators.tsx
 * @description The two requests the card makes of the AI for the printed
 * book: one more translation of the sung text, and a programme note in a
 * chosen language and tone.
 *
 * Each dispatch goes through the card's autosave queue (`schedule`), so the job
 * reads the fields it depends on only after they are written. Both jobs run in
 * Celery and report through the piece (`translation_job`, `program_note_job`);
 * `usePiece` polls while one runs. The outcome is read off the transition out
 * of "running", because a failure lingers on the server for minutes and must
 * not toast again on every refetch.
 * @module features/archive/piece-card/AudienceGenerators
 */

import React, { useEffect, useId, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { parseApiError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Label } from "@/shared/ui/primitives/typography";
import {
  AUDIENCE_LANGUAGES,
  type AudienceLanguage,
  type AudienceMaterialJob,
  type Piece,
  type ProgramNote,
  type ProgramNoteToneCode,
} from "@/shared/types";

import { useGenerateProgramNote, useGenerateTranslation } from "../api/archive.queries";
import {
  DEFAULT_AUDIENCE_LANGUAGE,
  DEFAULT_PROGRAM_NOTE_TONE,
  PROGRAM_NOTE_TONES,
  getAudienceLanguageLabel,
  getProgramNoteToneLabel,
  isAudienceLanguage,
  isProgramNoteTone,
  translationAddsMeaning,
} from "../constants/audienceMaterial";

type ScheduleGeneration = (dispatch: () => Promise<Piece>, noteId?: string) => Promise<Piece | undefined>;

/** The canonical (project-less) programme note in one language; a piece holds at most one. */
const canonicalNoteIn = (piece: Piece, language: string): ProgramNote | undefined =>
  (piece.program_notes ?? []).find((note) => !note.project && note.language === language);

/** Why a job failed once it ran; `failed` is the job's own line. */
const jobFailureMessage = (reason: AudienceMaterialJob["reason"], failed: string, t: TFunction): string => {
  if (reason === "overloaded") return t("archive.review.ai_overloaded");
  if (reason === "budget") return t("archive.review.ai_budget");
  return failed;
};

const useAudienceJobOutcome = (
  job: AudienceMaterialJob | null,
  messages: { readonly done: string; readonly failed: string },
): void => {
  const { t } = useTranslation();
  const { done, failed } = messages;
  const previousState = useRef<AudienceMaterialJob["state"] | null>(job?.state ?? null);
  useEffect(() => {
    const before = previousState.current;
    const now = job?.state ?? null;
    previousState.current = now;
    if (before !== "running" || now === "running") return;
    if (job === null) toast.success(done);
    else toast.error(jobFailureMessage(job.reason, failed, t));
  }, [job, done, failed, t]);
};

/** The language a running job writes in, when it is one the card offers. */
const runningLanguage = (job: AudienceMaterialJob | null): AudienceLanguage | null =>
  job?.state === "running" && isAudienceLanguage(job.language) ? job.language : null;

const translationDispatchMessage = (code: string | null, t: TFunction): string => {
  switch (code) {
    case "exists":
      return t("archive.review.translate_error.exists");
    case "same_language":
      return t("archive.review.translate_error.same_language");
    case "no_text":
      return t("archive.review.translate_error.no_text");
    case "running":
      return t("archive.review.translate_error.running");
    case "budget":
      return t("archive.review.ai_budget");
    case "unavailable":
      return t("archive.review.translate_error.unavailable");
    default:
      return t("archive.review.translate_error.generic");
  }
};

const AudienceSelect = ({ label, ...props }: React.ComponentProps<typeof Select>) => {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Label as="label" htmlFor={id} size="base" color="graphite">{label}</Label>
      <Select {...props} id={id} ariaLabel={label} variant="property" className="w-fit" />
    </div>
  );
};

/**
 * One more audience language, translated from the stored sung text. Offers
 * only languages the piece lacks and the text is not already in; an existing
 * translation is edited in its block, never regenerated here.
 */
export const TranslationGenerator = ({ piece, schedule }: {
  readonly piece: Piece;
  readonly schedule: ScheduleGeneration;
}): React.JSX.Element | null => {
  const { t } = useTranslation();
  const generate = useGenerateTranslation();
  const pieceId = String(piece.id);

  const job = piece.translation_job ?? null;
  useAudienceJobOutcome(job, {
    done: t("archive.review.translation_ready"),
    failed: t("archive.review.translation_failed"),
  });

  const missing = AUDIENCE_LANGUAGES.filter(
    (lang) =>
      !(piece.translations ?? []).some((tr) => !tr.movement && tr.target_language === lang)
      && translationAddsMeaning(piece.language, lang),
  );
  const [picked, setPicked] = useState<AudienceLanguage | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const language = runningLanguage(job) ?? (picked && missing.includes(picked) ? picked : missing[0]);

  if (!piece.lyrics_original?.trim() || language === undefined) return null;

  const busy = dispatching || job?.state === "running";
  const run = (): void => {
    setDispatching(true);
    void schedule(() => generate.mutateAsync({ pieceId, language }))
      .catch((error: unknown) => toast.error(translationDispatchMessage(parseApiError(error).code, t)))
      .finally(() => setDispatching(false));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AudienceSelect
        size="sm"
        label={t("archive.review.translate_language")}
        value={language}
        onValueChange={(value) => {
          if (isAudienceLanguage(value)) setPicked(value);
        }}
        options={missing.map((lang) => ({ value: lang, label: getAudienceLanguageLabel(lang, t) }))}
        disabled={busy}
      />
      <Button
        variant="outline"
        casing="sentence"
        size="sm"
        leftIcon={<Sparkles size={14} aria-hidden="true" />}
        isLoading={busy}
        disabled={busy}
        onClick={run}
      >
        {busy ? t("archive.review.translating") : t("archive.review.translate")}
      </Button>
    </div>
  );
};

/**
 * Writes or rewrites the canonical note in one language. A rewrite keeps the
 * tone the note was written in unless it is changed. `renderManual` puts the
 * hand-written alternative under the controls, with the same language and tone.
 */
export const ProgramNoteGenerator = ({ piece, schedule, renderManual, manualOpen }: {
  readonly piece: Piece;
  readonly schedule: ScheduleGeneration;
  readonly renderManual: (language: AudienceLanguage, tone: ProgramNoteToneCode, busy: boolean) => React.ReactNode;
  readonly manualOpen: boolean;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const generate = useGenerateProgramNote();
  const pieceId = String(piece.id);

  const toneOf = (note: ProgramNote | undefined): ProgramNoteToneCode =>
    note && isProgramNoteTone(note.target_tone) ? note.target_tone : DEFAULT_PROGRAM_NOTE_TONE;
  const [pickedLanguage, setLanguage] = useState<AudienceLanguage>(DEFAULT_AUDIENCE_LANGUAGE);
  const [tone, setTone] = useState<ProgramNoteToneCode>(() =>
    toneOf(canonicalNoteIn(piece, DEFAULT_AUDIENCE_LANGUAGE)),
  );
  const [dispatching, setDispatching] = useState(false);

  // Approval also writes the Polish note without this section asking, so
  // progress and outcome come from the piece, not from the click.
  const job = piece.program_note_job ?? null;
  useAudienceJobOutcome(job, {
    done: t("archive.review.note_ready"),
    failed: t("archive.review.note_generation_failed"),
  });
  const language = runningLanguage(job) ?? pickedLanguage;
  const note = canonicalNoteIn(piece, language);

  const run = (): void => {
    setDispatching(true);
    void schedule(() => generate.mutateAsync({ pieceId, force: Boolean(note), language, tone }), note?.id)
      .catch(() => toast.error(t("archive.review.note_failed")))
      .finally(() => setDispatching(false));
  };

  const busy = dispatching || job?.state === "running";
  const controlsDisabled = busy || manualOpen;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <AudienceSelect
          size="sm"
          label={t("archive.review.note_language")}
          value={language}
          onValueChange={(value) => {
            if (!isAudienceLanguage(value)) return;
            setLanguage(value);
            setTone(toneOf(canonicalNoteIn(piece, value)));
          }}
          options={AUDIENCE_LANGUAGES.map((lang) => ({ value: lang, label: getAudienceLanguageLabel(lang, t) }))}
          disabled={controlsDisabled}
        />
        <AudienceSelect
          size="sm"
          label={t("archive.review.note_tone")}
          value={tone}
          onValueChange={(value) => {
            if (isProgramNoteTone(value)) setTone(value);
          }}
          options={PROGRAM_NOTE_TONES.map((code) => ({ value: code, label: getProgramNoteToneLabel(code, t) }))}
          disabled={controlsDisabled}
        />
        <Button
          variant="outline"
          casing="sentence"
          size="sm"
          leftIcon={<Sparkles size={14} aria-hidden="true" />}
          isLoading={busy}
          disabled={controlsDisabled}
          onClick={run}
        >
          {busy
            ? t("archive.review.note_generating")
            : note
              ? t("archive.review.regenerate_note")
              : t("archive.review.generate_note")}
        </Button>
      </div>
      {renderManual(language, tone, busy)}
    </>
  );
};
