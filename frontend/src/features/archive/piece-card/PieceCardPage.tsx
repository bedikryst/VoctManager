/**
 * @file PieceCardPage.tsx
 * @description The piece card as a document beside its score
 * (`docs/specs/piece-card-redesign-2026-11.md`). From 1024 px up the score
 * lies on a desk that runs under the rail, its pane as wide as the page needs
 * (`useScorePane`), and the record runs in a reading column on its right,
 * split from it by one hairline. Below that the screen is one column: a top
 * bar with the way back, the score as a row that opens the stand, and the
 * review action in a bottom bar above the nav dock.
 *
 * The header carries each state's actions: "Następne do przeglądu" while
 * another piece waits, "Zatwierdź i opublikuj" while an edition of this one
 * does. The title and individual record properties save when committed.
 *
 * Mounted at `/panel/archive-management/:id/next` with a bleed handle, so the
 * shell leaves the whole surface to it. Default export: lazily loaded by
 * App.tsx.
 * @module features/archive/piece-card/PieceCardPage
 */

import React, { useCallback, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CircleAlert, FileText } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { useBottomBarHeight, useBottomBarSlot } from "@/shared/lib/dom/useBottomBarSlot";
import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";
import { Portal } from "@/shared/lib/dom/Portal";
import { cn } from "@/shared/lib/utils";
import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import type { PdfPageApi } from "@/shared/ui/composites/PdfViewer";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { INGESTION_STATUS } from "@/shared/types";
import { ScoreStandModal, useScoreAnnotator } from "@/features/annotations";
import { MaterialsService } from "@/features/materials/api/materials.service";

import {
  useApproveEdition,
  usePiece,
  usePieces,
} from "../api/archive.queries";
import { pieceReviewBreakdown, type ReviewProgress as ReviewProgressCounts } from "../components/ProvenanceChip";
import { pieceCardSchema } from "../components/PieceMetadataForm";
import { getReviewPdf } from "../constants/piecePdfs";
import { CompactReviewProgress, ReviewProgress } from "./ReviewProgress";
import { usePieceFieldReview } from "./PieceFieldReview";
import { PieceProperties } from "./PieceProperties";
import { ScorePane } from "./ScorePane";
import { findNextAwaiting } from "./reviewQueue";
import { usePieceAutosave } from "./usePieceAutosave";
import { useScorePane } from "./useScorePane";

const LIBRARY_PATH = "/panel/archive-management";
const cardPath = (pieceId: string | number): string =>
  `${LIBRARY_PATH}/${pieceId}/next`;

/** Height of the phone's top bar, which the title has to clear to count as gone. */
const TOP_BAR_CLEARANCE = "-52px 0px 0px 0px";

interface PhoneReviewBarProps {
  readonly progress: ReviewProgressCounts;
  readonly isApproving: boolean;
  readonly onApprove: () => void;
}

/**
 * The review action on a phone, above the nav dock. It registers its height,
 * so the shell's feedback button rides above it instead of under it.
 */
const PhoneReviewBar = ({
  progress,
  isApproving,
  onApprove,
}: PhoneReviewBarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const slotRef = useBottomBarSlot();
  return (
    <Portal>
      <div
        ref={slotRef}
        role="region"
        aria-label={t("archive.piece_card.review_bar_aria", "Przegląd utworu")}
        className="fixed inset-x-3 bottom-dock z-dock-bar flex items-center gap-3 rounded-nested border border-hairline-strong bg-ethereal-marble py-2.5 pl-4 pr-2.5 shadow-glass-solid"
      >
        <CompactReviewProgress progress={progress} />
        <Button
          variant="primary"
          size="sm"
          casing="sentence"
          isLoading={isApproving}
          onClick={onApprove}
        >
          {t("archive.piece_card.approve_short", "Zatwierdź")}
        </Button>
      </div>
    </Portal>
  );
};

export default function PieceCardPage(): React.JSX.Element {
  const { id = "" } = useParams<{ id: string }>();
  return <PieceCard key={id} id={id} />;
}

