/**
 * @file PieceCardPage.tsx
 * @description The piece card as a document beside its score
 * (`docs/specs/piece-card-redesign-2026-11.md`). From 1024 px up the score
 * lies on a desk that runs under the rail, its pane as wide as the page needs
 * (`useScorePane`), and the record runs in a reading column on its right,
 * split from it by one hairline. Below that the screen is one column: a top
 * bar with the way back, the score as a row that opens the stand, and the
 * review action in a bar that sits on the nav dock as one surface with it.
 *
 * The header carries the way back, the step to the previous and next piece
 * (`PieceNav`), and "Zatwierdź i opublikuj" while an edition of this one awaits
 * review. The steps walk the list named in the URL (`libraryScope.ts`): the
 * library rows the card was opened from, or the review queue, which is also
 * what a piece in review walks when opened from anywhere else. The way back
 * returns to the library under the filters it had. The title and individual
 * record properties save when committed; a write in flight outlives the step
 * to another piece, since the save queue is module-wide.
 *
 * Under the header a section index sticks to the top of the record and lights
 * the section in view; in review it counts each section's unchecked fields.
 * Once the header has scrolled away it holds the publish action in review and
 * the steps otherwise. The review runs from the keyboard as well
 * (`reviewFocus.ts`). Publishing always asks first. While fields are unchecked
 * the dialog's main action is to show the first of them, and publishing anyway
 * is the quieter choice. Once published, the card moves on to the next piece
 * of the list it walks.
 *
 * The desk shows the edition under review, or the primary one, until the
 * edition list or a movement's page link asks for another. A PDF dragged over
 * the page lands on a drop target over the record pane and joins the list.
 *
 * Mounted at `/panel/archive-management/:id` with a bleed handle, so the shell
 * leaves the whole surface to it. Default export: lazily loaded by App.tsx.
 * @module features/archive/piece-card/PieceCardPage
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, CircleAlert, FileText, UploadCloud } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { useBottomBarHeight, useBottomBarSlot } from "@/shared/lib/dom/useBottomBarSlot";
import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";
import { useScrollSpy } from "@/shared/lib/dom/useScrollSpy";
import { Portal } from "@/shared/lib/dom/Portal";
import { cn } from "@/shared/lib/utils";
import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { SectionIndex, type SectionIndexItem } from "@/shared/ui/composites/SectionIndex";
import type { PdfPageApi } from "@/shared/ui/composites/PdfViewer";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { INGESTION_STATUS, type Piece } from "@/shared/types";
import { ScoreStandModal, useScoreAnnotator } from "@/features/annotations";
import { MaterialsService } from "@/features/materials/api/materials.service";

import {
  useApproveEdition,
  usePiece,
  usePieces,
} from "../api/archive.queries";
import { pieceReviewBreakdown, type ReviewProgress as ReviewProgressCounts } from "../constants/pieceProvenance";
import { pieceFieldSchema } from "./pieceFieldSchema";
import { DEFAULT_LATIN_PRONUNCIATION } from "../constants/latinPronunciation";
import {
  EMPTY_LIBRARY_FILTERS,
  libraryPath,
  libraryReturnState,
  pieceCardPath,
  readCardScope,
  type CardList,
} from "../constants/libraryScope";
import { getPiecePdfLinks, getReviewPdf } from "../constants/piecePdfs";
import { SCORE_DROP_OPTIONS, useEditionUploads } from "../hooks/useEditionUploads";
import { CompactReviewProgress, ReviewBar, ReviewProgress, useReviewSentence } from "./ReviewProgress";
import { PieceEditions, uploadAsksPronunciation, type EditionDesk } from "./PieceEditions";
import { usePieceFieldReview } from "./PieceFieldReview";
import { PieceNav } from "./PieceNav";
import { PieceProperties, recordSections } from "./PieceProperties";
import { ScorePane } from "./ScorePane";
import { pieceSequence } from "./pieceSequence";
import { focusFirstUnchecked, useReviewKeys } from "./reviewFocus";
import { findNextAwaiting } from "./reviewQueue";
import { usePieceAutosave } from "./usePieceAutosave";
import { useScorePane } from "./useScorePane";

/** Height of the phone's top bar, which the title has to clear to count as gone. */
const TOP_BAR_CLEARANCE = "-52px 0px 0px 0px";
/**
 * Height of the sticky section index on a desktop, which the header has to
 * clear: as tall as the viewer's band across the hairline, plus its own rule.
 */
