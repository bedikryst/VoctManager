/**
 * @file ReviewArtifactsEditors.tsx
 * @description Inline editors for the AI's three most error-prone outputs —
 * movements, translations and reference recordings — used in the AI Review
 * cockpit. Previously these were read-only with nowhere to fix a hallucinated
 * movement, a wrong translation line, or an irrelevant Spotify hit; now the
 * conductor can correct or delete each in place. Editing a movement/translation
 * stamps MANUAL provenance server-side, so its chip flips from "AI" to
 * "Zweryfikowane".
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ReviewArtifactsEditors
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import type {
  Movement,
  Piece,
  ProgramNote,
  Recording,
  Translation,
} from "@/shared/types";

import {
  archiveKeys,
  useDeleteMovement,
  useDeleteProgramNote,
  useDeleteRecording,
  useDeleteTranslation,
  useGenerateProgramNote,
  useUpdateMovement,
  useUpdateProgramNote,
  useUpdateRecording,
  useUpdateTranslation,
  useVerifyPieceField,
} from "../api/archive.queries";
import { ProvenanceChip, childFieldProvenance } from "./ProvenanceChip";

/** The canonical (project-less) AI program note, if generated. Language-agnostic:
 *  the eager note is generated in the ensemble's language (Polish), and the
 *  conductor can regenerate it or add another language on demand. */
const canonicalNote = (piece: Piece) =>
  (piece.program_notes ?? []).find((n) => !n.project);

// ---------------------------------------------------------------------------
// A two-click delete affordance — no separate modal, no accidental wipes.
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
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={label}
        title={label}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-ethereal-incense/25 text-ethereal-graphite/60 transition-colors hover:border-ethereal-crimson/40 hover:text-ethereal-crimson"
      >
        <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onConfirm}
        disabled={isPending}
        aria-label={t("archive.review.confirm_delete", "Potwierdź usunięcie")}
        className="flex h-7 items-center gap-1 rounded-lg border border-ethereal-crimson/40 bg-ethereal-crimson/10 px-2 text-[11px] font-semibold text-ethereal-crimson"
      >
        {isPending ? (
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        ) : (
          <Check size={12} strokeWidth={2.2} aria-hidden="true" />
        )}
        {t("archive.review.delete", "Usuń")}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        aria-label={t("archive.review.cancel", "Anuluj")}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-ethereal-incense/25 text-ethereal-graphite/60"
      >
        <X size={13} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
};

// ===========================================================================
// Movements
// ===========================================================================

export const MovementsEditor = ({
  piece,
}: {
  readonly piece: Piece;
}): React.JSX.Element | null => {
  const movements = piece.movements ?? [];
  if (movements.length === 0) return null;
  return (
    <ul role="list" className="space-y-2">
      {movements.map((movement) => (
        <MovementRow key={movement.id} piece={piece} movement={movement} />
      ))}
    </ul>
  );
};

const MovementRow = ({
  piece,
  movement,
}: {
  readonly piece: Piece;
  readonly movement: Movement;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const update = useUpdateMovement();
  const remove = useDeleteMovement();
  const verify = useVerifyPieceField();
  const pieceId = String(piece.id);

  const [title, setTitle] = useState(movement.title);
  const [tempo, setTempo] = useState(movement.tempo_marking ?? "");
  const dirty =
    title.trim() !== movement.title ||
    tempo.trim() !== (movement.tempo_marking ?? "");

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
    <li className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/60 p-3">
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
        {movement.starts_on_page ? (
          <Caption color="muted">
            {t("archive.review.page_short", "str.")} {movement.starts_on_page}
          </Caption>
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
}): React.JSX.Element | null => {
  const translations = piece.translations ?? [];
  if (translations.length === 0) return null;
  return (
    <ul role="list" className="space-y-3">
      {translations.map((tr) => (
        <TranslationRow key={tr.id} piece={piece} translation={tr} />
      ))}
    </ul>
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

  return (
    <li className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md border border-ethereal-incense/30 bg-ethereal-parchment px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ethereal-graphite">
          {translation.target_language}
        </span>
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
    <li className="flex items-center gap-2 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/60 p-3">
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
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
          recording.is_featured
            ? "border-ethereal-gold/50 bg-ethereal-gold/10 text-ethereal-gold"
            : "border-ethereal-incense/25 text-ethereal-graphite/50 hover:text-ethereal-gold",
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
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-ethereal-incense/25 text-ethereal-graphite/60 transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-gold"
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
// The note is no longer produced eagerly at ingest — the conductor generates it
// here when wanted. Generation is async (~30s), so after dispatch we poll the
// piece until the canonical note appears (or its id changes, on a regenerate).

const POLL_MS = 4000;
const MAX_POLLS = 20; // ~80s ceiling

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
    <li className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md border border-ethereal-incense/30 bg-ethereal-parchment px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ethereal-graphite">
          {note.language}
        </span>
        {note.target_tone ? (
          <Caption color="muted">{note.target_tone}</Caption>
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
  const qc = useQueryClient();
  const generate = useGenerateProgramNote();
  const pieceId = String(piece.id);

  const notes = piece.program_notes ?? [];
  const note = canonicalNote(piece);
  const noteId = note?.id ?? null;

  const [isGenerating, setIsGenerating] = useState(false);
  const startedFromId = useRef<string | null>(null);

  useEffect(() => {
    if (!isGenerating) return;
    // Done when a canonical note exists and is a different row than we started
    // from (covers both first-generation and regenerate). The brief delete→create
    // window inside a regenerate leaves noteId null, which this guard ignores.
    if (noteId && noteId !== startedFromId.current) {
      setIsGenerating(false);
      toast.success(t("archive.review.note_ready", "Notka programowa gotowa."));
      return;
    }
    let ticks = 0;
    const handle = window.setInterval(() => {
      ticks += 1;
      if (ticks > MAX_POLLS) {
        window.clearInterval(handle);
        setIsGenerating(false);
        toast.message(
          t(
            "archive.review.note_slow",
            "Generowanie trwa dłużej niż zwykle — odśwież stronę za chwilę.",
          ),
        );
        return;
      }
      qc.invalidateQueries({ queryKey: archiveKeys.pieces.details(pieceId) });
    }, POLL_MS);
    return () => window.clearInterval(handle);
  }, [isGenerating, noteId, pieceId, qc, t]);

  const run = (force: boolean): void => {
    startedFromId.current = noteId;
    generate.mutate(
      // Regenerate the existing note in its own language; otherwise let the
      // backend default to the ensemble language.
      { pieceId, force, language: force ? note?.language : undefined },
      {
        onSuccess: () => setIsGenerating(true),
        onError: () =>
          toast.error(
            t("archive.review.note_failed", "Nie udało się uruchomić generowania."),
          ),
      },
    );
  };

  const busy = generate.isPending || isGenerating;

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
      <Button
        variant={note ? "outline" : "primary"}
        size="sm"
        leftIcon={<Sparkles size={14} aria-hidden="true" />}
        isLoading={busy}
        disabled={busy}
        onClick={() => run(Boolean(note))}
      >
        {busy
          ? t("archive.review.note_generating", "Generuję…")
          : note
            ? t("archive.review.regenerate_note", "Regeneruj notkę")
            : t("archive.review.generate_note", "Generuj notkę programową")}
      </Button>
    </div>
  );
};
