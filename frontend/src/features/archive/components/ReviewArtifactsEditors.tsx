/**
 * @file ReviewArtifactsEditors.tsx
 * @description Inline editors for the AI's most error-prone outputs —
 * movements, translations, reference recordings and the programme note — used
 * in the AI Review cockpit, where the conductor corrects or deletes each in
 * place. Editing a movement/translation stamps MANUAL provenance server-side,
 * so its chip flips from "AI" to "Zweryfikowane".
 *
 * Two of them also ask the AI for more: a translation into another audience
 * language, and a programme note in a chosen language and tone. Both run in
 * Celery; the piece reports each job until it lands or fails, and the cockpit
 * says which.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ReviewArtifactsEditors
 */

import React, { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BookOpen, ExternalLink, Languages, Sparkles, Star, Trash2 } from "lucide-react";

import { parseApiError } from "@/shared/api/errors";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import {
  AUDIENCE_LANGUAGES,
  type AudienceLanguage,
  type AudienceMaterialJob,
  type Movement,
  type Piece,
  type ProgramNote,
  type ProgramNoteToneCode,
  type Recording,
  type Translation,
} from "@/shared/types";

import {
  useDeleteMovement,
  useDeleteProgramNote,
  useDeleteRecording,
  useDeleteTranslation,
  useGenerateProgramNote,
  useGenerateTranslation,
  useUpdateMovement,
  useUpdateProgramNote,
  useUpdateRecording,
  useUpdateTranslation,
  useVerifyPieceField,
} from "../api/archive.queries";
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
import { InlineConfirmAction } from "./InlineConfirmAction";
import { ProvenanceChip, childFieldProvenance } from "./ProvenanceChip";
import { dirtyKey, useRegisterDirty } from "../hooks/usePieceDirty";

/** The canonical (project-less) programme note in one language — the one the
 *  cockpit generates and regenerates. A piece holds at most one per language. */
const canonicalNoteIn = (piece: Piece, language: string): ProgramNote | undefined =>
  (piece.program_notes ?? []).find((n) => !n.project && n.language === language);

/** The piece-level translation in one language, if any. */
const pieceTranslationIn = (piece: Piece, language: string): Translation | undefined =>
  (piece.translations ?? []).find((tr) => !tr.movement && tr.target_language === language);

// ---------------------------------------------------------------------------
// A note or translation the cockpit asked for runs in Celery and reports
// through the piece's `program_note_job` / `translation_job`; `usePiece` polls
// while one runs. The outcome is read off the transition out of "running", not
// off the state: a failure lingers on the server for minutes and must not
// re-toast on every refetch.
// ---------------------------------------------------------------------------

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

/** Why a note or translation failed once it ran; `failed` is the job's own line. */
const jobFailureMessage = (
  reason: AudienceMaterialJob["reason"],
  failed: string,
  t: TFunction,
): string => {
  if (reason === "overloaded") {
    return t(
      "archive.review.ai_overloaded",
      "Usługa AI była przeciążona. Spróbuj ponownie za kilka minut.",
    );
  }
  if (reason === "budget") {
    return t("archive.review.ai_budget", "Dzienny budżet AI się wyczerpał. Spróbuj jutro.");
  }
  return failed;
};

/** The language a running job writes in, when it is one the cockpit offers. */
const runningLanguage = (job: AudienceMaterialJob | null): AudienceLanguage | null =>
  job?.state === "running" && isAudienceLanguage(job.language) ? job.language : null;

// ---------------------------------------------------------------------------
// A two-click delete affordance — no separate modal, no accidental wipes. The
// shape comes from `InlineConfirmAction`, which the ingestion panel shares.
// ---------------------------------------------------------------------------

interface DeleteButtonProps {
  readonly onConfirm: () => void;
  readonly isPending: boolean;
  readonly label: string;
}

const DeleteButton = ({
  onConfirm,
  isPending,
  label,
}: DeleteButtonProps): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <InlineConfirmAction
      icon={Trash2}
      label={label}
      confirmLabel={t("archive.review.delete", "Usuń")}
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
};

// ===========================================================================
// Movements
// ===========================================================================

