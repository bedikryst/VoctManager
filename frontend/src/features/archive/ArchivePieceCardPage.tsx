/**
 * @file ArchivePieceCardPage.tsx
 * @description The single canonical "Piece Card" — one cockpit that unifies
 * what used to be two overlapping screens (full metadata edit + AI verification).
 * Score with conductor annotations on the left, the piece's full editable data
 * on the right, split into collapsible sections so a long record stays navigable.
 *
 * Verification is a STATE of this page, not a separate route: when the piece has
 * an AWAITING edition the right column grows the verification apparatus
 * (hallucination warning, "Zatwierdź i opublikuj", "Następne do przeglądu");
 * otherwise it is a plain editor whose primary action is "Zapisz". Editing any
 * field flips its provenance chip "AI · do sprawdzenia" → "Zweryfikowane" (the
 * server stamps MANUAL provenance for exactly the changed fields).
 *
 * Reachable at `/panel/archive-management/:id`; the legacy `/edit` and `/review`
 * routes redirect here. Default export: consumed by App.tsx via React.lazy.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/ArchivePieceCardPage
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Disc3,
  Download,
  FileText,
  Languages,
  Library,
  Music2,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { applyFieldErrors, toastApiError } from "@/shared/api/errors";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { ComposerCard, WorkIdentifiersGrid } from "@/shared/ui/composites/repertoire";
import { cn } from "@/shared/lib/utils";
import { PdfViewer } from "@/shared/ui/composites/PdfViewer";
import { MaterialsService } from "@/features/materials/api/materials.service";
import { useScoreAnnotator } from "@/features/annotations";
import { useVoiceLines } from "@/shared/api/options.queries";

import {
  useApproveEdition,
  useComposers,
  useCreateComposer,
  usePiece,
  usePieces,
  useUpdatePiece,
} from "./api/archive.queries";
import type { PiecePatchDTO, VoiceRequirementDTO } from "./types/archive.dto";
import { AIHallucinationWarning } from "./components/AIHallucinationWarning";
import { EditionsList } from "./components/EditionsList";
import { EditionUploadZone } from "./components/EditionUploadZone";
import { ComposerPicker } from "./components/ComposerPicker";
import { DivisiEditor } from "./components/DivisiEditor";
import {
  ProvenanceChip,
  pieceFieldProvenance,
} from "./components/ProvenanceChip";
import {
  MovementsEditor,
  ProgramNoteSection,
  RecordingsEditor,
  TranslationsEditor,
} from "./components/ReviewArtifactsEditors";
import {
  EMPTY_COMPOSER_DRAFT,
  type InlineComposerDraft,
} from "./hooks/usePieceFormState";
import { getArchiveEpochOptions } from "./constants/archiveEpochs";
import {
  getArchiveLanguageOptions,
  getLanguageLabel,
} from "./constants/archiveLanguages";
import { getPrimaryPdf } from "./constants/piecePdfs";
import { INGESTION_STATUS, type Piece, type VoiceLine } from "@/shared/types";

/**
 * Label + provenance chip header over a control. Mirrors the Input primitive's
 * own label styling so the chip can sit beside the label (the Input API has no
 * label-adornment slot). The wrapped control uses `aria-label`, not a second
 * visible label.
 */
