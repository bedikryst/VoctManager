/**
 * @file ArchivePieceCardPage.tsx
 * @description The single canonical "Piece Card" — one cockpit that unifies
 * what used to be two overlapping screens (full metadata edit + AI verification).
 * Score with conductor annotations on the left, the piece's full editable data
 * on the right, in sections so a long record stays navigable.
 *
 * Verification is a STATE of this page, not a separate route: when the piece has
 * an AWAITING edition the right column grows the verification apparatus
 * ("Zatwierdź i opublikuj", "Następne do przeglądu", the review meter) and the
 * score takes half the width, because every field is read against it; otherwise
 * it is a plain editor whose primary action is "Zapisz", the score steps back to
 * a third, and the musical facts collapse to one editable line. A record spends
 * one session awaiting review and years published — the layout follows the state
 * rather than dressing for the rarer one. Editing any field flips its provenance
 * chip "AI · do sprawdzenia" → "Zweryfikowane" (the server stamps MANUAL
 * provenance for exactly the changed fields).
 *
 * Two save contracts meet here and the page has to hold both: the scalar form
 * defers to the footer, while each artifact row (movement, translation, note)
 * owns its own mutation. `usePieceDirty` is what keeps the second visible to the
 * first — without it the publish gate can only see half of what is unsaved.
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
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Disc3,
  ExternalLink,
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
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { ComposerCard } from "@/shared/ui/composites/repertoire";
import { cn } from "@/shared/lib/utils";
import { PdfViewer, type PdfPageApi } from "@/shared/ui/composites/PdfViewer";
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
import { DivisiSection } from "./components/DivisiSection";
import {
  ProvenanceChip,
  pieceFieldProvenance,
  pieceReviewBreakdown,
} from "./components/ProvenanceChip";
import { CockpitSection } from "./components/CockpitSection";
import { ReviewMeter } from "./components/ReviewMeter";
import {
  PieceMetadataForm,
  TEXT_FIELD_KEYS,
  pieceCardSchema,
  type PieceCardFormValues,
} from "./components/PieceMetadataForm";
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
import { PieceDirtyProvider, countDirty } from "./hooks/usePieceDirty";
import { getReviewPdf } from "./constants/piecePdfs";
import { INGESTION_STATUS, type Piece, type VoiceLine } from "@/shared/types";

// The arrangement is part of the identity: moving a line from the piece-wide
// layer into one edition changes nothing about its code or count, and without
// the edition in the key the card would call that save a no-op.
const reqKey = (r: VoiceRequirementDTO): string =>
  `${r.edition ?? ""}|${r.voice_line}:${r.quantity}`;
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
    editionId: piece ? getReviewPdf(piece)?.id ?? null : null,
    mode: "conductor",
  });

  // Below lg the inline viewer letterboxes a tiny page under an overlapping
  // pager; there the score opens full-screen in the shared stand instead. Gated
  // by a media query (not just CSS) so the heavy inline PdfViewer never mounts
  // on phones.
  const isDesktopScore = useMediaQuery("(min-width: 1024px)");
  const [isScoreOpen, setIsScoreOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);

  // How wide the score pane sits. `null` means "follow the record's state" — a
  // review reads the score against the fields and takes half the width, a
  // published record is opened for its data and gives that half back. The
  // override is what keeps the resting default from being a verdict: a manager
  // who came to READ the score widens it and the page stops guessing.
  const [scoreWideOverride, setScoreWideOverride] = useState<boolean | null>(
    null,
  );
  // "Następne do przeglądu" swaps the record under a mounted page, so an
  // override taken on one piece would otherwise decide the layout of the next.
  useEffect(() => {
    setScoreWideOverride(null);
  }, [id]);

  // Two consumers of one page handle: the annotator's index (jump to the page a
  // comment lives on) and this page's own movement anchors. `onPageApiChange`
  // is a single prop, so composing them is the only way to add the second
  // without silently unhooking the first. The handle lands in a ref, not state:
  // it is read on click, and re-rendering the whole cockpit on every page turn
  // of the PDF would be a re-render for nothing.
  const pageApiRef = useRef<PdfPageApi | null>(null);
  const annotatorPageApi = annotator.onPageApiChange;
  const handlePageApiChange = useCallback(
    (api: PdfPageApi): void => {
      pageApiRef.current = api;
      annotatorPageApi(api);
    },
    [annotatorPageApi],
  );
  const goToScorePage = useCallback((page: number): void => {
    pageApiRef.current?.goToPage(page);
  }, []);

  // The row editors below (movements, translations, program notes) hold their
  // own drafts behind their own save buttons, so the page can only learn about
  // an unsent correction by being told — see `usePieceDirty`.
  const [dirtyRows, setDirtyRows] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const registerDirty = useCallback((key: string, dirty: boolean): void => {
    setDirtyRows((prev) => {
      if (prev.has(key) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

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

  // The title has no input in the metadata form — it is edited in place at the
  // head of the card. Subscribed field-wise so a keystroke anywhere else in the
  // form does not re-render the heading.
  const titleValue = useWatch({ control: form.control, name: "title" });

  // ---- Composer + divisi side-state (not RHF fields) ---------------------
  const initialComposerId = piece?.composer?.id ?? "";
  const initialRequirements = useMemo<VoiceRequirementDTO[]>(
    () =>
      (piece?.voice_requirements_read ?? []).map((r) => ({
        voice_line: r.voice_line,
        quantity: r.quantity,
        edition: r.edition ?? null,
      })),
    [piece],
  );

  const [composerId, setComposerId] = useState("");
  const [isAddingComposer, setIsAddingComposer] = useState(false);
  const [composerDraft, setComposerDraft] =
    useState<InlineComposerDraft>(EMPTY_COMPOSER_DRAFT);
  const [requirements, setRequirements] = useState<VoiceRequirementDTO[]>([]);

  // Uniqueness is per LAYER: the same line may sit once piece-wide and once
  // inside an arrangement that overrides it — that is not a duplicate.
  const addRequirement = useCallback(
    (voiceLine: VoiceLine, editionId: string | null = null) => {
      setRequirements((prev) =>
        prev.some(
          (r) => r.voice_line === voiceLine && (r.edition ?? null) === editionId,
        )
          ? prev
          : [...prev, { voice_line: voiceLine, quantity: 1, edition: editionId }],
      );
    },
    [],
  );
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
  // What actually blocks publication. `hasChanges` alone left the approve button
  // live while a corrected translation sat unsent in its textarea — and the
  // footer announced "wszystko zapisane" over the top of it.
  const hasUnsavedRows = dirtyRows.size > 0;
  const hasUnsaved = hasChanges || hasUnsavedRows;

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

  // Not every field here has an error slot to fail into: the title and the five
  // musical facts are inline cells that render only their OWN validation. A
  // rejection landing on one of them is otherwise a save button that does
  // nothing and says nothing, so the submit itself has to speak.
  const reportInvalid = useCallback(
    (invalid: FieldErrors<PieceCardFormValues>): void => {
      const firstMessage = Object.values(invalid)
        .map((entry) =>
          entry && typeof entry === "object" && "message" in entry
            ? entry.message
            : undefined,
        )
        .find((message): message is string => typeof message === "string");
      toast.error(
        t(
          "archive.piece_card.toast_invalid",
          "Nie zapisano — popraw dane utworu.",
        ),
        firstMessage ? { description: firstMessage } : undefined,
      );
    },
    [t],
  );

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
  }, reportInvalid);

  // ---- Loading / error states -------------------------------------------
  if (isLoading || !piece) {
    if (isError) {
      return (
        <div className="mx-auto max-w-xl py-10">
          <StatePanel
            tone="danger"
            icon={<CircleAlert size={32} aria-hidden="true" />}
            title={t(
              "archive.piece_card.fetch_error",
              "Nie udało się pobrać szczegółów utworu",
            )}
            description={
              error instanceof Error
                ? error.message
                : t("archive.piece_card.fetch_unknown", "nieznany błąd")
            }
            actions={
              <Button
                asChild
                variant="outline"
                leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
              >
                <Link to="/panel/archive-management">
                  {t("archive.piece_card.back", "Wróć do biblioteki")}
                </Link>
              </Button>
            }
          />
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
  const scorePdf = getReviewPdf(piece);
  const composerName = composer
    ? `${composer.first_name ?? ""} ${composer.last_name}`.trim()
    : t("archive.piece_card.no_composer", "Brak kompozytora");

  const nextAwaiting = findNextAwaiting(allPieces, String(piece.id));
  const hasNext = nextAwaiting && String(nextAwaiting.id) !== String(piece.id);

  // The editions this review is verifying. Approve (AWAITING → READY) is the
  // terminal action and this footer is its ONLY door: the editions sub-list used
  // to carry a second Zatwierdź that skipped the unsaved-changes guard, so a
  // conductor could publish a record while their corrections sat unsent.
  const awaitingEditions = editions.filter(
    (e) => e.ingestion_status === INGESTION_STATUS.AWAITING,
  );
  const awaitingEdition = awaitingEditions[0];
  const isScoreWide = scoreWideOverride ?? Boolean(awaitingEdition);
  const scoreWidthLabel = isScoreWide
    ? t("archive.piece_card.score_narrow", "Zwęź podgląd partytury")
    : t("archive.piece_card.score_widen", "Poszerz podgląd partytury");

  // A movement anchor is only offered where there is a viewer to steer: below
  // lg the score lives in the full-screen stand, which this page does not open
  // at a page.
  const canAnchorScore = Boolean(scorePdf) && isDesktopScore;

  const handleApprove = (): void => {
    if (!awaitingEdition) return;
    approveEdition.mutate(String(awaitingEdition.id), {
      onSuccess: () => {
        setIsApproveOpen(false);
        toast.success(
          t(
            "archive.piece_card.approved",
            "Zatwierdzono — materiały są gotowe do udostępnienia.",
          ),
        );
        // A piece can hold more than one awaiting edition (a second upload of
        // the same work). Stay put so the next one keeps its footer instead of
        // being silently left behind.
        if (awaitingEditions.length > 1) return;
        if (hasNext && nextAwaiting) {
          navigate(cardPath(nextAwaiting.id));
        } else {
          navigate("/panel/archive-management");
        }
      },
      onError: (err) => {
        setIsApproveOpen(false);
        toastApiError(err, t, {
          fallbackDescription: t(
            "archive.piece_card.approve_failed",
            "Nie udało się zatwierdzić.",
          ),
        });
      },
    });
  };

  // One unified dot everywhere (metadata + artifacts), each a click-to-verify
  // control for the AI fields — no more mix of loud pills and quiet dots. The
  // breakdown feeds both the record-wide meter and each section's own backlog.
  const review = pieceReviewBreakdown(piece);
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
              {/* The record's identity is edited where it is stated — a second
                  input two lines below repeating the h1 was the title written
                  twice on one screen. `size={null}` leaves the landmark to the
                  h1 and the type to the control, whose `display` variant carries
                  the serif step the swap needs. The value comes from the form,
                  not the payload, so an unsaved rename shows what will be sent;
                  it lands in the same patch as the rest of the metadata. */}
              <Heading
                as="h1"
                size={null}
                className="flex min-w-0 items-center gap-2"
              >
                <InlineEditable
                  value={titleValue}
                  onSave={(next) =>
                    form.setValue("title", next, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  validate={(next) =>
                    next.trim().length > 0
                      ? null
                      : t(
                          "archive.piece_card.title_required",
                          "Tytuł jest wymagany.",
                        )
                  }
                  ariaLabel={t("archive.piece_card.edit_title", "Tytuł utworu")}
                  variant="display"
                />
                {fieldChip("title")}
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
            className={cn(
              "relative shrink-0 overflow-hidden rounded-surface border border-glass-border bg-glass-surface shadow-glass-ethereal",
              // Half the page is what a review needs — the score is read against
              // every field. Once the record is published nobody comes here to
              // read music, so the pane steps back to a third and the data takes
              // the room it was borrowing.
              isScoreWide ? "lg:w-1/2" : "lg:w-1/3",
            )}
            aria-label={t(
              "archive.piece_card.pdf_preview_aria",
              "Podgląd PDF partytury",
            )}
          >
            {scorePdf ? (
              isDesktopScore ? (
                <div className="flex h-full flex-col">
                  {/* Slim filename bar. Download is intentionally NOT duplicated
                      here — the viewer's own toolbar owns it, over the gated blob
                      path, rather than this raw-file URL. */}
                  <div className="flex shrink-0 items-center gap-2 border-b border-hairline bg-ethereal-alabaster/40 px-3 py-2">
                    <FileText
                      size={13}
                      className="shrink-0 text-ethereal-graphite/45"
                      aria-hidden="true"
                    />
                    <Caption color="muted" className="flex-1 truncate">
                      {scorePdf.label}
                      {scorePdf.page_count
                        ? ` · ${t("archive.piece_card.page_count", { count: scorePdf.page_count })}`
                        : ""}
                    </Caption>
                    <button
                      type="button"
                      onClick={() => setScoreWideOverride(!isScoreWide)}
                      aria-label={scoreWidthLabel}
                      title={scoreWidthLabel}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ethereal-graphite/55 transition-colors hover:bg-ethereal-gold/10 hover:text-ethereal-gold"
                    >
                      {isScoreWide ? (
                        <ChevronsLeft size={15} aria-hidden="true" />
                      ) : (
                        <ChevronsRight size={15} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <div className="min-h-0 flex-1">
                    <PdfViewer
                      fetchBlob={() =>
                        MaterialsService.fetchScoreEditionBlob(scorePdf.id)
                      }
                      docKey={scorePdf.id}
                      title={piece.title}
                      subtitle={scorePdf.label}
                      fileName={scorePdf.label}
                      toolbarSlot={annotator.toolbarSlot}
                      renderPageOverlay={annotator.renderPageOverlay}
                      overlaySlot={annotator.overlaySlot}
                      onPageApiChange={handlePageApiChange}
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
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst"
                      aria-hidden="true"
                    >
                      <FileText size={18} strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Text size="sm" weight="semibold" truncate className="block">
                        {scorePdf.label}
                      </Text>
                      {scorePdf.page_count ? (
                        <Caption color="muted" className="block">
                          {t("archive.piece_card.page_count", {
                            count: scorePdf.page_count,
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
              <div className="flex h-[40vh] flex-col items-center justify-center gap-2 p-6 lg:h-full">
                <StatePanel
                  variant="inline"
                  icon={<FileText size={32} aria-hidden="true" />}
                  title={t(
                    "archive.piece_card.no_pdf",
                    "Brak PDF dla tego utworu",
                  )}
                  description={t(
                    "archive.piece_card.no_pdf_hint",
                    "Wgraj partyturę poniżej — AI uzupełni metadane, IPA i tłumaczenia.",
                  )}
                />
                <div className="w-full max-w-md">
                  <EditionUploadZone pieceId={String(piece.id)} compact />
                </div>
              </div>
            )}
          </section>

          {/* Data panel — a scrolling column of glass section-cards on the
              canvas (matching every other panel page), not a boxed pane. It
              declares no width: `flex-1` zeroes the basis, so the column is
              whatever the score pane leaves — half, or two thirds at rest. */}
          <section
            className="flex min-h-0 flex-1 flex-col"
            aria-label={t(
              "archive.piece_card.form_panel_aria",
              "Dane utworu",
            )}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2">
              {/* Transparent in the DOM — the sections stay direct children of
                  the scroller. It only gives the row editors a way to report
                  their unsaved drafts back up here. */}
              <PieceDirtyProvider value={registerDirty}>
                {/* Bound to the contradiction, not to the review: a year that
                    predates its composer stays wrong after approval, and the
                    warning that only ran during the review was the one moment
                    it would ever be said. It renders nothing when the record
                    holds no contradiction. */}
                <AIHallucinationWarning
                  piece={piece}
                  isReviewing={Boolean(awaitingEdition)}
                />

                {/* The record-wide scoreboard sits above the sections it counts
                    — inside "Metadane" it read as that section's own tally. */}
                <ReviewMeter
                  progress={review.all}
                  active={Boolean(awaitingEdition)}
                />

                {/* Metadata — the AI-extracted scalar fields with source chips */}
                <CockpitSection
                  label={t("archive.piece_card.section.metadata", "Metadane")}
                  icon={<Sparkles size={14} aria-hidden="true" />}
                  pending={awaitingEdition ? review.metadata.pending : 0}
                  collapsible={false}
                >
                  <PieceMetadataForm
                    form={form}
                    onSubmit={onSubmit}
                    fieldChip={fieldChip}
                    isReviewing={Boolean(awaitingEdition)}
                  />
                </CockpitSection>

                {/* Details — the fields that used to live only on the full-edit
                    page: composer, duration, divisi, conductor notes. */}
                <CockpitSection
                  label={t("archive.piece_card.section.details", "Szczegóły utworu")}
                  icon={<SlidersHorizontal size={14} aria-hidden="true" />}
                  collapsible={false}
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
                      <Eyebrow color="muted" className="mb-1 block">
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
                    <DivisiSection
                      voiceLines={voiceLines}
                      requirements={requirements}
                      piece={piece}
                      addRequirement={addRequirement}
                      adjustRequirement={adjustRequirement}
                      removeRequirement={removeRequirement}
                      isBusy={isBusy}
                    />
                    <div>
                      <Eyebrow color="muted" className="mb-1 block">
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
                    {/* The work's canonical id, and the only identifier the
                        cockpit does not already edit above. It used to arrive
                        with three neighbours in a read-only "Identyfikatory"
                        card — opus, key and text source restated verbatim from
                        the inputs a screen higher, a leftover from when review
                        and edit were two separate screens. */}
                    {piece.mbid_work && (
                      <div>
                        <Eyebrow color="muted" className="mb-1 block">
                          {t("repertoire.identifiers.mbid", "MusicBrainz Work")}
                        </Eyebrow>
                        <a
                          href={`https://musicbrainz.org/work/${piece.mbid_work}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-ethereal-gold hover:underline"
                        >
                          {piece.mbid_work}
                          <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      </div>
                    )}
                  </div>
                </CockpitSection>

                <CockpitSection
                  label={t("archive.piece_card.editions_section", "Wydania nutowe")}
                  icon={<Library size={14} aria-hidden="true" />}
                  count={editions.length}
                  collapsible={false}
                >
                  <EditionsList editions={editions} />
                  <div className="mt-5 border-t border-hairline pt-5">
                    <EditionUploadZone pieceId={String(piece.id)} compact />
                  </div>
                </CockpitSection>

                {/* Movements and translations are the AI's most error-prone
                    output, so during a review they open with their own backlog
                    on the header rather than waiting behind a chevron. */}
                {movements.length > 0 && (
                  <CockpitSection
                    label={t("archive.piece_card.movements_section", "Części")}
                    icon={<Music2 size={14} aria-hidden="true" />}
                    count={movements.length}
                    pending={awaitingEdition ? review.movements.pending : 0}
                    dirty={countDirty(dirtyRows, "movement") > 0}
                    defaultOpen={Boolean(awaitingEdition) && review.movements.pending > 0}
                  >
                    <MovementsEditor
                      piece={piece}
                      onGoToPage={canAnchorScore ? goToScorePage : undefined}
                    />
                  </CockpitSection>
                )}

                {translations.length > 0 && (
                  <CockpitSection
                    label={t("archive.piece_card.translations_section", "Tłumaczenia")}
                    icon={<Languages size={14} aria-hidden="true" />}
                    count={translations.length}
                    pending={awaitingEdition ? review.translations.pending : 0}
                    dirty={countDirty(dirtyRows, "translation") > 0}
                    defaultOpen={
                      Boolean(awaitingEdition) && review.translations.pending > 0
                    }
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
                  dirty={countDirty(dirtyRows, "note") > 0}
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
              </PieceDirtyProvider>
            </div>

            {/* Action tray — a floating rounded bar (not a full-bleed rule),
                pinned below the scroll. It exists only while there is something
                to say: a permanent strip announcing "wszystko zapisane" on every
                visit reserves the loudest slot on the panel for the resting
                default, which is the one state that never needs stating. */}
            {(hasUnsaved || awaitingEdition) && (
              <footer
                className={cn(
                  "mx-2 mb-1 mt-3 flex shrink-0 flex-wrap items-center justify-end gap-3 rounded-nested border px-4 py-3 shadow-glass-ethereal",
                  hasUnsaved
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
                ) : hasUnsavedRows ? (
                  // Nothing here can save these — each row owns its own mutation
                  // — so the bar names where the work is instead of offering a
                  // button that would not reach it. The section headers carry the
                  // matching gold chip.
                  <Caption
                    color="gold"
                    className="mr-auto inline-flex items-center gap-1.5"
                  >
                    <PenLine size={13} aria-hidden="true" />
                    {t(
                      "archive.piece_card.dirty_rows_hint",
                      "Niezapisane zmiany w sekcjach powyżej — zapisz je w wierszach.",
                    )}
                  </Caption>
                ) : (
                  <Caption color="muted" className="mr-auto">
                    {t(
                      "archive.piece_card.approve_hint",
                      "Sprawdź pola powyżej, a następnie zatwierdź.",
                    )}
                  </Caption>
                )}
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
                    disabled={hasUnsaved || approveEdition.isPending}
                    isLoading={approveEdition.isPending}
                    onClick={() => setIsApproveOpen(true)}
                    title={
                      hasUnsaved
                        ? t("archive.piece_card.save_first", "Najpierw zapisz zmiany.")
                        : undefined
                    }
                  >
                    {t("archive.piece_card.approve_btn", "Zatwierdź i opublikuj")}
                  </Button>
                )}
              </footer>
            )}
          </section>
        </div>

        {/* Publishing is what makes the AI's work visible to the whole choir and
            fires their notifications — irreversible in effect, so it is the one
            action here that stops to say what it is about to do. */}
        <ConfirmModal
          isOpen={isApproveOpen}
          title={t(
            "archive.piece_card.approve_modal_title",
            "Zatwierdzić i opublikować?",
          )}
          description={t(
            "archive.piece_card.approve_modal_desc",
            "Materiały staną się widoczne dla chóru, a uczestnicy projektów z tym utworem dostaną powiadomienie. Upewnij się, że pola oznaczone „do sprawdzenia” są zweryfikowane.",
          )}
          confirmText={t("archive.piece_card.approve_btn", "Zatwierdź i opublikuj")}
          cancelText={t("common.actions.cancel", "Anuluj")}
          isLoading={approveEdition.isPending}
          onCancel={() => setIsApproveOpen(false)}
          onConfirm={handleApprove}
        />

        {/* Phone entry to the full-screen music stand (see the score section). */}
        <ScoreStandModal
          isOpen={isScoreOpen}
          editionId={scorePdf?.id ?? null}
          mode="conductor"
          title={piece.title}
          subtitle={scorePdf?.label}
          fileName={scorePdf?.label}
          fetchBlob={
            scorePdf
              ? () => MaterialsService.fetchScoreEditionBlob(scorePdf.id)
              : null
          }
          canExport={scorePdf?.canExport ?? true}
          onClose={() => setIsScoreOpen(false)}
        />
    </div>
  );
}