export const MovementsEditor = ({
  piece,
  onGoToPage,
}: {
  readonly piece: Piece;
  /** Steers the score preview to a page. Absent where no viewer is mounted to
   *  steer (a phone, a piece with no PDF) — the anchor then stays plain type. */
  readonly onGoToPage?: (page: number) => void;
}): React.JSX.Element | null => {
  const movements = piece.movements ?? [];
  if (movements.length === 0) return null;
  return (
    <ul role="list" className="space-y-2">
      {movements.map((movement) => (
        <MovementRow
          key={movement.id}
          piece={piece}
          movement={movement}
          onGoToPage={onGoToPage}
        />
      ))}
    </ul>
  );
};

const MovementRow = ({
  piece,
  movement,
  onGoToPage,
}: {
  readonly piece: Piece;
  readonly movement: Movement;
  readonly onGoToPage?: (page: number) => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const update = useUpdateMovement();
  const remove = useDeleteMovement();
  const verify = useVerifyPieceField();
  const pieceId = String(piece.id);

  const pageNumber = movement.starts_on_page ?? 0;
  const goToPageLabel = t(
    "archive.review.go_to_page",
    "Pokaż stronę {{page}} w partyturze",
    { page: pageNumber },
  );
  const [title, setTitle] = useState(movement.title);
  const [tempo, setTempo] = useState(movement.tempo_marking ?? "");
  const dirty =
    title.trim() !== movement.title ||
    tempo.trim() !== (movement.tempo_marking ?? "");
  useRegisterDirty(dirtyKey("movement", movement.id), dirty);

  const save = (): void => {
    update.mutate(
      {
        id: movement.id,
        pieceId,
        data: { title: title.trim(), tempo_marking: tempo.trim() },
      },
      {
        onSuccess: () =>
          toast.success(t("archive.review.movement_saved", "Zapisano część.")),
        onError: () =>
          toast.error(t("archive.review.save_failed", "Nie udało się zapisać.")),
      },
    );
  };

  return (
    <li className="rounded-nested border border-hairline bg-ethereal-alabaster/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Caption color="muted" className="font-mono">
          {movement.order_index + 1}.
        </Caption>
        <ProvenanceChip
          entry={childFieldProvenance(piece, movement.id, "title")}
          onVerify={() =>
            verify.mutate(
              { pieceId, field: "title", objectId: movement.id },
              {
                onError: () =>
                  toast.error(
                    t("archive.review.verify_failed", "Nie udało się oznaczyć pola."),
                  ),
              },
            )
          }
          isVerifying={verify.isPending}
        />
        {/* The page the AI says this movement opens on — the one datum on this
            row that the score can be checked against, so where a viewer is
            mounted the fact IS the control that turns to it. Without one it
            stays what it always was: a fact, in plain type. */}
        {movement.starts_on_page ? (
          onGoToPage ? (
            <button
              type="button"
              onClick={() => onGoToPage(pageNumber)}
              aria-label={goToPageLabel}
              title={goToPageLabel}
              className="inline-flex items-center gap-1 rounded-chip px-1.5 py-1 text-ethereal-graphite/70 transition-colors hover:bg-ethereal-gold/10 hover:text-ethereal-gold"
            >
              <BookOpen size={11} aria-hidden="true" />
              <Caption color="inherit">
                {t("archive.review.page_short", "str.")} {pageNumber}
              </Caption>
            </button>
          ) : (
            <Caption color="muted">
              {t("archive.review.page_short", "str.")} {pageNumber}
            </Caption>
          )
        ) : null}
        <div className="ml-auto">
          <DeleteButton
            onConfirm={() =>
              remove.mutate(
                { id: movement.id, pieceId },
                {
                  onSuccess: () =>
                    toast.success(
                      t("archive.review.movement_deleted", "Usunięto część."),
                    ),
                  onError: () =>
                    toast.error(
                      t("archive.review.delete_failed", "Nie udało się usunąć."),
                    ),
                },
              )
            }
            isPending={remove.isPending}
            label={t("archive.review.delete_movement", "Usuń część")}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label={t("archive.review.movement_title", "Tytuł części")}
        />
        <Input
          value={tempo}
          onChange={(e) => setTempo(e.target.value)}
          placeholder={t("archive.review.tempo", "Tempo")}
          aria-label={t("archive.review.tempo", "Tempo")}
          className="sm:w-32"
        />
      </div>
      {dirty && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="primary" onClick={save} isLoading={update.isPending}>
            {t("archive.review.save_row", "Zapisz")}
          </Button>
        </div>
      )}
    </li>
  );
};