const INDEX_CLEARANCE = "-57px 0px 0px 0px";
/**
 * Where a section becomes current: just below the sticky bars, and level with
 * the section scroll margins (`scroll-mt-16`, `scroll-mt-28`), so a section the
 * index scrolled to is the one it lights.
 */
const SPY_LINE_DESKTOP_PX = 64;
const SPY_LINE_PHONE_PX = 112;

/**
 * Whether an element has scrolled under a sticky bar, watched by an
 * IntersectionObserver over `root` (null for the viewport).
 */
const useScrolledAway = (
  root: Element | null,
  rootMargin: string,
  isActive: boolean,
): [(node: HTMLElement | null) => void, boolean] => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [isAway, setIsAway] = useState(false);
  useEffect(() => {
    if (!node || !isActive || typeof IntersectionObserver === "undefined") {
      setIsAway(false);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setIsAway(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) + 1);
      },
      { root, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, root, rootMargin, isActive]);
  return [setNode, isAway];
};

/** An edition asked onto the screen, and the page it opens at. */
interface ShownEdition {
  readonly editionId: string;
  readonly page: number;
}

/**
 * Lets a drag reach the page's drop target only when it carries files and
 * starts over the page itself. The drop target cancels the browser's default
 * on every drag it sees, which would keep text from being dragged within a
 * field; and React bubbles events out of portals, so a file let go over an
 * open dialog would become an edition. Such a file is refused outright, since
 * once stopped here the document's guard against opening it in the tab never
 * hears of it.
 */
const guardDrag = (event: React.DragEvent<HTMLElement>): void => {
  const carriesFiles = Array.from(event.dataTransfer.types).includes("Files");
  const overPage = event.target instanceof Node && event.currentTarget.contains(event.target);
  if (carriesFiles && overPage) return;
  if (carriesFiles) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
  }
  event.stopPropagation();
};

/**
 * Covers the record pane while a file is dragged over the page. It never takes
 * pointer events, so the drop reaches the page's drop target beneath it.
 */
const RecordDropOverlay = ({ isActive }: { isActive: boolean }): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-ethereal-alabaster p-8 ring-2 ring-inset ring-ethereal-gold/60 transition-opacity duration-150 lg:absolute",
        isActive ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <UploadCloud size={32} strokeWidth={1.6} className="text-ethereal-gold" />
        <Text as="p" size="lg" weight="semibold">
          {t("archive.piece_card.drop_title")}
        </Text>
        <Text as="p" size="sm" color="graphite">
          {t("archive.piece_card.drop_hint")}
        </Text>
      </div>
    </div>
  );
};

interface PhoneReviewBarProps {
  readonly progress: ReviewProgressCounts;
  readonly isApproving: boolean;
  readonly onApprove: () => void;
}

/**
 * The review action on a phone, on the nav dock's top edge (`--nav-dock-h`, not
 * `bottom-dock`, whose gap is for bars that float) and with the dock's
 * opaque ground, so the two read as one surface rather than a card floating
 * over a bar. It registers its height, so the shell's feedback button rides
 * above it instead of under it.
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
        className="fixed inset-x-0 bottom-(--nav-dock-h) z-dock-bar flex items-center gap-4 border-t border-hairline bg-ethereal-alabaster py-2.5 pl-4 pr-3"
      >
        <CompactReviewProgress progress={progress} />
        <Button
          variant="primary"
          size="sm"
          casing="sentence"
          data-review-approve=""
          isLoading={isApproving}
          onClick={onApprove}
        >
          {t("archive.piece_card.approve_short", "Zatwierdź")}
        </Button>
      </div>
    </Portal>
  );
};

/**
 * The publish dialog's account of the review while fields are unchecked: the
 * same bar and sentence as under the title, and publishing anyway as a quiet
 * text action beside them.
 */
