/**
 * @file ConductorReviewModal.tsx
 * @description Full-bleed review surface for a single ScoreEdition. Surfaces
 * the AI-extracted metadata, MusicBrainz / Wikidata enrichments, generated
 * program note, lyrics, IPA, translations and reference recordings. Editable
 * fields (edition + piece metadata) flow through optimistic PATCH mutations;
 * lyrics, translations and program notes are read-only in this phase.
 * @architecture Enterprise SaaS 2026
 * @module features/score-compiler/components/modals/ConductorReviewModal
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  FileDown,
  Languages,
  Music2,
  RefreshCcw,
  ScrollText,
  Sparkles,
  X,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import {
  Caption,
  Eyebrow,
  Heading,
  Label,
  Text,
} from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { cn } from "@/shared/lib/utils";

import {
  useApproveScoreEdition,
  usePatchPiece,
  usePatchScoreEdition,
  useReingestScoreEdition,
  useScoreEdition,
} from "../../api/score-compiler.queries";
import {
  type ComposerSummaryDTO,
  type PiecePatchDTO,
  type RecordingDTO,
  type ScoreEditionPatchDTO,
  type VoiceRequirementInput,
} from "../../types/score-compiler.dto";
import { useVoiceLines } from "@/shared/api/options.queries";
import { EditionStatusBadge } from "../EditionStatusBadge";
import { DivisiEditor } from "../DivisiEditor";

// ---------------------------------------------------------------------------
// Schema — fields the conductor can edit. Numeric coercion handled by Zod.
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  // Piece-level
  title: z.string().min(1, "Tytuł jest wymagany").max(255),
  opus_catalog: z.string().max(120).optional().default(""),
  musical_key: z.string().max(40).optional().default(""),
  language: z.string().max(40).optional().default(""),
  voicing: z.string().max(120).optional().default(""),
  text_source: z.string().max(255).optional().default(""),
  composition_year: z
    .union([z.coerce.number().int().min(0).max(2100), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  // Estimated duration is captured as separate min/sec inputs in the UI;
  // we recombine into total-seconds on submit. Keeping them in the schema
  // lets RHF's dirty tracking pick up the change cleanly.
  duration_mins: z
    .union([z.coerce.number().int().min(0).max(600), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : v)),
  duration_secs: z
    .union([z.coerce.number().int().min(0).max(59), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : v)),
  lyrics_original: z.string().optional().default(""),
  // Edition-level
  publisher: z.string().max(120).optional().default(""),
  editor_name: z.string().max(120).optional().default(""),
  edition_year: z
    .union([z.coerce.number().int().min(0).max(2100), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  is_default: z.boolean().optional().default(false),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

const PIECE_FIELDS = [
  "title",
  "opus_catalog",
  "musical_key",
  "language",
  "voicing",
  "text_source",
  "composition_year",
  "lyrics_original",
] as const satisfies readonly (keyof PiecePatchDTO)[];

const DURATION_DIRTY_FIELDS = ["duration_mins", "duration_secs"] as const;

const EDITION_FIELDS = [
  "publisher",
  "editor_name",
  "edition_year",
  "is_default",
] as const satisfies readonly (keyof ScoreEditionPatchDTO)[];

// ---------------------------------------------------------------------------

export interface ConductorReviewModalProps {
  readonly editionId: string | null;
  readonly onClose: () => void;
}

export const ConductorReviewModal = ({
  editionId,
  onClose,
}: ConductorReviewModalProps): React.ReactPortal | null => {
  useBodyScrollLock(editionId !== null);

  // Escape closes the modal — match the codebase's ConfirmModal convention.
  useEffect(() => {
    if (editionId === null) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editionId, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {editionId !== null && (
        <ModalShell editionId={editionId} onClose={onClose} />
      )}
    </AnimatePresence>,
    document.body,
  );
};

// ---------------------------------------------------------------------------
// Shell — owns layout + backdrop. Form lives in `<ReviewBody>` so it remounts
// cleanly with the next selected editionId.
// ---------------------------------------------------------------------------

interface ModalShellProps {
  readonly editionId: string;
  readonly onClose: () => void;
}

const ModalShell = ({
  editionId,
  onClose,
}: ModalShellProps): React.JSX.Element => {
  return (
    <div className="fixed inset-0 z-focus-trap flex items-stretch justify-center overflow-y-auto p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 -z-10 bg-ethereal-ink/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.99 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative my-auto w-full max-w-4xl"
        role="dialog"
        aria-modal="true"
        aria-label="Conductor review for score edition"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard
          variant="ethereal"
          padding="none"
          isHoverable={false}
        >
          <ReviewBody editionId={editionId} onClose={onClose} />
        </GlassCard>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Body — fetches detail, drives form, dispatches mutations.
// ---------------------------------------------------------------------------

const ReviewBody = ({
  editionId,
  onClose,
}: ModalShellProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: edition, isLoading, isError, error } = useScoreEdition(editionId);
  const { mutateAsync: patchEdition, isPending: isPatchingEdition } =
    usePatchScoreEdition();
  const { mutateAsync: patchPiece, isPending: isPatchingPiece } =
    usePatchPiece(editionId);
  const { mutate: approveEdition, isPending: isApproving } =
    useApproveScoreEdition();
  const { mutate: reingestEdition, isPending: isReingesting } =
    useReingestScoreEdition();

  const piece = edition?.piece ?? null;
  const composer = piece?.composer ?? null;
  const { data: voiceLines = [] } = useVoiceLines();

  const initialDuration = useMemo(() => {
    const total = piece?.estimated_duration ?? 0;
    return {
      mins: total > 0 ? Math.floor(total / 60) : 0,
      secs: total > 0 ? total % 60 : 0,
    };
  }, [piece]);

  const initial: ReviewFormValues = useMemo(
    () => ({
      title: piece?.title ?? "",
      opus_catalog: piece?.opus_catalog ?? "",
      musical_key: piece?.musical_key ?? "",
      language: piece?.language ?? "",
      voicing: piece?.voicing ?? "",
      text_source: piece?.text_source ?? "",
      composition_year: piece?.composition_year ?? null,
      duration_mins: initialDuration.mins,
      duration_secs: initialDuration.secs,
      lyrics_original: piece?.lyrics_original ?? "",
      publisher: edition?.publisher ?? "",
      editor_name: edition?.editor_name ?? "",
      edition_year: edition?.edition_year ?? null,
      is_default: edition?.is_default ?? false,
    }),
    [edition, piece, initialDuration],
  );

  // Divisi state lives outside RHF — the editor mutates an array of
  // {voice_line, quantity}, which RHF's flat schema can't represent
  // ergonomically. We snapshot the server-side requirements and diff on save.
  const initialRequirements = useMemo<readonly VoiceRequirementInput[]>(
    () =>
      (piece?.voice_requirements ?? []).map((r) => ({
        voice_line: r.voice_line,
        quantity: r.quantity,
      })),
    [piece],
  );
  const [requirements, setRequirements] = useState<
    readonly VoiceRequirementInput[]
  >(initialRequirements);

  // Important: NOT using RHF's `values` prop here. `values` resets the form on
  // every render where the reference changes, which (with TanStack polling
  // refetching every 3s on in-progress editions) would silently blow away
  // mid-edit conductor changes. Instead, we seed `defaultValues` once and
  // reconcile manually only when the server actually advances `updated_at`
  // AND the form is not dirty.
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema) as never,
    defaultValues: initial,
  });

  const {
    handleSubmit,
    register,
    control,
    formState: { errors, dirtyFields, isDirty },
    reset,
  } = form;

  // Has the divisi editor been touched by the conductor? Compared by JSON so
  // ordering of the array elements doesn't matter for dirty detection.
  const requirementsDirty = useMemo(() => {
    const norm = (xs: readonly VoiceRequirementInput[]) =>
      [...xs]
        .map((r) => `${r.voice_line}:${r.quantity}`)
        .sort()
        .join("|");
    return norm(requirements) !== norm(initialRequirements);
  }, [requirements, initialRequirements]);

  const lastSyncedUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (!edition) return;
    const seen = lastSyncedUpdatedAt.current;
    const next = edition.updated_at;
    const firstLoad = seen === null;
    const serverAdvanced = seen !== null && seen !== next;
    const formDirty = isDirty || requirementsDirty;
    if (firstLoad || (serverAdvanced && !formDirty)) {
      reset(initial);
      setRequirements(initialRequirements);
      lastSyncedUpdatedAt.current = next;
    } else if (serverAdvanced && formDirty) {
      // Keep the user's edits — record the new server timestamp so future
      // syncs don't fire repeatedly for the same revision.
      lastSyncedUpdatedAt.current = next;
    }
  }, [
    edition,
    initial,
    initialRequirements,
    isDirty,
    requirementsDirty,
    reset,
  ]);

  // Re-run cost confirmation — kept local because the warning is specific to
  // this action (re-incurs Anthropic tokens up to the cost ceiling).
  const [reingestPending, setReingestPending] = useState(false);

  const onSubmit = handleSubmit(async (values) => {
    if (!edition) return;
    try {
      const piecePatch: PiecePatchDTO = pickDirty(
        values,
        dirtyFields,
        PIECE_FIELDS,
      );
      const editionPatch = pickDirty(values, dirtyFields, EDITION_FIELDS);

      // Fold the split-input duration back into total seconds. Treat 0 mins +
      // 0 secs as "clear the field" → null, matching the Archive form.
      const durationDirty = DURATION_DIRTY_FIELDS.some(
        (f) => dirtyFields[f],
      );
      if (durationDirty) {
        const total =
          Number(values.duration_mins ?? 0) * 60 +
          Number(values.duration_secs ?? 0);
        piecePatch.estimated_duration = total > 0 ? total : null;
      }

      if (requirementsDirty) {
        // requirements_data is the legacy write-only field on PieceSerializer
        // — same shape used by the Archive editor, so the backend doesn't
        // need a new entrypoint.
        piecePatch.requirements_data = [...requirements];
      }

      const tasks: Promise<unknown>[] = [];
      if (piece && Object.keys(piecePatch).length > 0) {
        tasks.push(patchPiece({ pieceId: piece.id, dto: piecePatch }));
      }
      if (Object.keys(editionPatch).length > 0) {
        tasks.push(
          patchEdition({ id: edition.id, dto: editionPatch }),
        );
      }
      if (tasks.length === 0) {
        toast.info(
          t("score_compiler.toast.no_changes", "Nic do zapisania — brak zmian."),
        );
        return;
      }
      await Promise.all(tasks);
      // The polling refetch + the dirty-aware reset effect above will pull
      // server-normalized values into the form (e.g. trimmed strings, default
      // year-coercions). Mark the form clean immediately so the action bar
      // updates without waiting for the next poll.
      reset(values, { keepValues: true });
      toast.success(
        t("score_compiler.toast.save_success", "Zapisano zmiany."),
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t(
              "score_compiler.toast.save_error",
              "Nie udało się zapisać zmian.",
            ),
      );
    }
  });

  const handleApprove = (): void => {
    if (!edition) return;
    approveEdition(edition.id, {
      onSuccess: () => {
        toast.success(
          t(
            "score_compiler.toast.approve_success",
            "Wydanie zatwierdzone — gotowe do koncertowego bindera.",
          ),
        );
      },
      onError: (err) =>
        toast.error(
          err instanceof Error
            ? err.message
            : t(
                "score_compiler.toast.approve_error",
                "Nie udało się zatwierdzić wydania.",
              ),
        ),
    });
  };

  const confirmReingest = (): void => {
    if (!edition) return;
    reingestEdition(
      { id: edition.id, force: false },
      {
        onSuccess: () =>
          toast.success(
            t(
              "score_compiler.toast.reingest_success",
              "Pipeline uruchomiony — koszty zostały wyzerowane.",
            ),
          ),
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : t(
                  "score_compiler.toast.reingest_error",
                  "Nie udało się ponownie uruchomić pipeline.",
                ),
          ),
      },
    );
    setReingestPending(false);
  };

  const busy =
    isPatchingEdition || isPatchingPiece || isApproving || isReingesting;
  // Approve refuses to publish a piece with no composer — the AI extraction
  // failed to identify one, and approving would commit dirty data to the
  // canonical repertoire.
  const canApprove =
    edition?.ingestion_status === "AWAI" && Boolean(composer);
  const approveDisabledReason = !edition
    ? ""
    : edition.ingestion_status !== "AWAI"
      ? t(
          "score_compiler.approve.requires_awai",
          "Zatwierdzenie wymaga statusu AWAI",
        )
      : !composer
        ? t(
            "score_compiler.approve.requires_composer",
            "Brak kompozytora — uzupełnij wpis przed zatwierdzeniem",
          )
        : t(
            "score_compiler.approve.ready",
            "Oznacz wydanie jako zatwierdzone (RDY)",
          );

  // ----- render --------------------------------------------------------------

  return (
    <div className="flex max-h-[calc(100vh-3rem)] flex-col">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 border-b border-ethereal-incense/15 px-6 py-5 md:px-8">
        <div className="min-w-0">
          <Eyebrow color="muted" size="caption">
            {t("score_compiler.review.eyebrow", "Conductor review")}
          </Eyebrow>
          <Heading
            as="h2"
            size="2xl"
            weight="medium"
            className="mt-1 truncate"
          >
            {piece?.title?.trim() ||
              edition?.original_filename ||
              t("score_compiler.review.loading", "Ładowanie…")}
          </Heading>
          {composer && (
            <Caption color="muted" className="mt-1 block">
              {[composer.first_name, composer.last_name]
                .filter(Boolean)
                .join(" ")}
              {composer.birth_year && ` · ${composer.birth_year}`}
              {composer.death_year && `–${composer.death_year}`}
            </Caption>
          )}
        </div>
        <div className="flex items-center gap-3">
          {edition && <EditionStatusBadge status={edition.ingestion_status} />}
          <Button
            variant="icon"
            size="icon"
            aria-label={t(
              "score_compiler.review.close_aria",
              "Zamknij okno przeglądu",
            )}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
        {isLoading || !edition ? (
          <div className="flex justify-center py-16">
            <EtherealLoader />
          </div>
        ) : isError ? (
          <Text color="crimson">
            {t(
              "score_compiler.review.fetch_error",
              "Nie udało się pobrać szczegółów wydania:",
            )}{" "}
            {error instanceof Error
              ? error.message
              : t("score_compiler.toast.unknown_error", "nieznany błąd")}
          </Text>
        ) : (
          <form id="conductor-review-form" onSubmit={onSubmit} noValidate>
            {edition.ingestion_error && (
              <div className="mb-6 rounded-2xl border border-ethereal-crimson/30 bg-ethereal-crimson/5 p-4">
                <Eyebrow color="crimson" size="caption">
                  {t("score_compiler.review.pipeline_error", "Błąd pipeline")}
                </Eyebrow>
                <Text size="sm" color="crimson" className="mt-1">
                  {edition.ingestion_error}
                </Text>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Input
                label={t("score_compiler.fields.title", "Tytuł utworu")}
                error={errors.title?.message}
                {...register("title")}
              />
              <Input
                label={t("score_compiler.fields.opus", "Opus / katalog")}
                placeholder="np. BWV 243, Op. 37 No. 6"
                error={errors.opus_catalog?.message}
                {...register("opus_catalog")}
              />
              <Input
                label={t("score_compiler.fields.key", "Tonacja")}
                placeholder="np. D-dur"
                error={errors.musical_key?.message}
                {...register("musical_key")}
              />
              <Input
                label={t(
                  "score_compiler.fields.language",
                  "Język śpiewu (ISO 639-1)",
                )}
                placeholder="np. la, en, pl"
                error={errors.language?.message}
                {...register("language")}
              />
              <Input
                label={t("score_compiler.fields.voicing", "Obsada wokalna")}
                placeholder="np. SATB, SSAATTBB"
                error={errors.voicing?.message}
                {...register("voicing")}
              />
              <Input
                label={t(
                  "score_compiler.fields.text_source",
                  "Źródło tekstu",
                )}
                placeholder="np. Magnificat (Łk 1,46-55)"
                error={errors.text_source?.message}
                {...register("text_source")}
              />
              <Input
                label={t(
                  "score_compiler.fields.composition_year",
                  "Rok kompozycji",
                )}
                type="number"
                inputMode="numeric"
                error={errors.composition_year?.message}
                {...register("composition_year")}
              />
            </div>

            <section className="mt-8">
              <Eyebrow color="muted" size="caption">
                {t(
                  "score_compiler.review.lyrics_label",
                  "Tekst oryginalny (źródło dla IPA i tłumaczeń)",
                )}
              </Eyebrow>
              <Textarea
                rows={6}
                className="mt-2"
                placeholder={t(
                  "score_compiler.review.lyrics_placeholder",
                  "Tekst łaciński, niemiecki, polski…",
                )}
                error={errors.lyrics_original?.message}
                {...register("lyrics_original")}
              />
            </section>

            <SectionDivider
              label={t(
                "score_compiler.review.performance_section",
                "Materiały wykonawcze (dla planowania koncertu)",
              )}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <Eyebrow
                  color="muted"
                  size="caption"
                  className="ml-1 block"
                >
                  {t(
                    "score_compiler.review.duration_label",
                    "Szacowany czas trwania",
                  )}
                </Eyebrow>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={600}
                    placeholder="min"
                    aria-label={t(
                      "score_compiler.review.duration_mins_aria",
                      "Minuty",
                    )}
                    error={errors.duration_mins?.message}
                    {...register("duration_mins")}
                  />
                  <span aria-hidden="true" className="text-ethereal-graphite/60">
                    :
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    placeholder="sek"
                    aria-label={t(
                      "score_compiler.review.duration_secs_aria",
                      "Sekundy",
                    )}
                    error={errors.duration_secs?.message}
                    {...register("duration_secs")}
                  />
                </div>
              </div>

              <DivisiEditor
                voiceLines={voiceLines}
                value={requirements}
                onChange={setRequirements}
              />
            </div>

            <SectionDivider
              label={t(
                "score_compiler.review.edition_section",
                "Metadane wydania",
              )}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Input
                label={t("score_compiler.fields.publisher", "Wydawca")}
                error={errors.publisher?.message}
                {...register("publisher")}
              />
              <Input
                label={t("score_compiler.fields.editor", "Redaktor")}
                error={errors.editor_name?.message}
                {...register("editor_name")}
              />
              <Input
                label={t(
                  "score_compiler.fields.edition_year",
                  "Rok wydania",
                )}
                type="number"
                inputMode="numeric"
                error={errors.edition_year?.message}
                {...register("edition_year")}
              />
            </div>
            <div className="mt-4">
              <Controller
                name="is_default"
                control={control}
                render={({ field }) => (
                  <label className="inline-flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                        field.value
                          ? "border-ethereal-gold bg-ethereal-gold text-white"
                          : "border-ethereal-incense/40 bg-white",
                      )}
                      aria-hidden="true"
                    >
                      {field.value && (
                        <CheckCircle2 size={14} strokeWidth={3} />
                      )}
                    </span>
                    <Label size="sm" weight="medium">
                      {t(
                        "score_compiler.fields.is_default",
                        "Ustaw jako domyślne wydanie tego utworu",
                      )}
                    </Label>
                  </label>
                )}
              />
            </div>

            {/* PDF download / preview link */}
            <SectionDivider
              label={t("score_compiler.review.source_file", "Źródłowy plik")}
            />
            <div className="flex items-center gap-3 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4">
              <FileDown
                size={18}
                className="text-ethereal-gold"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <Text size="sm" weight="semibold" truncate className="block">
                  {edition.original_filename}
                </Text>
                <Caption color="muted">
                  {edition.page_count
                    ? t(
                        "score_compiler.review.pages_count",
                        "{{count}} stron",
                        { count: edition.page_count },
                      )
                    : t(
                        "score_compiler.review.pages_unknown",
                        "Liczba stron nieznana",
                      )}
                  {edition.sha256 && ` · sha256 ${edition.sha256.slice(0, 12)}…`}
                </Caption>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                rightIcon={<ExternalLink size={14} aria-hidden="true" />}
              >
                <a href={edition.pdf_file} target="_blank" rel="noreferrer">
                  {t("score_compiler.review.open_pdf", "Otwórz PDF")}
                </a>
              </Button>
            </div>

            {/* Composer summary */}
            {composer && <ComposerCard composer={composer} />}

            {/* Movements */}
            {piece && piece.movements.length > 0 && (
              <>
                <SectionDivider
                  label={t(
                    "score_compiler.review.movements_count",
                    "Części ({{count}})",
                    { count: piece.movements.length },
                  )}
                  icon={<Music2 size={14} aria-hidden="true" />}
                />
                <ul role="list" className="flex flex-col gap-2">
                  {[...piece.movements]
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((mv) => (
                      <li
                        key={mv.id}
                        className="flex items-baseline gap-3 rounded-xl border border-ethereal-incense/15 bg-ethereal-alabaster/55 px-4 py-2"
                      >
                        <Eyebrow color="muted" size="caption">
                          {String(mv.order_index + 1).padStart(2, "0")}
                        </Eyebrow>
                        <Text size="sm" weight="medium" className="flex-1">
                          {mv.title}
                        </Text>
                        {mv.tempo_marking && (
                          <Caption color="muted" className="italic">
                            {mv.tempo_marking}
                          </Caption>
                        )}
                        {mv.starts_on_page !== null && (
                          <Caption color="muted">
                            {t(
                              "score_compiler.review.page_short",
                              "s. {{page}}",
                              { page: mv.starts_on_page },
                            )}
                          </Caption>
                        )}
                      </li>
                    ))}
                </ul>
              </>
            )}

            {/* IPA + Translations */}
            {piece && (piece.lyrics_ipa || piece.translations.length > 0) && (
              <>
                <SectionDivider
                  label={t(
                    "score_compiler.review.lyrics_section",
                    "Wymowa i tłumaczenia",
                  )}
                  icon={<Languages size={14} aria-hidden="true" />}
                />
                <div className="flex flex-col gap-4">
                  {piece.lyrics_ipa && (
                    <article className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4">
                      <Eyebrow color="muted" size="caption">
                        {t("score_compiler.review.ipa_label", "IPA · wymowa")}
                      </Eyebrow>
                      <pre className="mt-2 whitespace-pre-wrap font-serif text-[13px] leading-relaxed text-ethereal-ink">
                        {piece.lyrics_ipa}
                      </pre>
                    </article>
                  )}
                  {piece.translations.map((tr) => (
                    <article
                      key={tr.id}
                      className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4"
                    >
                      <div className="flex items-baseline justify-between">
                        <Eyebrow color="muted" size="caption">
                          {t(
                            "score_compiler.review.translation_label",
                            "Tłumaczenie · {{lang}}",
                            { lang: tr.target_language.toUpperCase() },
                          )}
                        </Eyebrow>
                        {tr.is_singable && (
                          <Caption color="muted">
                            {t(
                              "score_compiler.review.singable",
                              "śpiewalne",
                            )}
                          </Caption>
                        )}
                      </div>
                      <Text
                        size="sm"
                        className="mt-2 whitespace-pre-wrap leading-relaxed"
                      >
                        {tr.text}
                      </Text>
                    </article>
                  ))}
                </div>
              </>
            )}

            {/* Program note */}
            {piece && piece.program_notes.length > 0 && (
              <>
                <SectionDivider
                  label={t(
                    "score_compiler.review.program_note",
                    "Notka programowa",
                  )}
                  icon={<ScrollText size={14} aria-hidden="true" />}
                />
                {piece.program_notes.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4"
                  >
                    <div className="flex items-baseline justify-between">
                      <Eyebrow color="muted" size="caption">
                        {note.language.toUpperCase()} · {note.target_tone}
                      </Eyebrow>
                      {note.is_approved && (
                        <Caption color="muted">
                          {t(
                            "score_compiler.review.approved",
                            "zatwierdzona",
                          )}
                        </Caption>
                      )}
                    </div>
                    <Text
                      size="sm"
                      className="mt-2 whitespace-pre-wrap leading-relaxed"
                    >
                      {note.content}
                    </Text>
                  </article>
                ))}
              </>
            )}

            {/* Recordings */}
            {piece && piece.recordings.length > 0 && (
              <>
                <SectionDivider
                  label={t(
                    "score_compiler.review.recordings_count",
                    "Nagrania referencyjne ({{count}})",
                    { count: piece.recordings.length },
                  )}
                  icon={<Sparkles size={14} aria-hidden="true" />}
                />
                <ul role="list" className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {piece.recordings.map((rec) => (
                    <RecordingRow key={rec.id} recording={rec} />
                  ))}
                </ul>
              </>
            )}
          </form>
        )}
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ethereal-incense/15 bg-ethereal-alabaster/55 px-6 py-4 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            leftIcon={<RefreshCcw size={14} aria-hidden="true" />}
            onClick={() => setReingestPending(true)}
            disabled={busy || !edition}
            isLoading={isReingesting}
          >
            {t(
              "score_compiler.review.reingest_btn",
              "Uruchom pipeline ponownie",
            )}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("score_compiler.review.close_btn", "Zamknij")}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            form="conductor-review-form"
            variant="secondary"
            disabled={
              busy || (!isDirty && !requirementsDirty) || !edition
            }
            isLoading={isPatchingPiece || isPatchingEdition}
          >
            {t("score_compiler.review.save_btn", "Zapisz zmiany")}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={busy || !canApprove}
            isLoading={isApproving}
            leftIcon={<CheckCircle2 size={14} aria-hidden="true" />}
            title={approveDisabledReason}
          >
            {t("score_compiler.review.approve_btn", "Zatwierdź wydanie")}
          </Button>
        </div>
      </footer>

      <ConfirmModal
        isOpen={reingestPending}
        isDestructive={false}
        title={t(
          "score_compiler.reingest.title",
          "Uruchomić pipeline ponownie?",
        )}
        description={t(
          "score_compiler.reingest.description",
          "Powtórna ingestia naliczy nowe koszty wywołań Claude (do limitu {{cap}}¢ per wydanie) i wyzeruje licznik wydatków. Użyj, gdy zmieniłeś prompt lub pipeline padł z powodu chwilowego błędu sieci.",
          { cap: 200 },
        )}
        confirmText={t(
          "score_compiler.reingest.confirm",
          "Uruchom pipeline",
        )}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isLoading={isReingesting}
        onConfirm={confirmReingest}
        onCancel={() => setReingestPending(false)}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SectionDivider = ({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}): React.JSX.Element => (
  <div className="mb-3 mt-8 flex items-center gap-3">
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

interface ComposerCardProps {
  composer: ComposerSummaryDTO;
}

const ComposerCard = ({ composer }: ComposerCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const lifespan = [composer.birth_year, composer.death_year]
    .filter(Boolean)
    .join("–");
  // Wikimedia FilePath URLs can 404 (deleted/renamed files) or redirect
  // through a CORS-restricted host. Fall back to the placeholder on error
  // so a broken portrait never leaves an empty box in the review modal.
  const [portraitFailed, setPortraitFailed] = useState(false);
  const showPortrait = Boolean(composer.portrait_url) && !portraitFailed;

  return (
    <>
      <SectionDivider
        label={t(
          "score_compiler.review.composer_section",
          "Kompozytor (źródło: MusicBrainz + Wikidata)",
        )}
      />
      <div className="flex items-start gap-4 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4">
        {showPortrait ? (
          <img
            src={composer.portrait_url}
            alt={t(
              "score_compiler.review.portrait_alt",
              "Portret {{name}}",
              { name: composer.full_name },
            )}
            className="h-20 w-20 shrink-0 rounded-2xl border border-ethereal-incense/20 object-cover"
            loading="lazy"
            onError={() => setPortraitFailed(true)}
          />
        ) : (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-ethereal-incense/25 bg-ethereal-marble/60"
            aria-hidden="true"
          >
            <Sparkles size={22} className="text-ethereal-gold/60" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Heading as="h3" size="lg" weight="medium">
            {composer.full_name}
          </Heading>
          <Caption color="muted" className="block">
            {[lifespan, composer.nationality, composer.period]
              .filter(Boolean)
              .join(" · ")}
          </Caption>
          <div className="mt-2 flex flex-wrap gap-2">
            {composer.mbid && (
              <a
                href={`https://musicbrainz.org/artist/${composer.mbid}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-ethereal-incense/30 bg-ethereal-marble/60 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-ethereal-graphite transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-gold"
              >
                MusicBrainz
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
            {composer.wikidata_qid && (
              <a
                href={`https://www.wikidata.org/wiki/${composer.wikidata_qid}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-ethereal-incense/30 bg-ethereal-marble/60 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-ethereal-graphite transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-gold"
              >
                Wikidata
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const RecordingRow = ({
  recording,
}: {
  recording: RecordingDTO;
}): React.JSX.Element => (
  <li>
    <a
      href={recording.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 px-4 py-3 transition-colors hover:border-ethereal-gold/40 hover:bg-ethereal-parchment/40"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          recording.source === "SPF"
            ? "border-ethereal-sage/40 bg-ethereal-sage/10 text-ethereal-sage"
            : recording.source === "YTB"
              ? "border-ethereal-crimson/40 bg-ethereal-crimson/10 text-ethereal-crimson"
              : "border-ethereal-incense/30 bg-ethereal-marble/70 text-ethereal-graphite",
        )}
        aria-hidden="true"
      >
        <Sparkles size={14} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <Text size="sm" weight="semibold" truncate className="block">
          {recording.performer || recording.source_display}
        </Text>
        <Caption color="muted">
          {recording.source_display}
          {recording.year && ` · ${recording.year}`}
          {recording.is_featured && " · featured"}
        </Caption>
      </div>
      <ExternalLink
        size={14}
        className="text-ethereal-graphite/60"
        aria-hidden="true"
      />
    </a>
  </li>
);

// ---------------------------------------------------------------------------
// Form-helpers
// ---------------------------------------------------------------------------

/**
 * Pick only the form fields whose RHF `dirtyFields` flag is true, then trim
 * empty strings to undefined for optional text fields so the PATCH stays
 * minimal. Numeric coercion already happened in the Zod schema.
 */
function pickDirty<TKey extends string>(
  values: ReviewFormValues,
  dirty: Partial<Record<keyof ReviewFormValues, boolean | object>>,
  fields: readonly TKey[],
): Record<TKey, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (dirty[f as keyof ReviewFormValues]) {
      out[f] = values[f as keyof ReviewFormValues];
    }
  }
  return out as Record<TKey, unknown>;
}