// ===========================================================================
// Translations
// ===========================================================================

export const TranslationsEditor = ({
  piece,
}: {
  readonly piece: Piece;
}): React.JSX.Element => {
  const translations = piece.translations ?? [];
  return (
    <div className="space-y-3">
      {translations.length > 0 ? (
        <ul role="list" className="space-y-3">
          {translations.map((tr) => (
            <TranslationRow key={tr.id} piece={piece} translation={tr} />
          ))}
        </ul>
      ) : null}
      <TranslationGenerator piece={piece} />
    </div>
  );
};

const translationDispatchMessage = (code: string | null, t: TFunction): string => {
  switch (code) {
    case "exists":
      return t(
        "archive.review.translate_error.exists",
        "Ten utwór ma już tłumaczenie w tym języku.",
      );
    case "same_language":
      return t(
        "archive.review.translate_error.same_language",
        "Tekst jest już w tym języku.",
      );
    case "no_text":
      return t(
        "archive.review.translate_error.no_text",
        "Najpierw uzupełnij i zapisz tekst śpiewany.",
      );
    case "running":
      return t("archive.review.translate_error.running", "Tłumaczenie już trwa.");
    case "budget":
      return t("archive.review.ai_budget", "Dzienny budżet AI się wyczerpał. Spróbuj jutro.");
    case "unavailable":
      return t(
        "archive.review.translate_error.unavailable",
        "Usługa AI nie jest skonfigurowana.",
      );
    default:
      return t(
        "archive.review.translate_error.generic",
        "Nie udało się uruchomić tłumaczenia.",
      );
  }
};

// ---------------------------------------------------------------------------
// One more audience language for the printed book, translated from the stored
// sung text. Offers only languages the piece lacks and the text is not already
// in; an existing translation is edited above, never regenerated here.
// ---------------------------------------------------------------------------