const ApprovalProgress = ({ progress, isPublishing, canPublish, onPublish }: {
  readonly progress: ReviewProgressCounts;
  readonly isPublishing: boolean;
  readonly canPublish: boolean;
  readonly onPublish: () => void;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const sentence = useReviewSentence(progress);
  return (
    <div className="mt-5 space-y-2 border-t border-hairline pt-4">
      <ReviewBar progress={progress} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Text as="p" color="graphite">{sentence}</Text>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          casing="sentence"
          isLoading={isPublishing}
          disabled={!canPublish}
          onClick={onPublish}
        >
          {t("archive.piece_card.approve_anyway")}
        </Button>
      </div>
    </div>
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
  const [searchParams] = useSearchParams();
  const scope = readCardScope(searchParams);
  const backPath = libraryPath(scope?.filters ?? null);
  const backState = libraryReturnState(id);
  // Each piece opens at its header. A step to the next piece swaps the record
  // under a phone's window that is still scrolled, and a cached record paints
  // before anything else would reset it. Beside the score the record pane is
  // its own scroller and starts at the top with this component.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const { data: allPieces = [] } = usePieces();
  const autosave = usePieceAutosave(id);
  const titleId = useId();
  const titleLabel = t("archive.piece_card.edit_title", "Tytuł utworu");
  const titleDraft = autosave.track("title", titleLabel);
  const titleReview = usePieceFieldReview({ piece, field: "title", label: titleLabel, autosave, controlId: titleId });
  const approveEdition = useApproveEdition();
  const scorePane = useScorePane();
  const dockBarHeight = useBottomBarHeight();

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  // Where focus goes once the approval modal has left: a draft's field, or the
  // first unchecked field when the modal sent the manager back to the review.
  const fieldToFocus = useRef<string | null>(null);
  const reviewOnExit = useRef(false);
  const [recordPane, setRecordPane] = useState<HTMLElement | null>(null);
  const [deskPane, setDeskPane] = useState<HTMLElement | null>(null);
  const [deskEdition, setDeskEdition] = useState<ShownEdition | null>(null);
  // Kept after the stand closes, so it leaves with the edition it showed.
  const [standEdition, setStandEdition] = useState<ShownEdition | null>(null);
  const [isStandOpen, setIsStandOpen] = useState(false);

  const pdfLinks = piece ? getPiecePdfLinks(piece) : [];
  // An edition asked for by name stays until it is deleted.
  const requestedPdf = deskEdition
    ? pdfLinks.find((link) => link.id === deskEdition.editionId)
    : undefined;
  const scorePdf = requestedPdf ?? (piece ? getReviewPdf(piece) : null);
  const deskStartPage = requestedPdf && deskEdition ? deskEdition.page : 1;
  const standPdf = standEdition
    ? (pdfLinks.find((link) => link.id === standEdition.editionId) ?? null)
    : null;

  const uploads = useEditionUploads(id);
  const { reject: rejectFiles, add: addFiles } = uploads;
  const asksPronunciation = piece ? uploadAsksPronunciation(piece) : false;
  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]): void => {
    rejectFiles(rejections);
    addFiles(accepted, asksPronunciation ? null : DEFAULT_LATIN_PRONUNCIATION);
  }, [rejectFiles, addFiles, asksPronunciation]);
  const dropzone = useDropzone({
    ...SCORE_DROP_OPTIONS,
    onDrop,
    noClick: true,
    noKeyboard: true,
  });
  // Conductor markup on the desk. Idle on a phone, where the stand carries
  // its own annotator.
  const annotator = useScoreAnnotator({
    editionId: scorePdf?.id ?? null,
    mode: "conductor",
    active: isTwoPane,
  });
  const claimReviewKey = useReviewKeys({
    root: recordPane,
    score: isTwoPane ? deskPane : null,
    enabled: Boolean(piece),
  });
  const claimAnnotatorKey = annotator.claimKey;
  // The desk's viewer asks before its own keys; the review's letters come
  // before the annotator's tools that share them.
  const claimDeskKey = useCallback(
    (event: KeyboardEvent): boolean => claimReviewKey(event) || claimAnnotatorKey(event),
    [claimReviewKey, claimAnnotatorKey],
  );
  const pageApi = useRef<PdfPageApi | null>(null);
  const updateAnnotatorPage = annotator.onPageApiChange;
  const handleScorePageApi = useCallback((api: PdfPageApi): void => {
    pageApi.current = api;
    updateAnnotatorPage(api);
  }, [updateAnnotatorPage]);
  // Beside the record an edition comes onto the desk; on a phone it opens the
  // stand.
  const showEdition = (editionId: string, page = 1): void => {
    if (!isTwoPane) {
      setStandEdition({ editionId, page });
      setIsStandOpen(true);
    } else if (editionId === scorePdf?.id) {
      pageApi.current?.goToPage(page);
    } else {
      setDeskEdition({ editionId, page });
    }
  };

  // The phone's top bar names the piece once its title has scrolled under it;
  // beside the score the index takes the publish action once the header has.
  const [titleRef, isTitleAway] = useScrolledAway(null, TOP_BAR_CLEARANCE, !isTwoPane);
  const [headerRef, isHeaderAway] = useScrolledAway(recordPane, INDEX_CLEARANCE, isTwoPane);
  const sections = piece ? recordSections(piece) : [];
  const spy = useScrollSpy({
    ids: sections.map((entry) => entry.anchor),
    root: isTwoPane ? recordPane : null,
    offset: isTwoPane ? SPY_LINE_DESKTOP_PX : SPY_LINE_PHONE_PX,
  });

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
                <Link to={backPath} state={backState}>
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

  const awaitingEditions = (piece.editions ?? []).filter(
    (edition) => edition.ingestion_status === INGESTION_STATUS.AWAITING,
  );
  const awaitingEdition = awaitingEditions[0];
  const isReviewing = Boolean(awaitingEdition);
  // A piece in review opened from outside the library still walks the queue.
  const walkedList: CardList | null = scope?.list ?? (isReviewing ? "review" : null);
  const walkedFilters = scope?.filters ?? EMPTY_LIBRARY_FILTERS;
  const sequence = walkedList
    ? pieceSequence(allPieces, pieceId, walkedList, walkedFilters)
    : null;
  const stepPath = (target: Piece): string =>
    pieceCardPath(target.id, walkedList ? { list: walkedList, filters: walkedFilters } : null);
  const breakdown = pieceReviewBreakdown(piece);
  const progress = breakdown.all;
  const hasUnchecked = progress.pending > 0;
  const indexItems: SectionIndexItem[] = sections.map((entry) => {
    const count = isReviewing && entry.review ? breakdown.sections[entry.review].pending : 0;
    return {
      id: entry.anchor,
      label: t(entry.indexKey ?? entry.titleKey),
      count,
      countLabel: count ? t("archive.piece_card.index_unchecked", { count }) : undefined,
    };
  });
  const goToSection = (anchor: string): void => {
    const target = document.getElementById(anchor);
    if (!target) return;
    spy.pin(anchor);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    target.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  };

  // The published piece leaves the queue but is still in the list fetched
  // before it, so the queue's next is the one after it; a library list goes on
  // to its next row. At the end of either the card returns to the library.
  const onwardAfterApproval =
    walkedList === "library" ? (sequence?.next ?? null) : findNextAwaiting(allPieces, pieceId);

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
      if (onwardAfterApproval) navigate(stepPath(onwardAfterApproval));
      else navigate(backPath, { state: backState });
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

  const backToReview = (): void => {
    reviewOnExit.current = true;
    setIsApproveOpen(false);
  };

  const focusAfterApproval = (): void => {
    const fieldId = fieldToFocus.current;
    const review = reviewOnExit.current;
    fieldToFocus.current = null;
    reviewOnExit.current = false;
    if (fieldId) requestAnimationFrame(() => document.getElementById(fieldId)?.focus());
    else if (review) requestAnimationFrame(() => focusFirstUnchecked());
  };

  const backLabel = t("archive.piece_card.back", "Wróć do biblioteki");
  const desk: EditionDesk = {
    editionId: scorePdf?.id ?? null,
    isTwoPane,
    show: showEdition,
  };

  return (
    <div
      {...dropzone.getRootProps({
        className: "flex flex-col pb-nav-dock lg:h-[calc(100dvh-var(--nav-dock-h))] lg:flex-row lg:pb-0",
        onDragEnter: guardDrag,
        onDragOver: guardDrag,
        onDragLeave: guardDrag,
        onDrop: guardDrag,
      })}
    >
      <input {...dropzone.getInputProps()} />
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
            ref={setDeskPane}
            aria-label={t("archive.piece_card.pdf_preview_aria", "Podgląd PDF partytury")}
            className="relative shrink-0 bg-score-desk"
            style={{ width: scorePane.paneWidth ?? undefined }}
          >
            <ScorePane
              pieceTitle={piece.title}
              scorePdf={scorePdf}
              initialPage={deskStartPage}
              onAddEdition={dropzone.open}
              annotator={{ ...annotator, claimKey: claimDeskKey }}
              isWide={scorePane.isWide}
              canToggleWide={scorePane.canToggleWide}
              onToggleWide={scorePane.toggleWide}
              onPageAspectChange={scorePane.onPageAspectChange}
              onPageApiChange={handleScorePageApi}
            />
          </section>
        )}

        <div className="relative flex min-w-0 flex-1 flex-col">
          <section
            ref={setRecordPane}
            data-review-root=""
            aria-label={t("archive.piece_card.form_panel_aria", "Dane utworu")}
            className="min-h-0 min-w-0 flex-1 lg:overflow-y-auto lg:border-l lg:border-hairline-strong"
          >
            {!isTwoPane && (
              <div className="sticky top-0 z-20 flex h-13 items-center gap-1 border-b border-hairline bg-ethereal-alabaster px-1">
                <Button asChild variant="icon" size="icon" aria-label={backLabel} title={backLabel}>
                  <Link to={backPath} state={backState}>
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
                {sequence && <PieceNav sequence={sequence} pathTo={stepPath} isCompact />}
              </div>
            )}

            <div className="px-4 pb-16 lg:px-10">
              <header ref={headerRef} className="mx-auto w-full max-w-170 pb-6 pt-3 lg:pt-9">
                <div className="hidden min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:flex">
                  <Link
                    to={backPath}
                    state={backState}
                    className="inline-flex items-center gap-2 rounded-chip text-ethereal-graphite transition-colors hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
                  >
                    <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
                    <Eyebrow color="inherit">
                      {t("archive.piece_card.back_btn", "Biblioteka")}
                    </Eyebrow>
                  </Link>
                  <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
                    {sequence && <PieceNav sequence={sequence} pathTo={stepPath} />}
                    {isReviewing && (
                      <Button
                        variant="primary"
                        casing="sentence"
                        data-review-approve=""
                        className="max-w-full whitespace-normal"
                        isLoading={approveEdition.isPending}
                        onClick={() => setIsApproveOpen(true)}
                      >
                        {t("archive.piece_card.approve_btn", "Zatwierdź i opublikuj")}
                      </Button>
                    )}
                  </div>
                </div>

                {/* The title's check stands at the end of its first line; the
                    title carries no edge, which beside display type reads as a
                    stray mark rather than a state. */}
                <div className="mt-1.5 flex items-start gap-2 lg:mt-4.5">
                  <Heading as="h1" size={null} aria-label={piece.title} ref={titleRef} className="min-w-0 flex-1">
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
                        return pieceFieldSchema.shape.title.safeParse(next).success
                          ? null
                          : t("archive.piece_card.field_too_long");
                      }}
                      ariaLabel={titleLabel}
                      variant="headline"
                      className="text-4xl leading-tight lg:text-5xl"
                    />
                  </Heading>
                  {titleReview.action && <div className="pt-0.5 lg:pt-2">{titleReview.action}</div>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {byline && <Text as="p" size="md" color="graphite">{byline}</Text>}
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
                  <ReviewProgress
                    progress={progress}
                    isReviewing={isReviewing}
                    hint={progress.pending > 0 ? t("archive.piece_card.review_keys_hint") : undefined}
                  />
                </div>

                {!isTwoPane && scorePdf && (
                  <div className="mt-4 flex items-center gap-3 border-y border-hairline py-3">
                    <FileText
                      size={18}
                      className="shrink-0 text-ethereal-graphite"
                      aria-hidden="true"
                    />
                    {/* Described, not named: the upload's filename is the
                        edition list's business, further down. */}
                    <Text as="p" size="base" className="min-w-0 flex-1">
                      {[
                        t("archive.piece_card.score_row"),
                        "PDF",
                        scorePdf.page_count ? t("archive.piece_card.page_count", { count: scorePdf.page_count }) : null,
                      ].filter(Boolean).join(" · ")}
                    </Text>
                    <Button
                      variant="outline"
                      size="sm"
                      casing="sentence"
                      aria-label={t("archive.piece_card.open_score")}
                      onClick={() => showEdition(scorePdf.id)}
                    >
                      {t("archive.piece_card.open_short")}
                    </Button>
                  </div>
                )}
              </header>
              {/* Full width under the sticky bars, so the record scrolls out of
                  sight beneath it instead of showing through at its sides. */}
              <div className="sticky top-13 z-10 -mx-4 mb-6 border-b border-hairline bg-ethereal-alabaster px-4 lg:top-0 lg:-mx-10 lg:px-10">
                <SectionIndex
                  className="mx-auto w-full max-w-170"
                  linkClassName="lg:min-h-14"
                  items={indexItems}
                  activeId={spy.activeId}
                  onSelect={goToSection}
                  ariaLabel={t("archive.piece_card.index_aria")}
                  trailing={isTwoPane && isReviewing && isHeaderAway ? (
                    <div className="flex shrink-0 items-center self-stretch border-l border-hairline pl-3">
                      <Button
                        variant="primary"
                        size="sm"
                        casing="sentence"
                        data-review-approve=""
                        isLoading={approveEdition.isPending}
                        onClick={() => setIsApproveOpen(true)}
                      >
                        {t("archive.piece_card.approve_short", "Zatwierdź")}
                      </Button>
                    </div>
                  ) : isTwoPane && sequence && isHeaderAway ? (
                    <div className="flex shrink-0 items-center self-stretch border-l border-hairline pl-2">
                      <PieceNav sequence={sequence} pathTo={stepPath} isCompact />
                    </div>
                  ) : undefined}
                />
              </div>
              <div className="mx-auto w-full max-w-170">
                <PieceProperties
                  key={pieceId}
                  piece={piece}
                  isReviewing={isReviewing}
                  autosave={autosave}
                  score={scorePdf ? { editionId: scorePdf.id, editions: pdfLinks, show: showEdition } : undefined}
                  editions={
                    <PieceEditions
                      piece={piece}
                      autosave={autosave}
                      desk={desk}
                      uploads={uploads}
                      onAddEdition={dropzone.open}
                    />
                  }
                />
              </div>
            </div>

            {/* Room for the phone's bottom bar, which floats over the column. */}
            {!isTwoPane && <div aria-hidden="true" style={{ height: dockBarHeight }} />}
          </section>
          <RecordDropOverlay isActive={dropzone.isDragActive} />
        </div>
      </div>

      {!isTwoPane && isReviewing && (
        <PhoneReviewBar
          progress={progress}
          isApproving={approveEdition.isPending}
          onApprove={() => setIsApproveOpen(true)}
        />
      )}

      {/* Publishing shows the AI's work to the whole choir and notifies the
          projects that hold the piece, so it stops to say so. With fields
          unchecked, the gold action goes back to the review and publishing
          anyway is the quiet one. */}
      <ConfirmModal
        isOpen={isApproveOpen}
        title={t("archive.piece_card.approve_modal_title")}
        description={t("archive.piece_card.approve_modal_body")}
        icon={null}
        isDestructive={false}
        casing="sentence"
        confirmText={t(hasUnchecked ? "archive.piece_card.approve_back_to_review" : "archive.piece_card.approve_btn")}
        cancelText={t("common.actions.cancel")}
        isLoading={!hasUnchecked && (approveEdition.isPending || autosave.isSaving)}
        confirmDisabled={!hasUnchecked && autosave.drafts.length > 0}
        onCancel={() => setIsApproveOpen(false)}
        onConfirm={hasUnchecked ? backToReview : handleApprove}
        onExitComplete={focusAfterApproval}
      >
        {hasUnchecked && (
          <ApprovalProgress
            progress={progress}
            isPublishing={approveEdition.isPending || autosave.isSaving}
            canPublish={autosave.drafts.length === 0}
            onPublish={handleApprove}
          />
        )}
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
          isOpen={isStandOpen && standPdf !== null}
          initialPage={standEdition?.page}
          editionId={standPdf?.id ?? null}
          mode="conductor"
          title={piece.title}
          subtitle={standPdf?.label}
          fileName={standPdf?.label}
          fetchBlob={
            standPdf ? () => MaterialsService.fetchScoreEditionBlob(standPdf.id) : null
          }
          canExport={standPdf?.canExport ?? true}
          preferredFit={standPdf?.wholePage ? "page" : undefined}
          onClose={() => setIsStandOpen(false)}
        />
      )}
    </div>
  );
};
