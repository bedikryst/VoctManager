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
  BookOpen,
  Check,
  ChevronRight,
  Disc3,
  FileText,
  Languages,
  Library,
  Music2,
  PenLine,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { applyFieldErrors, toastApiError } from "@/shared/api/errors";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { ComposerCard, WorkIdentifiersGrid } from "@/shared/ui/composites/repertoire";
import { cn } from "@/shared/lib/utils";
import { PdfViewer } from "@/shared/ui/composites/PdfViewer";
import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";
import { MaterialsService } from "@/features/materials/api/materials.service";
import { ScoreStandModal, useScoreAnnotator } from "@/features/annotations";
import { useVoiceLines } from "@/shared/api/options.queries";

import {
  useApproveEdition,
  useComposers,
  useCreateComposer,
  usePiece,
  usePieces,
  useUpdatePiece,
  useVerifyPieceField,
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
  pieceReviewProgress,
  type ReviewProgress,
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
        <Eyebrow color="graphite" size="base" className="flex-1">
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

/**
 * A titled sub-block inside a cockpit section. The gradient hairline beside the
 * title reads as a divider, so related fields cluster (Identity / Musical / Text)
 * instead of pooling into one undifferentiated stack — the layout controls its
 * own inner grid via `className`.
 */
const FieldGroup = ({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element => (
  <div className="space-y-3">
    <div className="flex items-center gap-2.5">
      <Eyebrow color="graphite" size="caption" className="shrink-0">
        {title}
      </Eyebrow>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-gradient-to-r from-ethereal-incense/25 to-transparent"
      />
    </div>
    <div className={className}>{children}</div>
  </div>
);

/** One entry in the review meter's legend: a tone dot + count. */
const LegendDot = ({
  toneClass,
  label,
}: {
  toneClass: string;
  label: string;
}): React.JSX.Element => (
  <span className="inline-flex items-center gap-1.5">
    <span
      aria-hidden="true"
      className={cn("h-2 w-2 rounded-full border", toneClass)}
    />
    <Text as="span" size="xs" color="muted">
      {label}
    </Text>
  </span>
);

/** The metadata fields that carry AI provenance and drive the review meter —
 *  exactly the set that renders a provenance chip below. */
const METADATA_PROVENANCE_FIELDS = [
  "title", "arranger", "opus_catalog", "musical_key", "language",
  "voicing", "epoch", "text_source", "lyrics_original", "lyrics_ipa",
] as const;

/**
 * Lifts the native <Select> from its faint incense/alabaster fill to the firmer
 * gold-on-marble treatment the <Input> already uses, so the two field primitives
 * read as siblings across this dense form. Page-scoped via `className` + twMerge
 * — the shared Select default is deliberately left untouched.
 */
const FIELD_SELECT_CLASS =
  "bg-ethereal-marble/90 border-ethereal-gold/35 hover:border-ethereal-gold/55 focus:border-ethereal-gold/70";

/**
 * Trust scoreboard for the metadata section: gives the per-field provenance dots
 * a job (a target to drive to zero) and a sense of closure the loose pills never
 * offered. Hidden entirely for manually-authored pieces (no provenance at all).
 * The bar animates via `scaleX` (transform-only), per the motion guidelines.
 */
const MetadataReviewMeter = ({
  progress,
  active,
}: {
  progress: ReviewProgress;
  active: boolean;
}): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (progress.total === 0) return null;

  // Calm state (piece already published, no edition awaiting review): a full
  // progress bar reading "Zweryfikowano 0 z 9 · 0%" nags about a review that
  // isn't happening. Say nothing when nothing's pending; otherwise a single
  // quiet amethyst line — no bar, no percentage, no legend.
  if (!active) {
    if (progress.pending === 0) return null;
    return (
      <div className="mb-5 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full border border-ethereal-amethyst/40 bg-ethereal-amethyst/15"
        />
        <Text as="span" size="sm" color="muted">
          {t(
            "archive.piece_card.review_remaining",
            "Do sprawdzenia pozostało: {{count}} pól",
            { count: progress.pending },
          )}
        </Text>
      </div>
    );
  }

  // Live review: keep the bar (it's the whole point), but drop the redundant
  // "%" — the "X z Y" line and the bar already carry the ratio.
  const ratio = progress.verified / progress.total;
  const allClear = progress.pending === 0;
  return (
    <div className="mb-5 rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/50 px-4 py-3">
      <div className="flex items-center gap-2">
        {allClear ? (
          <ShieldCheck
            size={14}
            className="text-ethereal-sage"
            aria-hidden="true"
          />
        ) : (
          <Sparkles
            size={14}
            className="text-ethereal-amethyst"
            aria-hidden="true"
          />
        )}
        <Text as="span" size="sm" weight="medium">
          {allClear
            ? t(
                "archive.piece_card.review_all_clear",
                "Wszystkie pola zweryfikowane",
              )
            : t(
                "archive.piece_card.review_progress",
                "Zweryfikowano {{verified}} z {{total}}",
                { verified: progress.verified, total: progress.total },
              )}
        </Text>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ethereal-incense/15">
        <div
          className="h-full origin-left rounded-full bg-ethereal-sage transition-transform duration-500"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      {progress.pending > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendDot
            toneClass="border-ethereal-amethyst/40 bg-ethereal-amethyst/15"
            label={t("archive.piece_card.legend_ai", "Do sprawdzenia: {{count}}", {
              count: progress.pending,
            })}
          />
          <LegendDot
            toneClass="border-ethereal-sage/45 bg-ethereal-sage/15"
            label={t(
              "archive.piece_card.legend_verified",
              "Zweryfikowane: {{count}}",
              { count: progress.verified },
            )}
          />
        </div>
      )}
    </div>
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
  const verifyField = useVerifyPieceField();

  const cardPath = (pieceId: string | number): string =>
    `/panel/archive-management/${pieceId}`;

  // Conductor markup, right in the main score preview. Archive is manager-only,
  // so editing is always on.
  const annotator = useScoreAnnotator({
    editionId: piece ? getPrimaryPdf(piece)?.id ?? null : null,
    mode: "conductor",
  });

  // Below lg the inline viewer letterboxes a tiny page under an overlapping
  // pager; there the score opens full-screen in the shared stand instead. Gated
  // by a media query (not just CSS) so the heavy inline PdfViewer never mounts
  // on phones.
  const isDesktopScore = useMediaQuery("(min-width: 1024px)");
  const [isScoreOpen, setIsScoreOpen] = useState(false);

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

  // Click-to-verify: stamp MANUAL provenance for a field the manager confirms is
  // already correct, without an edit (the chip flips AI → verified). `objectId`
  // targets a movement/translation; omit it for a field on the piece itself.
  const handleVerifyField = useCallback(
    (field: string, objectId?: string): void => {
      if (!piece) return;
      verifyField.mutate(
        { pieceId: String(piece.id), field, objectId },
        {
          onError: () =>
            toast.error(
              t(
                "archive.piece_card.verify_failed",
                "Nie udało się oznaczyć pola jako poprawne.",
              ),
            ),
        },
      );
    },
    [piece, verifyField, t],
  );

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

  // One unified dot everywhere (metadata + artifacts), each a click-to-verify
  // control for the AI fields — no more mix of loud pills and quiet dots.
  const reviewProgress = pieceReviewProgress(piece, METADATA_PROVENANCE_FIELDS);
  const fieldChip = (field: string): React.ReactNode => (
    <ProvenanceChip
      entry={pieceFieldProvenance(piece, field)}
      onVerify={() => handleVerifyField(field)}
      isVerifying={
        verifyField.isPending &&
        !verifyField.variables?.objectId &&
        verifyField.variables?.field === field
      }
    />
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
    // The shell's <main> is flex-1 inside a min-h-screen container, so a plain
    // flex-1/h-full here is NOT a definite height — the page grows to its own
    // content and the left score pane stretches to that whole length (a tiny
    // page floating over a tall black void). Bind to the viewport instead, minus
    // <main>'s own chrome: its vertical padding (~3rem) plus, on touch, the
    // mobile nav dock (--nav-dock-h, which is 0 on a fine pointer). Now only the
    // data panel scrolls and the score pane stays put — the MessagesPage dvh
    // pattern, made nav-dock-aware.
    <div className="flex h-[calc(100dvh-var(--nav-dock-h)-3rem)] flex-col gap-4 md:gap-5">
        {/* Header — floats above the panels; the gutter separates it, no hard
            full-bleed rule (the app has none anywhere else). */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
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

        {/* Body — two floating glass panels with a gutter between them (the
            canvas breathes through the seam instead of a hard 1px rule). */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-5">
          {/* Score preview — the elevated hero panel: rounded so the PDF's own
              corners round with it, resting on a soft glass shadow. */}
          <section
            className="relative shrink-0 overflow-hidden rounded-3xl border border-glass-border bg-glass-surface shadow-glass-ethereal lg:w-1/2"
            aria-label={t(
              "archive.piece_card.pdf_preview_aria",
              "Podgląd PDF partytury",
            )}
          >
            {primaryPdf ? (
              isDesktopScore ? (
                <div className="flex h-full flex-col">
                  {/* Slim filename bar. Download is intentionally NOT duplicated
                      here — the viewer's own toolbar owns it, over the gated blob
                      path, rather than this raw-file URL. */}
                  <div className="flex shrink-0 items-center gap-2 border-b border-ethereal-incense/10 bg-ethereal-alabaster/40 px-3 py-2">
                    <FileText
                      size={13}
                      className="shrink-0 text-ethereal-graphite/45"
                      aria-hidden="true"
                    />
                    <Caption color="muted" className="truncate">
                      {primaryPdf.label}
                      {primaryPdf.page_count
                        ? ` · ${t("archive.piece_card.page_count", { count: primaryPdf.page_count })}`
                        : ""}
                    </Caption>
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
                // Phone: an inline viewer only letterboxes a tiny page under an
                // overlapping pager, so open the full-screen stand from a compact
                // bar instead.
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst"
                      aria-hidden="true"
                    >
                      <FileText size={18} strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Text size="sm" weight="semibold" truncate className="block">
                        {primaryPdf.label}
                      </Text>
                      {primaryPdf.page_count ? (
                        <Caption color="muted" className="block">
                          {t("archive.piece_card.page_count", {
                            count: primaryPdf.page_count,
                          })}
                        </Caption>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full"
                    leftIcon={<BookOpen size={15} aria-hidden="true" />}
                    onClick={() => setIsScoreOpen(true)}
                  >
                    {t("archive.piece_card.open_score", "Otwórz partyturę")}
                  </Button>
                </div>
              )
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

          {/* Data panel — a scrolling column of glass section-cards on the
              canvas (matching every other panel page), not a boxed pane. */}
          <section
            className="flex min-h-0 flex-1 flex-col lg:w-1/2"
            aria-label={t(
              "archive.piece_card.form_panel_aria",
              "Dane utworu",
            )}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              <div className="space-y-4">
                {awaitingEdition && <AIHallucinationWarning piece={piece} />}

                {/* Metadata — the AI-extracted scalar fields with source chips */}
                <CockpitSection
                  label={t("archive.piece_card.section.metadata", "Metadane")}
                  icon={<Sparkles size={14} aria-hidden="true" />}
                  defaultOpen
                >
                  <MetadataReviewMeter
                    progress={reviewProgress}
                    active={Boolean(awaitingEdition)}
                  />
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
                    className="space-y-6"
                  >
                    <FieldGroup
                      title={t("archive.piece_card.group.identity", "Tożsamość")}
                      className="grid grid-cols-1 gap-3 md:grid-cols-2"
                    >
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
                          placeholder={t("archive.piece_card.ph_arranger", "np. opr. T. Kuras")}
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
                          placeholder={t("archive.piece_card.ph_opus", "np. BWV 243")}
                          error={errors.opus_catalog?.message}
                          {...register("opus_catalog")}
                        />
                      </LabeledField>
                    </FieldGroup>

                    <FieldGroup
                      title={t(
                        "archive.piece_card.group.musical",
                        "Charakterystyka muzyczna",
                      )}
                      className="grid grid-cols-1 gap-3 md:grid-cols-2"
                    >
                      <LabeledField
                        label={t("archive.piece_card.fields.key", "Tonacja")}
                        chip={fieldChip("musical_key")}
                      >
                        <Input
                          aria-label={t("archive.piece_card.fields.key", "Tonacja")}
                          placeholder={t("archive.piece_card.ph_key", "np. D-dur")}
                          error={errors.musical_key?.message}
                          {...register("musical_key")}
                        />
                      </LabeledField>
                      <LabeledField
                        label={t("archive.piece_card.fields.voicing", "Obsada")}
                        chip={fieldChip("voicing")}
                      >
                        <Input
                          aria-label={t("archive.piece_card.fields.voicing", "Obsada")}
                          placeholder={t("archive.piece_card.ph_voicing", "np. SATB")}
                          error={errors.voicing?.message}
                          {...register("voicing")}
                        />
                      </LabeledField>
                      <LabeledField
                        label={t("archive.piece_card.fields.language", "Język śpiewu")}
                        chip={fieldChip("language")}
                      >
                        <Select
                          aria-label={t("archive.piece_card.fields.language", "Język śpiewu")}
                          className={FIELD_SELECT_CLASS}
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
                        label={t("archive.piece_card.fields.epoch", "Epoka")}
                        chip={fieldChip("epoch")}
                      >
                        <Select
                          aria-label={t("archive.piece_card.fields.epoch", "Epoka")}
                          className={FIELD_SELECT_CLASS}
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
                      <LabeledField
                        label={t(
                          "archive.piece_card.fields.composition_year",
                          "Rok kompozycji",
                        )}
                      >
                        <div className="max-w-36">
                          <Input
                            aria-label={t(
                              "archive.piece_card.fields.composition_year",
                              "Rok kompozycji",
                            )}
                            type="number"
                            error={errors.composition_year?.message}
                            {...register("composition_year")}
                          />
                        </div>
                      </LabeledField>
                    </FieldGroup>

                    <FieldGroup
                      title={t("archive.piece_card.group.text", "Tekst")}
                      className="space-y-4"
                    >
                      <LabeledField
                        label={t("archive.piece_card.fields.text_source", "Źródło tekstu")}
                        chip={fieldChip("text_source")}
                      >
                        <Input
                          aria-label={t("archive.piece_card.fields.text_source", "Źródło tekstu")}
                          placeholder={t(
            "archive.piece_card.ph_text_source",
            "np. Magnificat (Łk 1,46-55)",
          )}
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
                    </FieldGroup>
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
                        <div className="w-20">
                          <Input
                            type="number"
                            min={0}
                            max={600}
                            placeholder={t("archive.piece_card.ph_min", "min")}
                            aria-label={t("archive.piece_card.duration_mins", "Minuty")}
                            error={errors.duration_mins?.message}
                            {...register("duration_mins")}
                          />
                        </div>
                        <Text
                          as="span"
                          aria-hidden="true"
                          className="text-ethereal-graphite/60"
                        >
                          :
                        </Text>
                        <div className="w-20">
                          <Input
                            type="number"
                            min={0}
                            max={59}
                            placeholder={t("archive.piece_card.ph_sec", "sek")}
                            aria-label={t("archive.piece_card.duration_secs", "Sekundy")}
                            error={errors.duration_secs?.message}
                            {...register("duration_secs")}
                          />
                        </div>
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

            {/* Action tray — a floating rounded bar (not a full-bleed rule),
                pinned below the scroll. Warms to gold while there are unsaved
                edits so the Save affordance reads at a glance. */}
            <footer
              className={cn(
                "mx-2 mb-1 mt-3 flex shrink-0 flex-wrap items-center justify-end gap-3 rounded-2xl border px-4 py-3 shadow-glass-ethereal",
                hasChanges
                  ? "border-ethereal-gold/40 bg-ethereal-gold/10"
                  : "border-glass-border bg-glass-surface",
              )}
            >
              {hasChanges ? (
                <Caption
                  color="gold"
                  className="mr-auto inline-flex items-center gap-1.5"
                >
                  <PenLine size={13} aria-hidden="true" />
                  {t("archive.piece_card.dirty_hint", "Masz niezapisane zmiany")}
                </Caption>
              ) : awaitingEdition ? (
                <Caption color="muted" className="mr-auto">
                  {t(
                    "archive.piece_card.approve_hint",
                    "Sprawdź pola powyżej, a następnie zatwierdź.",
                  )}
                </Caption>
              ) : (
                <Caption
                  color="sage"
                  className="mr-auto inline-flex items-center gap-1.5"
                >
                  <Check size={13} aria-hidden="true" />
                  {t("archive.piece_card.saved_state", "Wszystko zapisane")}
                </Caption>
              )}
              {/* Save appears only when there is something to save — no lonely
                  greyed-out CTA in the resting state. */}
              {hasChanges && (
                <Button
                  type="button"
                  onClick={onSubmit}
                  variant={awaitingEdition ? "outline" : "primary"}
                  disabled={isBusy}
                  isLoading={updatePiece.isPending}
                >
                  {t("archive.piece_card.save_btn", "Zapisz zmiany")}
                </Button>
              )}
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

        {/* Phone entry to the full-screen music stand (see the score section). */}
        <ScoreStandModal
          isOpen={isScoreOpen}
          editionId={primaryPdf?.id ?? null}
          mode="conductor"
          title={piece.title}
          subtitle={primaryPdf?.label}
          fileName={primaryPdf?.label}
          fetchBlob={
            primaryPdf
              ? () => MaterialsService.fetchScoreEditionBlob(primaryPdf.id)
              : null
          }
          canExport={primaryPdf?.canExport ?? true}
          onClose={() => setIsScoreOpen(false)}
        />
    </div>
  );
}