const TranslationGenerator = ({
  piece,
}: {
  readonly piece: Piece;
}): React.JSX.Element | null => {
  const { t } = useTranslation();
  const generate = useGenerateTranslation();
  const pieceId = String(piece.id);

  const job = piece.translation_job ?? null;
  useAudienceJobOutcome(job, {
    done: t("archive.review.translation_ready", "Tłumaczenie gotowe."),
    failed: t(
      "archive.review.translation_failed",
      "Nie udało się przetłumaczyć tekstu. Spróbuj ponownie.",
    ),
  });

  const missing = AUDIENCE_LANGUAGES.filter(
    (lang) =>
      !pieceTranslationIn(piece, lang) && translationAddsMeaning(piece.language, lang),
  );
  const [picked, setPicked] = useState<AudienceLanguage | null>(null);
  const language =
    runningLanguage(job) ?? (picked && missing.includes(picked) ? picked : missing[0]);

  const hasText = Boolean(piece.lyrics_original?.trim());
  if (!hasText || language === undefined) return null;

  const busy = generate.isPending || job?.state === "running";
  const run = (): void => {
    generate.mutate(
      { pieceId, language },
      {
        onError: (error) =>
          toast.error(translationDispatchMessage(parseApiError(error).code, t)),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-40">
        <Select
          size="sm"
          label={t("archive.review.translate_language", "Nowe tłumaczenie")}
          value={language}
          onValueChange={(value) => {
            if (isAudienceLanguage(value)) setPicked(value);
          }}
          options={missing.map((lang) => ({
            value: lang,
            label: getAudienceLanguageLabel(lang, t),
          }))}
          disabled={busy}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Languages size={14} aria-hidden="true" />}
        isLoading={busy}
        disabled={busy}
        onClick={run}
      >
        {busy
          ? t("archive.review.translating", "Tłumaczę…")
          : t("archive.review.translate", "Przetłumacz (AI)")}
      </Button>
    </div>
  );
};

const TranslationRow = ({
  piece,
  translation,
}: {
  readonly piece: Piece;
  readonly translation: Translation;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const update = useUpdateTranslation();
  const remove = useDeleteTranslation();
  const verify = useVerifyPieceField();
  const pieceId = String(piece.id);

  const [text, setText] = useState(translation.text);
  const [translator, setTranslator] = useState(translation.translator);
  const dirty = text !== translation.text || translator !== translation.translator;
  useRegisterDirty(dirtyKey("translation", translation.id), dirty);

  return (
    <li className="rounded-nested border border-hairline bg-ethereal-alabaster/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="neutral" className="py-0.5">
          {translation.target_language}
        </Badge>
        <ProvenanceChip
          entry={childFieldProvenance(piece, translation.id, "text")}
          onVerify={() =>
            verify.mutate(
              { pieceId, field: "text", objectId: translation.id },
              {
                onError: () =>
                  toast.error(
                    t("archive.review.verify_failed", "Nie udało się oznaczyć pola."),
                  ),
              },
            )
          }
          isVerifying={verify.isPending}
        />
        {translation.is_singable ? (
          <Caption color="muted">{t("archive.review.singable", "śpiewne")}</Caption>
        ) : null}
        <div className="ml-auto">
          <DeleteButton
            onConfirm={() =>
              remove.mutate(
                { id: translation.id, pieceId },
                {
                  onSuccess: () =>
                    toast.success(
                      t("archive.review.translation_deleted", "Usunięto tłumaczenie."),
                    ),
                  onError: () =>
                    toast.error(
                      t("archive.review.delete_failed", "Nie udało się usunąć."),
                    ),
                },
              )
            }
            isPending={remove.isPending}
            label={t("archive.review.delete_translation", "Usuń tłumaczenie")}
          />
        </div>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        aria-label={t("archive.review.translation_text", "Treść tłumaczenia")}
      />
      <div className="mt-2">
        <Input
          value={translator}
          onChange={(e) => setTranslator(e.target.value)}
          placeholder={t("archive.review.translator_ph", "Tłumacz (drukowany pod tekstem)")}
          aria-label={t("archive.review.translator", "Tłumacz")}
        />
      </div>
      {dirty && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="primary"
            isLoading={update.isPending}
            onClick={() =>
              update.mutate(
                { id: translation.id, pieceId, data: { text, translator } },
                {
                  onSuccess: () =>
                    toast.success(
                      t("archive.review.translation_saved", "Zapisano tłumaczenie."),
                    ),
                  onError: () =>
                    toast.error(
                      t("archive.review.save_failed", "Nie udało się zapisać."),
                    ),
                },
              )
            }
          >
            {t("archive.review.save_row", "Zapisz")}
          </Button>
        </div>
      )}
    </li>
  );
};

// ===========================================================================
// Recordings
// ===========================================================================

export const RecordingsEditor = ({
  piece,
}: {
  readonly piece: Piece;
}): React.JSX.Element | null => {
  const recordings = piece.recordings ?? [];
  if (recordings.length === 0) return null;
  return (
    <ul role="list" className="space-y-2">
      {recordings.map((rec) => (
        <RecordingRow key={rec.id} piece={piece} recording={rec} />
      ))}
    </ul>
  );
};

const RecordingRow = ({
  piece,
  recording,
}: {
  readonly piece: Piece;
  readonly recording: Recording;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const update = useUpdateRecording();
  const remove = useDeleteRecording();
  const pieceId = String(piece.id);

  const toggleFeatured = (): void => {
    update.mutate(
      { id: recording.id, pieceId, data: { is_featured: !recording.is_featured } },
      {
        onError: () =>
          toast.error(t("archive.review.save_failed", "Nie udało się zapisać.")),
      },
    );
  };

  return (
    <li className="flex items-center gap-2 rounded-nested border border-hairline bg-ethereal-alabaster/60 p-3">
      <button
        type="button"
        onClick={toggleFeatured}
        disabled={update.isPending}
        aria-label={
          recording.is_featured
            ? t("archive.review.unfeature", "Odepnij polecane")
            : t("archive.review.feature", "Ustaw jako polecane")
        }
        title={
          recording.is_featured
            ? t("archive.review.unfeature", "Odepnij polecane")
            : t("archive.review.feature", "Ustaw jako polecane")
        }
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-control border transition-colors",
          recording.is_featured
            ? "border-ethereal-gold/50 bg-ethereal-gold/10 text-ethereal-gold"
            : "border-hairline-strong text-ethereal-graphite/50 hover:text-ethereal-gold",
        )}
      >
        <Star
          size={14}
          strokeWidth={1.8}
          fill={recording.is_featured ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </button>
      <div className="min-w-0 flex-1">
        <Text size="sm" weight="medium" truncate className="block">
          {recording.performer ||
            t("archive.review.unknown_performer", "Nieznany wykonawca")}
        </Text>
        <Caption color="muted" className="block">
          {recording.source_display || recording.source}
          {recording.year ? ` · ${recording.year}` : ""}
        </Caption>
      </div>
      <a
        href={recording.url}
        target="_blank"
        rel="noreferrer"
        aria-label={t("archive.review.open_recording", "Otwórz nagranie")}
        title={t("archive.review.open_recording", "Otwórz nagranie")}
        className="flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong text-ethereal-graphite/60 transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-gold"
      >
        <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" />
      </a>
      <DeleteButton
        onConfirm={() =>
          remove.mutate(
            { id: recording.id, pieceId },
            {
              onSuccess: () =>
                toast.success(
                  t("archive.review.recording_deleted", "Usunięto nagranie."),
                ),
              onError: () =>
                toast.error(
                  t("archive.review.delete_failed", "Nie udało się usunąć."),
                ),
            },
          )
        }
        isPending={remove.isPending}
        label={t("archive.review.delete_recording", "Usuń nagranie")}
      />
    </li>
  );
};

// ===========================================================================
// Program note (on-demand)
// ===========================================================================
// Approval writes a Polish note in the accessible tone; the conductor asks here
// for another language or tone, or regenerates one. Generation is async (~30s)
// and reported through the piece's `program_note_job`.

const wordCount = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

// ---------------------------------------------------------------------------
// A single editable note. The AI draft is good but occasionally leaves a
// factual slip or a repeated phrase; the conductor fixes the text in place here
// — a cheaper, more surgical alternative to a full regenerate. Its local buffer
// is keyed on the note id, so a regenerate (new id) always reseeds it.
// ---------------------------------------------------------------------------

const ProgramNoteEditor = ({
  piece,
  note,
}: {
  readonly piece: Piece;
  readonly note: ProgramNote;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const update = useUpdateProgramNote();
  const remove = useDeleteProgramNote();
  const pieceId = String(piece.id);

  const [content, setContent] = useState(note.content);
  const dirty = content.trim() !== note.content.trim();
  useRegisterDirty(dirtyKey("note", note.id), dirty);

  const save = (): void => {
    const next = content.trim();
    if (!next) {
      toast.error(t("archive.review.note_empty", "Notka nie może być pusta."));
      return;
    }
    update.mutate(
      { id: note.id, pieceId, data: { content: next } },
      {
        onSuccess: () =>
          toast.success(t("archive.review.note_saved", "Zapisano notkę.")),
        onError: () =>
          toast.error(t("archive.review.save_failed", "Nie udało się zapisać.")),
      },
    );
  };

  return (
    <li className="rounded-nested border border-hairline bg-ethereal-alabaster/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="neutral" className="py-0.5">
          {note.language}
        </Badge>
        {note.target_tone ? (
          <Caption color="muted">{getProgramNoteToneLabel(note.target_tone, t)}</Caption>
        ) : null}
        {note.is_approved ? (
          <Caption color="muted">
            {t("repertoire.program_notes.approved", "zatwierdzona")}
          </Caption>
        ) : null}
        <div className="ml-auto">
          <DeleteButton
            onConfirm={() =>
              remove.mutate(
                { id: note.id, pieceId },
                {
                  onSuccess: () =>
                    toast.success(
                      t("archive.review.note_deleted", "Usunięto notkę."),
                    ),
                  onError: () =>
                    toast.error(
                      t("archive.review.delete_failed", "Nie udało się usunąć."),
                    ),
                },
              )
            }
            isPending={remove.isPending}
            label={t("archive.review.delete_note", "Usuń notkę")}
          />
        </div>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        aria-label={t("archive.review.note_content", "Treść notki programowej")}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <Caption color="muted">
          {t("archive.review.note_words", "Słowa")}: {wordCount(content)}
        </Caption>
        {dirty ? (
          <Button
            size="sm"
            variant="primary"
            onClick={save}
            isLoading={update.isPending}
          >
            {t("archive.review.save_row", "Zapisz")}
          </Button>
        ) : null}
      </div>
    </li>
  );
};

export const ProgramNoteSection = ({
  piece,
}: {
  readonly piece: Piece;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const generate = useGenerateProgramNote();
  const pieceId = String(piece.id);

  const notes = piece.program_notes ?? [];

  // A regenerate keeps the tone the note was written in unless it is changed.
  const toneOf = (note: ProgramNote | undefined): ProgramNoteToneCode =>
    note && isProgramNoteTone(note.target_tone) ? note.target_tone : DEFAULT_PROGRAM_NOTE_TONE;
  const [pickedLanguage, setLanguage] = useState<AudienceLanguage>(DEFAULT_AUDIENCE_LANGUAGE);
  const [tone, setTone] = useState<ProgramNoteToneCode>(() =>
    toneOf(canonicalNoteIn(piece, DEFAULT_AUDIENCE_LANGUAGE)),
  );

  // The note job also runs without this section asking — approval writes the
  // Polish note — so progress and outcome come from the piece, not the click.
  const job = piece.program_note_job ?? null;
  useAudienceJobOutcome(job, {
    done: t("archive.review.note_ready", "Notka programowa gotowa."),
    failed: t(
      "archive.review.note_generation_failed",
      "Nie udało się napisać notki programowej. Spróbuj ponownie.",
    ),
  });
  const language = runningLanguage(job) ?? pickedLanguage;
  const note = canonicalNoteIn(piece, language);

  const run = (): void => {
    generate.mutate(
      { pieceId, force: Boolean(note), language, tone },
      {
        onError: () =>
          toast.error(
            t("archive.review.note_failed", "Nie udało się uruchomić generowania."),
          ),
      },
    );
  };

  const busy = generate.isPending || job?.state === "running";

  return (
    <div className="space-y-3">
      {notes.length > 0 ? (
        <ul role="list" className="space-y-3">
          {notes.map((n) => (
            <ProgramNoteEditor key={n.id} piece={piece} note={n} />
          ))}
        </ul>
      ) : (
        <Text size="sm" color="muted">
          {t(
            "archive.review.no_note_hint",
            "Brak notki programowej. Powstanie automatycznie po zatwierdzeniu utworu — albo wygeneruj ją teraz (AI, ~30 s).",
          )}
        </Text>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Select
            size="sm"
            label={t("archive.review.note_language", "Język notki")}
            value={language}
            onValueChange={(value) => {
              if (!isAudienceLanguage(value)) return;
              setLanguage(value);
              setTone(toneOf(canonicalNoteIn(piece, value)));
            }}
            options={AUDIENCE_LANGUAGES.map((lang) => ({
              value: lang,
              label: getAudienceLanguageLabel(lang, t),
            }))}
            disabled={busy}
          />
        </div>
        <div className="w-40">
          <Select
            size="sm"
            label={t("archive.review.note_tone", "Ton")}
            value={tone}
            onValueChange={(value) => {
              if (isProgramNoteTone(value)) setTone(value);
            }}
            options={PROGRAM_NOTE_TONES.map((code) => ({
              value: code,
              label: getProgramNoteToneLabel(code, t),
            }))}
            disabled={busy}
          />
        </div>
        <Button
          variant={note ? "outline" : "primary"}
          size="sm"
          leftIcon={<Sparkles size={14} aria-hidden="true" />}
          isLoading={busy}
          disabled={busy}
          onClick={run}
        >
          {busy
            ? t("archive.review.note_generating", "Generuję…")
            : note
              ? t("archive.review.regenerate_note", "Regeneruj notkę")
              : t("archive.review.generate_note", "Generuj notkę programową")}
        </Button>
      </div>
    </div>
  );
};