const LabeledField = ({
  label,
  chip,
  children,
}: {
  label: string;
  chip?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element => (
  <div className="flex w-full flex-col gap-1.5">
    <div className="flex items-center gap-2">
      <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite antialiased">
        {label}
      </span>
      {chip}
    </div>
    {children}
  </div>
);

/**
 * A collapsible cockpit section. The row of collapsed headers doubles as the
 * section nav for the long right column. Only opacity/transform animate (the
 * chevron rotates, the body fades) — height is not animated, per the motion
 * guidelines.
 */
const CockpitSection = ({
  label,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        {icon && (
          <span className="text-ethereal-gold" aria-hidden="true">
            {icon}
          </span>
        )}
        <Eyebrow color="muted" size="caption" className="flex-1">
          {label}
        </Eyebrow>
        {typeof count === "number" && (
          <span className="rounded-full border border-ethereal-incense/25 bg-ethereal-alabaster/70 px-2 text-[10px] font-bold tabular-nums text-ethereal-graphite">
            {count}
          </span>
        )}
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-ethereal-graphite/50"
          aria-hidden="true"
        >
          <ChevronRight size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

const pieceCardSchema = z.object({
  title: z.string().min(1, "Tytuł jest wymagany").max(200),
  arranger: z.string().max(150).default(""),
  opus_catalog: z.string().max(40).default(""),
  musical_key: z.string().max(20).default(""),
  language: z.string().max(50).default(""),
  voicing: z.string().max(50).default(""),
  text_source: z.string().max(200).default(""),
  composition_year: z
    .union([z.coerce.number().int().min(500).max(2100), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  epoch: z.string().max(4).default(""),
  lyrics_original: z.string().default(""),
  lyrics_ipa: z.string().default(""),
  description: z.string().default(""),
  duration_mins: z
    .union([z.coerce.number().int().min(0).max(600), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : v)),
  duration_secs: z
    .union([z.coerce.number().int().min(0).max(59), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : v)),
});

type PieceCardFormValues = z.infer<typeof pieceCardSchema>;

/** Text fields whose backend column is `blank=True, null=False`: clearing one
 *  sends "" (a valid blank), never null (which DRF would reject). */
const TEXT_FIELD_KEYS: ReadonlySet<keyof PieceCardFormValues> = new Set([
  "title", "arranger", "opus_catalog", "musical_key", "language", "voicing",
  "text_source", "epoch", "lyrics_original", "lyrics_ipa", "description",
]);

const reqKey = (r: VoiceRequirementDTO): string => `${r.voice_line}:${r.quantity}`;
const sameRequirements = (
  a: VoiceRequirementDTO[],
  b: VoiceRequirementDTO[],
): boolean => {
  if (a.length !== b.length) return false;
  const setB = new Set(b.map(reqKey));
  return a.every((r) => setB.has(reqKey(r)));
};

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

export default function ArchivePieceCardPage(): React.JSX.Element {
  const { id = "" } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: piece, isLoading, isError, error } = usePiece(id);
  const { data: allPieces = [] } = usePieces();
  const { data: composers = [] } = useComposers();
  const { data: voiceLines = [] } = useVoiceLines();
  const updatePiece = useUpdatePiece();
  const createComposer = useCreateComposer();
  const approveEdition = useApproveEdition();

  const cardPath = (pieceId: string | number): string =>
    `/panel/archive-management/${pieceId}`;

  // Conductor markup, right in the main score preview. Archive is manager-only,
  // so editing is always on.
  const annotator = useScoreAnnotator({
    editionId: piece ? getPrimaryPdf(piece)?.id ?? null : null,
    mode: "conductor",
  });

  // ---- Scalar form (RHF) -------------------------------------------------
  const initial = useMemo<PieceCardFormValues>(() => {
    const totalSeconds = piece?.estimated_duration ?? 0;
    return {
      title: piece?.title ?? "",
      arranger: piece?.arranger ?? "",
      opus_catalog: piece?.opus_catalog ?? "",
      musical_key: piece?.musical_key ?? "",
      language: piece?.language ?? "",
      voicing: piece?.voicing ?? "",
      text_source: piece?.text_source ?? "",
      composition_year: piece?.composition_year ?? null,
      epoch: piece?.epoch ?? "",
      lyrics_original: piece?.lyrics_original ?? "",
      lyrics_ipa: piece?.lyrics_ipa ?? "",
      description: piece?.description ?? "",
      duration_mins: totalSeconds > 0 ? Math.floor(totalSeconds / 60) : 0,
      duration_secs: totalSeconds > 0 ? totalSeconds % 60 : 0,
    };
  }, [piece]);

  const form = useForm<PieceCardFormValues>({
    resolver: zodResolver(pieceCardSchema) as never,
    defaultValues: initial,
  });
  const {
    handleSubmit,
    register,
    formState: { errors, dirtyFields, isDirty },
    reset,
  } = form;

  // ---- Composer + divisi side-state (not RHF fields) ---------------------
  const initialComposerId = piece?.composer?.id ?? "";
  const initialRequirements = useMemo<VoiceRequirementDTO[]>(
    () =>
      (piece?.voice_requirements_read ?? []).map((r) => ({
        voice_line: r.voice_line,
        quantity: r.quantity,
      })),
    [piece],
  );

  const [composerId, setComposerId] = useState("");
  const [isAddingComposer, setIsAddingComposer] = useState(false);
  const [composerDraft, setComposerDraft] =
    useState<InlineComposerDraft>(EMPTY_COMPOSER_DRAFT);
  const [requirements, setRequirements] = useState<VoiceRequirementDTO[]>([]);

  const addRequirement = useCallback((voiceLine: VoiceLine) => {
    setRequirements((prev) =>
      prev.some((r) => r.voice_line === voiceLine)
        ? prev
        : [...prev, { voice_line: voiceLine, quantity: 1 }],
    );
  }, []);
  const adjustRequirement = useCallback((index: number, delta: number) => {
    setRequirements((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {
        ...next[index],
        quantity: Math.max(1, next[index].quantity + delta),
      };
      return next;
    });
  }, []);
  const removeRequirement = useCallback((index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const composerDirty = isAddingComposer || composerId !== initialComposerId;
  const requirementsDirty = useMemo(
    () => !sameRequirements(requirements, initialRequirements),
    [requirements, initialRequirements],
  );
  const hasChanges = isDirty || composerDirty || requirementsDirty;

  // Dirty-aware reconcile: pull server values into every input only when clean.
  const lastSyncedUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (!piece) return;
    const seen = lastSyncedUpdatedAt.current;
    const next = piece.updated_at ?? null;
    const firstLoad = seen === null;
    const serverAdvanced = seen !== null && seen !== next;
    if (firstLoad || (serverAdvanced && !hasChanges)) {
      reset(initial);
      setComposerId(initialComposerId);
      setRequirements(initialRequirements);
      setIsAddingComposer(false);
      setComposerDraft(EMPTY_COMPOSER_DRAFT);
      lastSyncedUpdatedAt.current = next;
    } else if (serverAdvanced) {
      lastSyncedUpdatedAt.current = next;
    }
  }, [piece, initial, hasChanges, reset, initialComposerId, initialRequirements]);

  const isBusy = updatePiece.isPending || createComposer.isPending;

  const onSubmit = handleSubmit(async (values) => {
    if (!piece) return;

    // Resolve composer FK (inline-create flow mirrors the new page).
    let resolvedComposerId: string | null = composerId || null;
    if (isAddingComposer) {
      const draft = {
        first_name: composerDraft.first_name.trim() || undefined,
        last_name: composerDraft.last_name.trim(),
        birth_year: composerDraft.birth_year.trim() || undefined,
        death_year: composerDraft.death_year.trim() || undefined,
      };
      if (!draft.last_name) {
        toast.error(
          t(
            "archive.piece_card.composer_required",
            "Nazwisko kompozytora jest wymagane.",
          ),
        );
        return;
      }
      try {
        const created = await createComposer.mutateAsync(draft);
        resolvedComposerId = created.id;
      } catch (err) {
        toastApiError(err, t, {
          fallbackDescription: t(
            "archive.piece_card.composer_error",
            "Nie udało się dodać kompozytora.",
          ),
        });
        return;
      }
    }

    const patch: PiecePatchDTO = {};
    for (const key of Object.keys(dirtyFields) as (keyof PieceCardFormValues)[]) {
      if (!dirtyFields[key]) continue;
      if (
        key === "duration_mins" ||
        key === "duration_secs" ||
        key === "composition_year"
      ) {
        continue; // handled explicitly below (nullable / composite)
      }
      if (TEXT_FIELD_KEYS.has(key)) {
        (patch as Record<string, unknown>)[key] = values[key] ?? "";
      }
    }
    if (dirtyFields.composition_year) {
      patch.composition_year = values.composition_year;
    }
    if (dirtyFields.duration_mins || dirtyFields.duration_secs) {
      const seconds = values.duration_mins * 60 + values.duration_secs;
      patch.estimated_duration = seconds > 0 ? seconds : null;
    }
    if (composerDirty) {
      patch.composer_id = resolvedComposerId;
    }
    if (requirementsDirty) {
      // Divisi rewrite is delete+recreate server-side — only send when changed.
      patch.voice_requirements = requirements;
    }

    if (Object.keys(patch).length === 0) {
      toast.info(t("archive.piece_card.toast_no_changes", "Nic do zapisania."));
      return;
    }

    try {
      await updatePiece.mutateAsync({ id: String(piece.id), data: patch });
      reset(values, { keepValues: true });
      // Re-baseline the side-state so its dirty flags clear at once (the detail
      // refetch confirms the same values).
      setComposerId(resolvedComposerId ?? "");
      setIsAddingComposer(false);
      setComposerDraft(EMPTY_COMPOSER_DRAFT);
      setRequirements(requirements);
      toast.success(
        t("archive.piece_card.toast_save_success", "Zapisano zmiany."),
      );
    } catch (err) {
      const normalized = toastApiError(err, t, {
        fallbackDescription: t(
          "archive.piece_card.toast_save_error",
          "Nie udało się zapisać zmian.",
        ),
      });
      applyFieldErrors(form.setError, normalized);
    }
  });

  // ---- Loading / error states -------------------------------------------
  if (isLoading || !piece) {
    if (isError) {
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <Text color="crimson">
            {t(
              "archive.piece_card.fetch_error",
              "Nie udało się pobrać szczegółów utworu:",
            )}{" "}
            {error instanceof Error
              ? error.message
              : t("archive.piece_card.fetch_unknown", "nieznany błąd")}
          </Text>
          <Button asChild variant="outline" size="sm" className="mt-6">
            <Link to="/panel/archive-management">
              {t("archive.piece_card.back", "Wróć do biblioteki")}
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
  const recordings = piece.recordings ?? [];
  const primaryPdf = getPrimaryPdf(piece);
  const composerName = composer
    ? `${composer.first_name ?? ""} ${composer.last_name}`.trim()
    : t("archive.piece_card.no_composer", "Brak kompozytora");

  const nextAwaiting = findNextAwaiting(allPieces, String(piece.id));
  const hasNext = nextAwaiting && String(nextAwaiting.id) !== String(piece.id);

  // The edition this review is verifying. Approve (AWAITING → READY) is the
  // terminal action — promoted out of the buried editions sub-list.
  const awaitingEdition = editions.find(
    (e) => e.ingestion_status === INGESTION_STATUS.AWAITING,
  );

  const handleApprove = (): void => {
    if (!awaitingEdition) return;
    approveEdition.mutate(String(awaitingEdition.id), {
      onSuccess: () => {
        toast.success(
          t(
            "archive.piece_card.approved",
            "Zatwierdzono — materiały są gotowe do udostępnienia.",
          ),
        );
        if (hasNext && nextAwaiting) {
          navigate(cardPath(nextAwaiting.id));
        } else {
          navigate("/panel/archive-management");
        }
      },
      onError: () =>
        toast.error(
          t("archive.piece_card.approve_failed", "Nie udało się zatwierdzić."),
        ),
    });
  };

  const fieldChip = (field: string): React.ReactNode => (
    <ProvenanceChip entry={pieceFieldProvenance(piece, field)} />
  );
  const epochOptions = getArchiveEpochOptions(t);
  // Localised language dropdown over the canonical ISO value; any non-plain
  // current value (e.g. the bilingual "pl+la") is kept selectable so it is never
  // silently dropped on edit.
  const languageOptions = getArchiveLanguageOptions(t);
  const languageValue = form.watch("language");
  const languageChoices =
    languageValue && !languageOptions.some((o) => o.value === languageValue)
      ? [
          { value: languageValue, label: getLanguageLabel(languageValue, t) },
          ...languageOptions,
        ]
      : languageOptions;

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
                {t("archive.piece_card.back_btn", "Biblioteka")}
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
          {hasNext && nextAwaiting && (
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight size={13} aria-hidden="true" />}
              onClick={() => navigate(cardPath(nextAwaiting.id))}
            >
              {t("archive.piece_card.next_awaiting", "Następne do przeglądu")}
            </Button>
          )}
        </header>

        {/* Body — split score preview / data */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Score preview */}
          <section
            className="relative shrink-0 border-b border-ethereal-incense/15 lg:w-1/2 lg:border-b-0 lg:border-r"
            aria-label={t(
              "archive.piece_card.pdf_preview_aria",
              "Podgląd PDF partytury",
            )}
          >
            {primaryPdf ? (
              <div className="flex h-[50vh] flex-col lg:h-full">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ethereal-incense/10 bg-ethereal-alabaster/40 px-3 py-2">
                  <Caption color="muted" className="truncate">
                    {primaryPdf.label}
                    {primaryPdf.page_count
                      ? ` · ${t("archive.piece_card.page_count", { count: primaryPdf.page_count })}`
                      : ""}
                  </Caption>
                  {/* Secondary: annotations are the default (in-app); the raw
                      file stays reachable as a download. */}
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    leftIcon={<Download size={13} aria-hidden="true" />}
                  >
                    <a href={primaryPdf.url} target="_blank" rel="noreferrer">
                      {t("archive.piece_card.pdf_download", "Pobierz")}
                    </a>
                  </Button>
                </div>
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
                    overlaySlot={annotator.overlaySlot}
                    onPageApiChange={annotator.onPageApiChange}
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
                    "archive.piece_card.no_pdf",
                    "Brak PDF dla tego utworu. Wgraj plik poniżej.",
                  )}
                </Text>
                <div className="w-full max-w-md">
                  <EditionUploadZone pieceId={String(piece.id)} compact />
                </div>
              </div>
            )}
          </section>

          {/* Data panel */}
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden lg:w-1/2"
            aria-label={t(
              "archive.piece_card.form_panel_aria",
              "Dane utworu",
            )}
          >
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
              <div className="space-y-4">
                {awaitingEdition && <AIHallucinationWarning piece={piece} />}

                {/* Metadata — the AI-extracted scalar fields with source chips */}
                <CockpitSection
                  label={t("archive.piece_card.section.metadata", "Metadane")}
                  icon={<Sparkles size={14} aria-hidden="true" />}
                  defaultOpen
                >
                  {awaitingEdition && (
                    <Text size="xs" color="graphite" className="mb-4 block">
                      {t(
                        "archive.piece_card.fields_hint",
                        "Sprawdź każde pole z podglądem PDF po lewej. Edytuj jeśli AI źle odczytał.",
                      )}
                    </Text>
                  )}
                  <form
                    id="piece-card-form"
                    onSubmit={onSubmit}
                    noValidate
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <LabeledField
                        label={t("archive.piece_card.fields.title", "Tytuł")}
                        chip={fieldChip("title")}
                      >
                        <Input
                          aria-label={t("archive.piece_card.fields.title", "Tytuł")}
                          error={errors.title?.message}
                          {...register("title")}
                        />
                      </LabeledField>
                      <LabeledField
                        label={t(
                          "archive.piece_card.fields.arranger",
                          "Opracowanie / aranżacja",
                        )}
                        chip={fieldChip("arranger")}
                      >
                        <Input
                          aria-label={t(
                            "archive.piece_card.fields.arranger",
                            "Opracowanie / aranżacja",
                          )}
                          placeholder="np. opr. T. Kuras"
                          error={errors.arranger?.message}
                          {...register("arranger")}
                        />
                      </LabeledField>
                      <LabeledField
                        label={t("archive.piece_card.fields.opus", "Opus / Katalog")}
                        chip={fieldChip("opus_catalog")}
                      >
                        <Input
                          aria-label={t("archive.piece_card.fields.opus", "Opus / Katalog")}
                          placeholder="np. BWV 243"
                          error={errors.opus_catalog?.message}
                          {...register("opus_catalog")}
                        />
                      </LabeledField>
                      <LabeledField
                        label={t("archive.piece_card.fields.key", "Tonacja")}
                        chip={fieldChip("musical_key")}
                      >
                        <Input
                          aria-label={t("archive.piece_card.fields.key", "Tonacja")}
                          placeholder="np. D-dur"
                          error={errors.musical_key?.message}
                          {...register("musical_key")}
                        />
                      </LabeledField>
                      <LabeledField
                        label={t("archive.piece_card.fields.language", "Język śpiewu")}
                        chip={fieldChip("language")}
                      >
                        <Select
                          aria-label={t("archive.piece_card.fields.language", "Język śpiewu")}
                          {...register("language")}
                        >
                          <option value="">
                            {t("archive.piece_card.language_pick", "— wybierz —")}
                          </option>
                          {languageChoices.map((lang) => (
                            <option key={lang.value} value={lang.value}>
                              {lang.label}
                            </option>
                          ))}
                        </Select>
                      </LabeledField>
                      <LabeledField
                        label={t("archive.piece_card.fields.voicing", "Obsada")}
                        chip={fieldChip("voicing")}
                      >
                        <Input
                          aria-label={t("archive.piece_card.fields.voicing", "Obsada")}
                          placeholder="np. SATB"
                          error={errors.voicing?.message}
                          {...register("voicing")}
                        />
                      </LabeledField>
                      <LabeledField
                        label={t(
                          "archive.piece_card.fields.composition_year",
                          "Rok kompozycji",
                        )}
                      >
                        <Input
                          aria-label={t(
                            "archive.piece_card.fields.composition_year",
                            "Rok kompozycji",
                          )}
                          type="number"
                          error={errors.composition_year?.message}
                          {...register("composition_year")}
                        />
                      </LabeledField>
                      <LabeledField
                        label={t("archive.piece_card.fields.epoch", "Epoka")}
                        chip={fieldChip("epoch")}
                      >
                        <Select
                          aria-label={t("archive.piece_card.fields.epoch", "Epoka")}
                          {...register("epoch")}
                        >
                          <option value="">
                            {t("archive.piece_card.epoch_pick", "— wybierz —")}
                          </option>
                          {epochOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </LabeledField>
                    </div>
                    <LabeledField
                      label={t("archive.piece_card.fields.text_source", "Źródło tekstu")}
                      chip={fieldChip("text_source")}
                    >
                      <Input
                        aria-label={t("archive.piece_card.fields.text_source", "Źródło tekstu")}
                        placeholder="np. Magnificat (Łk 1,46-55)"
                        error={errors.text_source?.message}
                        {...register("text_source")}
                      />
                    </LabeledField>
                    <LabeledField
                      label={t(
                        "archive.piece_card.fields.lyrics_original",
                        "Tekst oryginalny",
                      )}
                      chip={fieldChip("lyrics_original")}
                    >
                      <Textarea
                        aria-label={t(
                          "archive.piece_card.fields.lyrics_original",
                          "Tekst oryginalny",
                        )}
                        rows={4}
                        error={errors.lyrics_original?.message}
                        {...register("lyrics_original")}
                      />
                    </LabeledField>
                    <LabeledField
                      label={t("archive.piece_card.fields.lyrics_ipa", "Transkrypcja IPA")}
                      chip={fieldChip("lyrics_ipa")}
                    >
                      <Textarea
                        aria-label={t(
                          "archive.piece_card.fields.lyrics_ipa",
                          "Transkrypcja IPA",
                        )}
                        rows={3}
                        error={errors.lyrics_ipa?.message}
                        {...register("lyrics_ipa")}
                      />
                    </LabeledField>
                  </form>
                </CockpitSection>

                {/* Details — the fields that used to live only on the full-edit
                    page: composer, duration, divisi, conductor notes. */}
                <CockpitSection
                  label={t("archive.piece_card.section.details", "Szczegóły utworu")}
                  icon={<SlidersHorizontal size={14} aria-hidden="true" />}
                  defaultOpen
                >
                  <div className="space-y-5">
                    <ComposerPicker
                      composers={composers}
                      composerId={composerId}
                      setComposerId={setComposerId}
                      isAddingComposer={isAddingComposer}
                      setIsAddingComposer={setIsAddingComposer}
                      composerDraft={composerDraft}
                      setComposerDraft={setComposerDraft}
                      isBusy={isBusy}
                    />
                    {composer && !isAddingComposer && (
                      <ComposerCard composer={composer} bare />
                    )}
                    <div>
                      <Eyebrow color="muted" size="caption" className="mb-1 block">
                        {t("archive.piece_card.fields.duration", "Czas trwania")}
                      </Eyebrow>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={600}
                          placeholder="min"
                          aria-label={t("archive.piece_card.duration_mins", "Minuty")}
                          error={errors.duration_mins?.message}
                          {...register("duration_mins")}
                        />
                        <Text
                          as="span"
                          aria-hidden="true"
                          className="text-ethereal-graphite/60"
                        >
                          :
                        </Text>
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          placeholder="sek"
                          aria-label={t("archive.piece_card.duration_secs", "Sekundy")}
                          error={errors.duration_secs?.message}
                          {...register("duration_secs")}
                        />
                      </div>
                    </div>
                    <DivisiEditor
                      voiceLines={voiceLines}
                      requirements={requirements}
                      addRequirement={addRequirement}
                      adjustRequirement={adjustRequirement}
                      removeRequirement={removeRequirement}
                      isBusy={isBusy}
                    />
                    <div>
                      <Eyebrow color="muted" size="caption" className="mb-1 block">
                        {t(
                          "archive.piece_card.fields.description",
                          "Notatki dyrygenta (wewnętrzne)",
                        )}
                      </Eyebrow>
                      <Textarea
                        aria-label={t(
                          "archive.piece_card.fields.description",
                          "Notatki dyrygenta (wewnętrzne)",
                        )}
                        rows={3}
                        placeholder={t(
                          "archive.piece_card.description_placeholder",
                          "Cokolwiek warto pamiętać o tym utworze.",
                        )}
                        error={errors.description?.message}
                        {...register("description")}
                      />
                    </div>
                  </div>
                </CockpitSection>

                {(piece.opus_catalog ||
                  piece.musical_key ||
                  piece.text_source ||
                  piece.mbid_work) && (
                  <CockpitSection
                    label={t(
                      "archive.piece_card.identifiers_section",
                      "Identyfikatory utworu",
                    )}
                  >
                    <WorkIdentifiersGrid
                      opus_catalog={piece.opus_catalog}
                      musical_key={piece.musical_key}
                      text_source={piece.text_source}
                      mbid_work={piece.mbid_work}
                    />
                  </CockpitSection>
                )}

                <CockpitSection
                  label={t("archive.piece_card.editions_section", "Wydania nutowe")}
                  icon={<Library size={14} aria-hidden="true" />}
                  count={editions.length}
                  defaultOpen
                >
                  <EditionsList editions={editions} />
                  <div className="mt-5 border-t border-ethereal-incense/15 pt-5">
                    <Caption color="muted" className="mb-2 block">
                      {t(
                        "archive.piece_card.add_edition_hint",
                        "Dodaj kolejne wydanie (Bärenreiter, IMSLP, własna aranżacja)",
                      )}
                    </Caption>
                    <EditionUploadZone pieceId={String(piece.id)} compact />
                  </div>
                </CockpitSection>

                {movements.length > 0 && (
                  <CockpitSection
                    label={t("archive.piece_card.movements_section", "Części")}
                    icon={<Music2 size={14} aria-hidden="true" />}
                    count={movements.length}
                  >
                    <MovementsEditor piece={piece} />
                  </CockpitSection>
                )}

                {translations.length > 0 && (
                  <CockpitSection
                    label={t("archive.piece_card.translations_section", "Tłumaczenia")}
                    icon={<Languages size={14} aria-hidden="true" />}
                    count={translations.length}
                  >
                    <TranslationsEditor piece={piece} />
                  </CockpitSection>
                )}

                <CockpitSection
                  label={t(
                    "archive.piece_card.program_note_section",
                    "Notka programowa",
                  )}
                  icon={<ScrollText size={14} aria-hidden="true" />}
                >
                  <ProgramNoteSection piece={piece} />
                </CockpitSection>

                {recordings.length > 0 && (
                  <CockpitSection
                    label={t(
                      "archive.piece_card.recordings_section",
                      "Nagrania referencyjne",
                    )}
                    icon={<Disc3 size={14} aria-hidden="true" />}
                    count={recordings.length}
                  >
                    <RecordingsEditor piece={piece} />
                  </CockpitSection>
                )}
              </div>
            </div>

            {/* Sticky action bar */}
            <footer
              className={cn(
                "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ethereal-incense/15 bg-ethereal-alabaster/55 px-4 py-3 md:px-6",
                hasChanges && "border-t-ethereal-gold/40 bg-ethereal-gold/5",
              )}
            >
              {hasChanges ? (
                <Caption color="gold" className="mr-auto">
                  {t("archive.piece_card.dirty_hint", "Masz niezapisane zmiany")}
                </Caption>
              ) : awaitingEdition ? (
                <Caption color="muted" className="mr-auto">
                  {t(
                    "archive.piece_card.approve_hint",
                    "Sprawdź pola powyżej, a następnie zatwierdź.",
                  )}
                </Caption>
              ) : null}
              <Button
                type="button"
                onClick={onSubmit}
                variant={awaitingEdition ? "outline" : "primary"}
                disabled={!hasChanges || isBusy}
                isLoading={updatePiece.isPending}
              >
                {t("archive.piece_card.save_btn", "Zapisz zmiany")}
              </Button>
              {awaitingEdition && (
                <Button
                  type="button"
                  variant="primary"
                  leftIcon={<ShieldCheck size={15} aria-hidden="true" />}
                  disabled={hasChanges || approveEdition.isPending}
                  isLoading={approveEdition.isPending}
                  onClick={handleApprove}
                  title={
                    hasChanges
                      ? t("archive.piece_card.save_first", "Najpierw zapisz zmiany.")
                      : undefined
                  }
                >
                  {t("archive.piece_card.approve_btn", "Zatwierdź i opublikuj")}
                </Button>
              )}
            </footer>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
