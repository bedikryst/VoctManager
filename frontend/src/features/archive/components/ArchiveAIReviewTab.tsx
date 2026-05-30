/**
 * @file ArchiveAIReviewTab.tsx
 * @description AI Review surface inside the Archive editor. Replaces the
 * separate ConductorReviewModal — all approval / re-ingest / inline edit of
 * AI-extracted fields happens here, in context, next to the canonical
 * piece-metadata tab.
 *
 * Conductor flow:
 *   1. Read AI-extracted facts (composer card, identifiers, movements, IPA,
 *      translations, program notes, recordings).
 *   2. Patch any field that AI got wrong (inline RHF form at the top).
 *   3. Upload an extra edition if needed (drag-and-drop card at the bottom).
 *   4. Approve / re-run / delete editions individually (EditionsList).
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ArchiveAIReviewTab
 */

import React, { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import {
  FileText,
  Languages,
  Library,
  Music2,
  ScrollText,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import {
  ComposerCard,
  LyricsBlock,
  MovementsList,
  ProgramNotesList,
  RecordingsList,
  WorkIdentifiersGrid,
} from "@/shared/ui/composites/repertoire";
import type { Piece } from "@/shared/types";
import { Link } from "react-router-dom";

import { useUpdatePiece } from "../api/archive.queries";
import { AIHallucinationWarning } from "./AIHallucinationWarning";
import { EditionsList } from "./EditionsList";
import { EditionUploadZone } from "./EditionUploadZone";
import type { PiecePatchDTO } from "../types/archive.dto";

interface ArchiveAIReviewTabProps {
  readonly piece: Piece;
}

const reviewSchema = z.object({
  title: z.string().min(1, "Tytuł jest wymagany").max(200),
  opus_catalog: z.string().max(40).default(""),
  musical_key: z.string().max(20).default(""),
  language: z.string().max(50).default(""),
  voicing: z.string().max(50).default(""),
  text_source: z.string().max(200).default(""),
  composition_year: z
    .union([z.coerce.number().int().min(500).max(2100), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  lyrics_original: z.string().default(""),
  lyrics_ipa: z.string().default(""),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

const SectionDivider = ({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}): React.JSX.Element => (
  <div className="mb-3 mt-8 flex items-center gap-3 first:mt-0">
    {icon && (
      <span className="text-ethereal-gold" aria-hidden="true">
        {icon}
      </span>
    )}
    <Eyebrow color="muted" size="caption">
      {label}
    </Eyebrow>
    <div
      className="h-px flex-1 bg-gradient-to-r from-ethereal-incense/30 to-transparent"
      aria-hidden="true"
    />
  </div>
);

export const ArchiveAIReviewTab = ({
  piece,
}: ArchiveAIReviewTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { mutateAsync: updatePiece, isPending: isSaving } = useUpdatePiece();

  const initialValues = useMemo<ReviewFormValues>(
    () => ({
      title: piece.title ?? "",
      opus_catalog: piece.opus_catalog ?? "",
      musical_key: piece.musical_key ?? "",
      language: piece.language ?? "",
      voicing: piece.voicing ?? "",
      text_source: piece.text_source ?? "",
      composition_year: piece.composition_year ?? null,
      lyrics_original: piece.lyrics_original ?? "",
      lyrics_ipa: piece.lyrics_ipa ?? "",
    }),
    [piece],
  );

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema) as never,
    defaultValues: initialValues,
  });

  const {
    handleSubmit,
    register,
    formState: { errors, dirtyFields, isDirty },
    reset,
  } = form;

  // Reconcile server-side updates only when the form is clean — pulling fresh
  // values mid-edit would silently destroy the conductor's in-progress work.
  const lastSyncedUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    const seen = lastSyncedUpdatedAt.current;
    const next = piece.updated_at;
    const firstLoad = seen === null;
    const serverAdvanced = seen !== null && seen !== next;
    if (firstLoad || (serverAdvanced && !isDirty)) {
      reset(initialValues);
      lastSyncedUpdatedAt.current = next ?? null;
    } else if (serverAdvanced) {
      lastSyncedUpdatedAt.current = next ?? null;
    }
  }, [piece, initialValues, isDirty, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const patch: PiecePatchDTO = {};
    for (const key of Object.keys(dirtyFields) as (keyof ReviewFormValues)[]) {
      if (!dirtyFields[key]) continue;
      const value = values[key];
      (patch as Record<string, unknown>)[key] = value === "" ? null : value;
    }
    if (Object.keys(patch).length === 0) {
      toast.info(t("archive.review.toast_no_changes", "Nic do zapisania."));
      return;
    }
    try {
      await updatePiece({ id: String(piece.id), data: patch });
      reset(values, { keepValues: true });
      toast.success(t("archive.review.toast_save_success", "Zapisano zmiany."));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("archive.review.toast_save_error", "Nie udało się zapisać zmian."),
      );
    }
  });

  const composer = piece.composer ?? null;
  const editions = piece.editions ?? [];
  const movements = piece.movements ?? [];
  const translations = piece.translations ?? [];
  const programNotes = piece.program_notes ?? [];
  const recordings = piece.recordings ?? [];

  const hasAnyAIContent =
    composer ||
    editions.length > 0 ||
    movements.length > 0 ||
    piece.lyrics_ipa ||
    translations.length > 0 ||
    programNotes.length > 0 ||
    recordings.length > 0 ||
    piece.opus_catalog ||
    piece.musical_key ||
    piece.text_source ||
    piece.mbid_work;

  if (!hasAnyAIContent) {
    return (
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Sparkles
            size={28}
            className="text-ethereal-gold/60"
            aria-hidden="true"
          />
          <Heading as="h3" size="lg" weight="medium">
            {t(
              "archive.review.empty_title",
              "Brak danych AI dla tego utworu",
            )}
          </Heading>
          <Text color="muted" size="sm" className="max-w-md">
            {t(
              "archive.review.empty_body",
              "Wgraj PDF partytury — Score Package Compiler wyciągnie metadane, znajdzie kompozytora w MusicBrainz, doda IPA, tłumaczenia i notkę programową.",
            )}
          </Text>
          <div className="mt-2 w-full max-w-xl">
            <EditionUploadZone pieceId={String(piece.id)} compact />
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <AIHallucinationWarning piece={piece} />

      {/* Inline-editable AI fields (the conductor's "AI got it wrong, fix it" surface) */}
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <SectionHeader
          title={t("archive.review.fields_section", "Pola wyciągnięte przez AI")}
          icon={<FileText size={14} aria-hidden="true" />}
        />
        <Text size="xs" color="muted" className="mb-4">
          {t(
            "archive.review.fields_hint",
            "Edytuj cokolwiek, co AI źle odczytał z PDF-a. Zmiany są zapisywane optymistycznie i widoczne dla wszystkich od razu.",
          )}
        </Text>
        <form
          id="archive-ai-review-form"
          onSubmit={onSubmit}
          className="space-y-5"
          noValidate
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Input
              label={t("archive.review.fields.title", "Tytuł utworu")}
              error={errors.title?.message}
              {...register("title")}
            />
            <Input
              label={t("archive.review.fields.opus", "Opus / Katalog")}
              placeholder="np. BWV 243, Op. 110 No. 2"
              error={errors.opus_catalog?.message}
              {...register("opus_catalog")}
            />
            <Input
              label={t("archive.review.fields.key", "Tonacja")}
              placeholder="np. D-dur"
              error={errors.musical_key?.message}
              {...register("musical_key")}
            />
            <Input
              label={t(
                "archive.review.fields.language",
                "Język śpiewu (ISO 639-1)",
              )}
              placeholder="np. la, en, pl"
              error={errors.language?.message}
              {...register("language")}
            />
            <Input
              label={t("archive.review.fields.voicing", "Obsada wokalna")}
              placeholder="np. SATB, SSAATTBB"
              error={errors.voicing?.message}
              {...register("voicing")}
            />
            <Input
              label={t(
                "archive.review.fields.composition_year",
                "Rok kompozycji",
              )}
              type="number"
              inputMode="numeric"
              error={errors.composition_year?.message}
              {...register("composition_year")}
            />
          </div>
          <Input
            label={t("archive.review.fields.text_source", "Źródło tekstu")}
            placeholder="np. Magnificat (Łk 1,46-55)"
            error={errors.text_source?.message}
            {...register("text_source")}
          />
          <Textarea
            label={t(
              "archive.review.fields.lyrics_original",
              "Tekst oryginalny (źródło dla IPA i tłumaczeń)",
            )}
            rows={6}
            error={errors.lyrics_original?.message}
            {...register("lyrics_original")}
          />
          <Textarea
            label={t(
              "archive.review.fields.lyrics_ipa",
              "Transkrypcja IPA (wymowa)",
            )}
            rows={4}
            placeholder={t(
              "archive.review.fields.lyrics_ipa_placeholder",
              "Wymowa w IPA wyciągnięta przez AI. Edytuj, jeśli jest niepoprawna.",
            )}
            error={errors.lyrics_ipa?.message}
            {...register("lyrics_ipa")}
          />
          <div className="flex justify-end pt-3 border-t border-ethereal-incense/10">
            <Button
              type="submit"
              disabled={!isDirty || isSaving}
              isLoading={isSaving}
            >
              {t("archive.review.save_btn", "Zapisz zmiany AI")}
            </Button>
          </div>
        </form>
      </GlassCard>

      {/* Composer card (MB + Wikidata) */}
      {composer && <ComposerCard composer={composer} />}

      {/* AI-discovered identifiers (read-only mirror of the form above) */}
      {(piece.opus_catalog ||
        piece.musical_key ||
        piece.text_source ||
        piece.mbid_work) && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.review.identifiers_section",
              "Identyfikatory utworu",
            )}
          />
          <WorkIdentifiersGrid
            opus_catalog={piece.opus_catalog}
            musical_key={piece.musical_key}
            text_source={piece.text_source}
            mbid_work={piece.mbid_work}
          />
        </GlassCard>
      )}

      {/* Editions — per-PDF cards with approve/reingest/delete */}
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <SectionDivider
          label={t(
            "archive.review.editions_section",
            "Wydania nutowe ({{count}})",
            { count: editions.length },
          )}
          icon={<Library size={14} aria-hidden="true" />}
        />
        <EditionsList editions={editions} />
        <div className="mt-6 border-t border-ethereal-incense/15 pt-6">
          <Caption color="muted" className="mb-3 flex items-center gap-2">
            <UploadCloud size={12} aria-hidden="true" />
            {t(
              "archive.review.add_edition",
              "Dodaj kolejne wydanie (np. inny wydawca)",
            )}
          </Caption>
          <EditionUploadZone pieceId={String(piece.id)} compact />
        </div>
      </GlassCard>

      {/* Movements */}
      {movements.length > 0 && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.review.movements_section",
              "Części ({{count}})",
              { count: movements.length },
            )}
            icon={<Music2 size={14} aria-hidden="true" />}
          />
          <MovementsList movements={movements} showPage />
        </GlassCard>
      )}

      {/* IPA + translations */}
      {(piece.lyrics_ipa || translations.length > 0) && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.review.lyrics_section",
              "Wymowa i tłumaczenia",
            )}
            icon={<Languages size={14} aria-hidden="true" />}
          />
          <LyricsBlock ipa={piece.lyrics_ipa} translations={translations} />
        </GlassCard>
      )}

      {/* Program notes */}
      {programNotes.length > 0 && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.review.program_note_section",
              "Notka programowa",
            )}
            icon={<ScrollText size={14} aria-hidden="true" />}
          />
          <ProgramNotesList notes={programNotes} />
        </GlassCard>
      )}

      {/* Recordings */}
      {recordings.length > 0 && (
        <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
          <SectionDivider
            label={t(
              "archive.review.recordings_section",
              "Nagrania referencyjne ({{count}})",
              { count: recordings.length },
            )}
            icon={<Sparkles size={14} aria-hidden="true" />}
          />
          <RecordingsList recordings={recordings} columns={2} />
        </GlassCard>
      )}

      {/* Quiet escape hatch — manager wants to do something else */}
      <div className="flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <Link to="/panel/archive-management">
            {t("archive.review.back_to_archive", "Wróć do biblioteki")}
          </Link>
        </Button>
      </div>
    </div>
  );
};
