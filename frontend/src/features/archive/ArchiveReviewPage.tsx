/**
 * @file ArchiveReviewPage.tsx
 * @description Full-page AI verification surface for a single ScoreEdition.
 * PDF preview on the left half, editable AI extraction on the right half,
 * sticky action bar at the bottom. Reachable from the Archive row's
 * "Tryb weryfikacji" CTA, from the Awaiting banner, and from the stat strip.
 *
 * Why a dedicated route (not a panel): verifying AI requires reading both
 * the PDF and the extracted metadata in parallel. A side panel doesn't
 * have the horizontal real estate; a modal blocks navigation. This page
 * also supports browser-back and is deep-linkable from notifications.
 *
 * Default export: consumed by App.tsx via React.lazy.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/ArchiveReviewPage
 */

import React, { useEffect, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  FileText,
  Languages,
  Library,
  Music2,
  ScrollText,
  Sparkles,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
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
import { cn } from "@/shared/lib/utils";
import { PdfViewer } from "@/shared/ui/composites/PdfViewer";
import { MaterialsService } from "@/features/materials/api/materials.service";
import { useScoreAnnotator } from "@/features/annotations";

import { usePiece, usePieces, useUpdatePiece } from "./api/archive.queries";
import type { PiecePatchDTO } from "./types/archive.dto";
import { AIHallucinationWarning } from "./components/AIHallucinationWarning";
import { EditionsList } from "./components/EditionsList";
import { EditionUploadZone } from "./components/EditionUploadZone";
import { getPrimaryPdf } from "./constants/piecePdfs";
import { INGESTION_STATUS, type Piece } from "@/shared/types";

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
  <div className="mb-3 mt-6 flex items-center gap-3 first:mt-0">
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

const findNextAwaiting = (pieces: Piece[], currentId: string): Piece | null => {
  const awaiting = pieces.filter((p) =>
    (p.editions ?? []).some(
      (e) => e.ingestion_status === INGESTION_STATUS.AWAITING,
    ),
  );
  if (awaiting.length === 0) return null;
  const currentIndex = awaiting.findIndex((p) => String(p.id) === currentId);
  if (currentIndex === -1) return awaiting[0];
  return awaiting[(currentIndex + 1) % awaiting.length];
};

export default function ArchiveReviewPage(): React.JSX.Element {
  const { id = "" } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: piece, isLoading, isError, error } = usePiece(id);
  const { data: allPieces = [] } = usePieces();
  const updatePiece = useUpdatePiece();

  // Conductor markup, right in the main score preview (not buried in the
  // editions list below). Archive is manager-only, so editing is always on.
  const annotator = useScoreAnnotator({
    editionId: piece ? getPrimaryPdf(piece)?.id ?? null : null,
    canEdit: true,
  });

  // ---- Form wiring -------------------------------------------------------
  const initial = useMemo<ReviewFormValues>(
    () => ({
      title: piece?.title ?? "",
      opus_catalog: piece?.opus_catalog ?? "",
      musical_key: piece?.musical_key ?? "",
      language: piece?.language ?? "",
      voicing: piece?.voicing ?? "",
      text_source: piece?.text_source ?? "",
      composition_year: piece?.composition_year ?? null,
      lyrics_original: piece?.lyrics_original ?? "",
      lyrics_ipa: piece?.lyrics_ipa ?? "",
    }),
    [piece],
  );

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema) as never,
    defaultValues: initial,
  });

  const {
    handleSubmit,
    register,
    formState: { errors, dirtyFields, isDirty },
    reset,
  } = form;

  // Dirty-aware reconcile: pull server values into the form only when clean.
  const lastSyncedUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (!piece) return;
    const seen = lastSyncedUpdatedAt.current;
    const next = piece.updated_at ?? null;
    const firstLoad = seen === null;
    const serverAdvanced = seen !== null && seen !== next;
    if (firstLoad || (serverAdvanced && !isDirty)) {
      reset(initial);
      lastSyncedUpdatedAt.current = next;
    } else if (serverAdvanced) {
      lastSyncedUpdatedAt.current = next;
    }
  }, [piece, initial, isDirty, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!piece) return;
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
      await updatePiece.mutateAsync({ id: String(piece.id), data: patch });
      reset(values, { keepValues: true });
      toast.success(t("archive.review.toast_save_success", "Zapisano zmiany."));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t(
              "archive.review.toast_save_error",
              "Nie udało się zapisać zmian.",
            ),
      );
    }
  });

  // ---- Loading / error states -------------------------------------------
  if (isLoading || !piece) {
    if (isError) {
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <Text color="crimson">
            {t(
              "archive.review.fetch_error",
              "Nie udało się pobrać szczegółów utworu:",
            )}{" "}
            {error instanceof Error
              ? error.message
              : t("archive.review.fetch_unknown", "nieznany błąd")}
          </Text>
          <Button asChild variant="outline" size="sm" className="mt-6">
            <Link to="/panel/archive-management">
              {t("archive.review.back", "Wróć do biblioteki")}
            </Link>
          </Button>
        </div>
      );
    }
    return <EtherealLoader />;
  }

  const composer = piece.composer ?? null;
  const editions = piece.editions ?? [];
  const movements = piece.movements ?? [];
  const translations = piece.translations ?? [];
  const programNotes = piece.program_notes ?? [];
  const recordings = piece.recordings ?? [];
  const primaryPdf = getPrimaryPdf(piece);
  const composerName = composer
    ? `${composer.first_name ?? ""} ${composer.last_name}`.trim()
    : t("archive.review.no_composer", "Brak kompozytora");

  const nextAwaiting = findNextAwaiting(allPieces, String(piece.id));

  return (
    <PageTransition>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Header */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ethereal-incense/15 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
            >
              <Link to="/panel/archive-management">
                {t("archive.review.back_btn", "Biblioteka")}
              </Link>
            </Button>
            <ChevronRight
              size={14}
              aria-hidden="true"
              className="text-ethereal-graphite/40"
            />
            <div className="min-w-0">
              <Heading
                as="h1"
                size="lg"
                weight="medium"
                className="truncate font-serif"
              >
                {piece.title}
              </Heading>
              <Caption color="muted" className="block truncate">
                {composerName}
                {piece.composition_year && ` · ${piece.composition_year}`}
              </Caption>
            </div>
          </div>
          {nextAwaiting && String(nextAwaiting.id) !== String(piece.id) && (
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight size={13} aria-hidden="true" />}
              onClick={() =>
                navigate(`/panel/archive-management/${nextAwaiting.id}/review`)
              }
            >
              {t(
                "archive.review.next_awaiting",
                "Następne do przeglądu",
              )}
            </Button>
          )}
        </header>

        {/* Body — split PDF preview / form */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* PDF preview */}
          <section
            className="relative shrink-0 border-b border-ethereal-incense/15 lg:w-1/2 lg:border-b-0 lg:border-r"
            aria-label={t(
              "archive.review.pdf_preview_aria",
              "Podgląd PDF partytury",
            )}
          >
            {primaryPdf ? (
              <div className="flex h-[50vh] flex-col lg:h-full">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ethereal-incense/10 bg-ethereal-alabaster/40 px-3 py-2">
                  <Caption color="muted" className="truncate">
                    {primaryPdf.label}
                    {primaryPdf.page_count && ` · ${primaryPdf.page_count} stron`}
                  </Caption>
                  <Button asChild variant="ghost" size="sm">
                    <a
                      href={primaryPdf.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("archive.review.pdf_open_full", "Otwórz w nowej karcie")}
                    </a>
                  </Button>
                </div>
                {/* In-app render (react-pdf) instead of an <iframe>: the gated
                    score URL sets X-Frame-Options: DENY, so framing it is
                    refused by the browser. fetchScoreEditionBlob streams the
                    PDF through the authenticated axios instance. */}
                <div className="min-h-0 flex-1">
                  <PdfViewer
                    fetchBlob={() =>
                      MaterialsService.fetchScoreEditionBlob(primaryPdf.id)
                    }
                    docKey={primaryPdf.id}
                    title={piece.title}
                    subtitle={primaryPdf.label}
                    fileName={primaryPdf.label}
                    toolbarSlot={annotator.toolbarSlot}
                    renderPageOverlay={annotator.renderPageOverlay}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center lg:h-full">
                <FileText
                  size={32}
                  className="text-ethereal-graphite/30"
                  aria-hidden="true"
                />
                <Text color="muted">
                  {t(
                    "archive.review.no_pdf",
                    "Brak PDF dla tego utworu. Wgraj plik poniżej.",
                  )}
                </Text>
                <div className="w-full max-w-md">
                  <EditionUploadZone pieceId={String(piece.id)} compact />
                </div>
              </div>
            )}
          </section>

          {/* Form panel */}
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden lg:w-1/2"
            aria-label={t(
              "archive.review.form_panel_aria",
              "Edycja metadanych wyekstrahowanych przez AI",
            )}
          >
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
              <div className="space-y-5">
                <AIHallucinationWarning piece={piece} />

                {/* Editable AI fields */}
                <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
                  <Eyebrow color="muted" size="caption" className="mb-1 block">
                    {t("archive.review.fields_title", "Pola wyciągnięte przez AI")}
                  </Eyebrow>
                  <Text size="xs" color="graphite" className="mb-4">
                    {t(
                      "archive.review.fields_hint",
                      "Sprawdź każde pole z podglądem PDF po lewej. Edytuj jeśli AI źle odczytał.",
                    )}
                  </Text>
                  <form
                    id="review-form"
                    onSubmit={onSubmit}
                    noValidate
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Input
                        label={t("archive.review.fields.title", "Tytuł")}
                        error={errors.title?.message}
                        {...register("title")}
                      />
                      <Input
                        label={t("archive.review.fields.opus", "Opus / Katalog")}
                        placeholder="np. BWV 243"
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
                          "Język śpiewu",
                        )}
                        placeholder="np. la, en, pl"
                        error={errors.language?.message}
                        {...register("language")}
                      />
                      <Input
                        label={t("archive.review.fields.voicing", "Obsada")}
                        placeholder="np. SATB"
                        error={errors.voicing?.message}
                        {...register("voicing")}
                      />
                      <Input
                        label={t(
                          "archive.review.fields.composition_year",
                          "Rok kompozycji",
                        )}
                        type="number"
                        error={errors.composition_year?.message}
                        {...register("composition_year")}
                      />
                    </div>
                    <Input
                      label={t(
                        "archive.review.fields.text_source",
                        "Źródło tekstu",
                      )}
                      placeholder="np. Magnificat (Łk 1,46-55)"
                      error={errors.text_source?.message}
                      {...register("text_source")}
                    />
                    <Textarea
                      label={t(
                        "archive.review.fields.lyrics_original",
                        "Tekst oryginalny",
                      )}
                      rows={4}
                      error={errors.lyrics_original?.message}
                      {...register("lyrics_original")}
                    />
                    <Textarea
                      label={t(
                        "archive.review.fields.lyrics_ipa",
                        "Transkrypcja IPA",
                      )}
                      rows={3}
                      error={errors.lyrics_ipa?.message}
                      {...register("lyrics_ipa")}
                    />
                  </form>
                </GlassCard>

                {composer && <ComposerCard composer={composer} />}

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
                  <div className="mt-5 border-t border-ethereal-incense/15 pt-5">
                    <Caption color="muted" className="mb-2 block">
                      {t(
                        "archive.review.add_edition_hint",
                        "Dodaj kolejne wydanie (Bärenreiter, IMSLP, własna aranżacja)",
                      )}
                    </Caption>
                    <EditionUploadZone pieceId={String(piece.id)} compact />
                  </div>
                </GlassCard>

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

                {(piece.lyrics_ipa || translations.length > 0) && (
                  <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
                    <SectionDivider
                      label={t(
                        "archive.review.lyrics_section",
                        "Wymowa i tłumaczenia",
                      )}
                      icon={<Languages size={14} aria-hidden="true" />}
                    />
                    <LyricsBlock
                      ipa={piece.lyrics_ipa}
                      translations={translations}
                    />
                  </GlassCard>
                )}

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
                    <RecordingsList recordings={recordings} columns={1} />
                  </GlassCard>
                )}
              </div>
            </div>

            {/* Sticky action bar */}
            <footer
              className={cn(
                "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ethereal-incense/15 bg-ethereal-alabaster/55 px-4 py-3 md:px-6",
                isDirty && "border-t-ethereal-gold/40 bg-ethereal-gold/5",
              )}
            >
              {isDirty && (
                <Caption color="gold" className="mr-auto">
                  {t(
                    "archive.review.dirty_hint",
                    "Masz niezapisane zmiany",
                  )}
                </Caption>
              )}
              <Button
                type="submit"
                form="review-form"
                variant="primary"
                disabled={!isDirty || updatePiece.isPending}
                isLoading={updatePiece.isPending}
              >
                {t("archive.review.save_btn", "Zapisz zmiany AI")}
              </Button>
            </footer>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