const PieceCard = ({ id }: { id: string }): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isTwoPane = useMediaQuery("(min-width: 1024px)");

  const { data: piece, isLoading, isError, error } = usePiece(id);
  const { data: allPieces = [] } = usePieces();
  const autosave = usePieceAutosave(id);
  const titleId = useId();
  const titleLabel = t("archive.piece_card.edit_title", "Tytuł utworu");
  const titleDraft = autosave.track("title", titleLabel);
  const titleReview = usePieceFieldReview({ piece, field: "title", label: titleLabel, autosave });
  const approveEdition = useApproveEdition();
  const scorePane = useScorePane();
  const dockBarHeight = useBottomBarHeight();

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const fieldToFocus = useRef<string | null>(null);
  const [standPage, setStandPage] = useState<number | null>(null);

  const scorePdf = piece ? getReviewPdf(piece) : null;
  // Conductor markup on the desk. Idle on a phone, where the stand carries
  // its own annotator.
  const annotator = useScoreAnnotator({
    editionId: scorePdf?.id ?? null,
    mode: "conductor",
    active: isTwoPane,
  });
  const pageApi = useRef<PdfPageApi | null>(null);
  const updateAnnotatorPage = annotator.onPageApiChange;
  const handleScorePageApi = useCallback((api: PdfPageApi): void => {
    pageApi.current = api;
    updateAnnotatorPage(api);
  }, [updateAnnotatorPage]);
  const goToScorePage = (page: number): void => {
    if (isTwoPane) pageApi.current?.goToPage(page);
    else setStandPage(page);
  };

  // The phone's top bar names the piece once its title has scrolled under it.
  const [isTitleAway, setIsTitleAway] = useState(false);
  const titleObserverRef = useRef<IntersectionObserver | null>(null);
  const titleRef = useCallback((node: HTMLElement | null): void => {
    titleObserverRef.current?.disconnect();
    titleObserverRef.current = null;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setIsTitleAway(!entry.isIntersecting);
      },
      { rootMargin: TOP_BAR_CLEARANCE },
    );
    observer.observe(node);
    titleObserverRef.current = observer;
  }, []);

  if (isLoading || !piece) {
    if (isError) {
      return (
        <div className="mx-auto w-full max-w-xl px-4 py-10">
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
                <Link to={LIBRARY_PATH}>
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

  const pieceId = String(piece.id);
  const composer = piece.composer ?? null;
  const composerName = composer
    ? `${composer.first_name ?? ""} ${composer.last_name}`.trim()
    : "";
  const byline = [composerName, piece.composition_year]
    .filter((part) => part !== "" && part !== null && part !== undefined)
    .join(" · ");

  const nextAwaiting = findNextAwaiting(allPieces, pieceId);
  const awaitingEditions = (piece.editions ?? []).filter(
    (edition) => edition.ingestion_status === INGESTION_STATUS.AWAITING,
  );
  const awaitingEdition = awaitingEditions[0];
  const isReviewing = Boolean(awaitingEdition);
  const progress = pieceReviewBreakdown(piece).all;

  const goToNext = (): void => {
    if (nextAwaiting) navigate(cardPath(nextAwaiting.id));
  };

  const handleApprove = (): void => {
    if (!awaitingEdition) return;
    void autosave.afterFieldsSaved(null, async () => {
      await approveEdition.mutateAsync(String(awaitingEdition.id));
      setIsApproveOpen(false);
      toast.success(
        t(
          "archive.piece_card.approved",
          "Zatwierdzono — materiały są gotowe do udostępnienia.",
        ),
      );
      // A second awaiting edition keeps the piece in review.
      if (awaitingEditions.length > 1) return;
      navigate(nextAwaiting ? cardPath(nextAwaiting.id) : LIBRARY_PATH);
    }).catch((err: unknown) => {
      setIsApproveOpen(false);
      toastApiError(err, t, {
        fallbackDescription: t(
          "archive.piece_card.approve_failed",
          "Nie udało się zatwierdzić.",
        ),
      });
    });
  };

  const leaveApprovalForField = (fieldId: string): void => {
    fieldToFocus.current = fieldId;
    setIsApproveOpen(false);
  };

  const focusDraftField = (): void => {
    const fieldId = fieldToFocus.current;
    fieldToFocus.current = null;
    if (fieldId) requestAnimationFrame(() => document.getElementById(fieldId)?.focus());
  };

  const nextLabel = t("archive.piece_card.next_awaiting", "Następne do przeglądu");
  const backLabel = t("archive.piece_card.back", "Wróć do biblioteki");

  return (
    <div className="flex flex-col pb-nav-dock lg:h-[calc(100dvh-var(--nav-dock-h))] lg:flex-row lg:pb-0">
      {/* The desk runs under the floating rail to the window's edge, so the
          rail floats on it and the page centres in the room right of it. */}
      <div
        aria-hidden="true"
        className="hidden shrink-0 bg-score-desk transition-[width] duration-300 ease-out lg:fine-pointer:block lg:fine-pointer:w-[var(--sidebar-pad,var(--spacing-sidebar))]"
      />
      <div
        ref={isTwoPane ? scorePane.contentRef : undefined}
        className="flex min-w-0 flex-1 flex-col lg:flex-row"
      >
        {isTwoPane && (
          <section
            aria-label={t("archive.piece_card.pdf_preview_aria", "Podgląd PDF partytury")}
            className="relative shrink-0 bg-score-desk"
            style={{ width: scorePane.paneWidth ?? undefined }}
          >
            <ScorePane
              pieceId={pieceId}
              pieceTitle={piece.title}
              scorePdf={scorePdf}
              annotator={annotator}
              isWide={scorePane.isWide}
              onToggleWide={scorePane.toggleWide}
              onPageAspectChange={scorePane.onPageAspectChange}
              onPageApiChange={handleScorePageApi}
            />
          </section>
        )}

        <section
          aria-label={t("archive.piece_card.form_panel_aria", "Dane utworu")}
          className="min-w-0 flex-1 lg:overflow-y-auto lg:border-l lg:border-hairline-strong"
        >
          {!isTwoPane && (
            <div className="sticky top-0 z-20 flex h-13 items-center gap-1 border-b border-hairline bg-ethereal-alabaster px-1">
              <Button asChild variant="icon" size="icon" aria-label={backLabel} title={backLabel}>
                <Link to={LIBRARY_PATH}>
                  <ArrowLeft size={20} aria-hidden="true" />
                </Link>
              </Button>
              <Text
                as="span"
                size={null}
                weight="medium"
                truncate
                aria-hidden={!isTitleAway}
                className={cn(
                  "min-w-0 flex-1 font-serif text-xl transition-opacity duration-200",
                  isTitleAway ? "opacity-100" : "opacity-0",
                )}
              >
                {piece.title}
              </Text>
              {nextAwaiting && (
                <Button
                  variant="icon"
                  size="icon"
                  onClick={goToNext}
                  aria-label={nextLabel}
                  title={nextLabel}
                >
                  <ArrowRight size={20} aria-hidden="true" />
                </Button>
              )}
            </div>
          )}

          <div className="px-4 pb-16 lg:px-10">
            <header className="mx-auto w-full max-w-170 pb-6 pt-3 lg:pt-9">
              <div className="hidden min-h-10 items-center justify-between gap-4 lg:flex">
                <Link
                  to={LIBRARY_PATH}
                  className="inline-flex items-center gap-2 rounded-chip text-ethereal-graphite transition-colors hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
                >
                  <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
                  <Eyebrow color="inherit">
                    {t("archive.piece_card.back_btn", "Biblioteka")}
                  </Eyebrow>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {nextAwaiting && (
                    <Button
                      variant="ghost"
                      casing="sentence"
                      rightIcon={<ArrowRight size={16} aria-hidden="true" />}
                      onClick={goToNext}
                    >
                      {nextLabel}
                    </Button>
                  )}
                  {isReviewing && (
                    <Button
                      variant="primary"
                      casing="sentence"
                      isLoading={approveEdition.isPending}
                      onClick={() => setIsApproveOpen(true)}
                    >
                      {t("archive.piece_card.approve_btn", "Zatwierdź i opublikuj")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="relative mt-1.5 lg:mt-4.5">
                <div key={pieceId} className="pointer-events-none absolute -left-4 top-4 lg:-left-5 lg:top-5">
                  {titleReview.marker}
                </div>
                <Heading as="h1" size={null} ref={isTwoPane ? undefined : titleRef}>
                  <InlineEditable
                    key={pieceId}
                    id={titleId}
                    value={piece.title}
                    onSave={(next) => autosave.save("title", next)}
                    onDraftChange={(discard) => titleDraft.setDraft(titleDraft.key, discard ? {
                      id: titleId, label: titleLabel, discard,
                    } : null)}
                    validate={(next) => {
                      if (!next) return t("archive.piece_card.title_required", "Tytuł jest wymagany.");
                      return pieceCardSchema.shape.title.safeParse(next).success
                        ? null
                        : t("archive.piece_card.field_too_long");
                    }}
                    ariaLabel={titleLabel}
                    variant="headline"
                    className="text-4xl leading-tight lg:text-5xl"
                  />
                </Heading>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {byline && <Text as="p" size="md" color="graphite">{byline}</Text>}
                {titleReview.action}
                <AutosaveStatus
                  key={pieceId}
                  placement="inline"
                  isSaving={autosave.isSaving}
                  saveFailed={autosave.saveFailed}
                  className="ml-auto"
                />
              </div>
              {/* In review the phone states progress in its bottom bar. */}
              <div className={cn(isReviewing && "hidden lg:block")}>
                <ReviewProgress progress={progress} isReviewing={isReviewing} />
              </div>

              {!isTwoPane && scorePdf && (
                <div className="mt-4 flex items-center gap-3 border-y border-hairline py-3">
                  <FileText
                    size={18}
                    className="shrink-0 text-ethereal-graphite"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <Text as="p" size="base" weight="medium" truncate>
                      {scorePdf.label}
                    </Text>
                    {scorePdf.page_count ? (
                      <Text as="p" size="sm" color="graphite">
                        {t("archive.piece_card.page_count", { count: scorePdf.page_count })}
                      </Text>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    casing="sentence"
                    onClick={() => setStandPage(1)}
                  >
                    {t("archive.piece_card.open_score", "Otwórz partyturę")}
                  </Button>
                </div>
              )}
            </header>
            <div className="mx-auto w-full max-w-170">
              <PieceProperties
                key={pieceId}
                piece={piece}
                autosave={autosave}
                onGoToPage={scorePdf ? goToScorePage : undefined}
              />
            </div>
          </div>

          {/* Room for the phone's bottom bar, which floats over the column. */}
          {!isTwoPane && <div aria-hidden="true" style={{ height: dockBarHeight }} />}
        </section>
      </div>

      {!isTwoPane && isReviewing && (
        <PhoneReviewBar
          progress={progress}
          isApproving={approveEdition.isPending}
          onApprove={() => setIsApproveOpen(true)}
        />
      )}

      {/* Publishing shows the AI's work to the whole choir and notifies the
          projects that hold the piece, so it stops to say so. */}
      <ConfirmModal
        isOpen={isApproveOpen}
        title={t("archive.piece_card.approve_modal_title", "Zatwierdzić i opublikować?")}
        description={t(
          "archive.piece_card.approve_modal_desc",
          "Materiały staną się widoczne dla chóru, a uczestnicy projektów z tym utworem dostaną powiadomienie. Upewnij się, że pola oznaczone „do sprawdzenia” są zweryfikowane.",
        )}
        confirmText={t("archive.piece_card.approve_btn", "Zatwierdź i opublikuj")}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isLoading={approveEdition.isPending || autosave.isSaving}
        confirmDisabled={autosave.drafts.length > 0}
        onCancel={() => setIsApproveOpen(false)}
        onConfirm={handleApprove}
        onExitComplete={focusDraftField}
      >
        {autosave.drafts.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-3">
            <Text as="p" role="status" weight="medium">
              {t("archive.piece_card.approve_unresolved")}
            </Text>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {autosave.drafts.map((draft) => (
                <li key={draft.id} className="flex flex-wrap items-center justify-between gap-1">
                  <Button type="button" variant="ghost" size="sm" casing="sentence" disabled={autosave.isSaving}
                    onClick={draft.retry ?? (() => leaveApprovalForField(draft.id))}
                  >
                    {t(draft.retry ? "archive.piece_card.retry_draft" : "archive.piece_card.edit_draft", { field: draft.label })}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" casing="sentence" disabled={autosave.isSaving}
                    onClick={draft.discard}
                  >
                    {t("archive.piece_card.discard_draft", { field: draft.label })}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ConfirmModal>

      {!isTwoPane && (
        <ScoreStandModal
          isOpen={standPage !== null}
          initialPage={standPage ?? undefined}
          editionId={scorePdf?.id ?? null}
          mode="conductor"
          title={piece.title}
          subtitle={scorePdf?.label}
          fileName={scorePdf?.label}
          fetchBlob={
            scorePdf ? () => MaterialsService.fetchScoreEditionBlob(scorePdf.id) : null
          }
          canExport={scorePdf?.canExport ?? true}
          preferredFit={scorePdf?.wholePage ? "page" : undefined}
          onClose={() => setStandPage(null)}
        />
      )}
    </div>
  );
};
