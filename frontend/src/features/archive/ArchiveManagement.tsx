/**
 * @file ArchiveManagement.tsx
 * @description The library: every piece the ensemble holds, as a list whose
 * rows open the piece card (`/panel/archive-management/:id`), where a piece is
 * read and edited. The list itself edits nothing but the selection.
 *
 * Two ways in: "Wgraj PDF" opens the upload drawer, the common path, and
 * "Dodaj ręcznie" opens `/new`. Uploads the AI is still reading, and those it
 * gave up on before they became a piece, stand above the list as their own
 * sections. "Zaznacz wiele" turns the rows into toggles for the one bulk act,
 * a voice layout written to many pieces. A fresh library shows the welcome
 * state with the drop zone inline instead.
 * @module features/archive/ArchiveManagement
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Plus, Sparkles, UploadCloud } from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { RecordList } from "@/shared/ui/composites/RecordList";
import { Button } from "@/shared/ui/primitives/Button";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

import { ActiveIngestionsPanel } from "./components/ActiveIngestionsPanel";
import { ArchiveEmptyState } from "./components/ArchiveEmptyState";
import { ArchiveTabs } from "./components/ArchiveTabs";
import {
  ArchiveSearchBar,
  type ArchiveActiveFilter,
} from "./components/ArchiveSearchBar";
import { StatLine, type StatLineItem } from "@/shared/ui/composites/StatLine";
import { ArchiveWelcomeState } from "./components/ArchiveWelcomeState";
import { BulkDivisiSheet } from "./components/BulkDivisiSheet";
import { EditionUploadDrawer } from "./components/EditionUploadDrawer";
import { OrphanIngestionsPanel } from "./components/OrphanIngestionsPanel";
import { PieceBulkBar } from "./components/PieceBulkBar";
import { PieceRow, pieceRowId } from "./components/PieceRow";
import { useArchiveData } from "./hooks/useArchiveData";
import { getArchiveEpochOptions } from "./constants/archiveEpochs";
import { pieceCardPath, readReturnedPiece } from "./constants/libraryScope";
import type { EnrichedPiece } from "./types/archive.dto";

/** No piece-wide divisi at all — the rows a layout sweep usually targets. */
const lacksPieceWideDivisi = (piece: EnrichedPiece): boolean =>
  !(piece.voice_requirements_read ?? []).some(
    (r) => (r.edition ?? null) === null,
  );

export default function ArchiveManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const epochOptions = getArchiveEpochOptions(t);

  const {
    isLoading,
    isError,
    filters,
    composers,
    voiceLines,
    libraryStats,
    availableVoicings,
    displayPieces,
    awaitingPieces,
    hasActiveFilters,
    activeFilterCount,
    searchTerm,
    setSearchTerm,
    composerFilter,
    setComposerFilter,
    epochFilter,
    setEpochFilter,
    voicingFilter,
    setVoicingFilter,
    resetFilters,
    pieceToDelete,
    setPieceToDelete,
    isDeleting,
    executeDelete,
    handleDeleteRequest,
  } = useArchiveData();

  const deferredPieces = useDeferredValue(displayPieces);
  const normalizedSearchTerm = searchTerm.trim();
  const totalPieces = libraryStats.totalPieces;
  const withoutPdf = totalPieces - libraryStats.withPdf;

  const composerLabelMap = useMemo(
    () =>
      new Map(
        composers.map((composer) => [
          composer.id,
          `${composer.last_name} ${composer.first_name || ""}`.trim(),
        ]),
      ),
    [composers],
  );

  const activeFilters = useMemo<ArchiveActiveFilter[]>(() => {
    const filters: ArchiveActiveFilter[] = [];
    if (normalizedSearchTerm) {
      filters.push({
        id: "search",
        label: t("archive.filters.search_token", 'Fraza: "{{term}}"', {
          term: normalizedSearchTerm,
        }),
        clear: () => setSearchTerm(""),
      });
    }
    if (composerFilter) {
      filters.push({
        id: "composer",
        label: t("archive.filters.composer_token", "Kompozytor: {{composer}}", {
          composer:
            composerLabelMap.get(composerFilter) ||
            t("archive.filters.unknown_composer", "Nieznany"),
        }),
        clear: () => setComposerFilter(""),
      });
    }
    if (epochFilter) {
      filters.push({
        id: "epoch",
        label: t("archive.filters.epoch_token", "Epoka: {{epoch}}", {
          epoch:
            epochOptions.find((epoch) => epoch.value === epochFilter)?.label ||
            epochFilter,
        }),
        clear: () => setEpochFilter(""),
      });
    }
    if (voicingFilter) {
      filters.push({
        id: "voicing",
        label: t("archive.filters.voicing_token", "Obsada: {{voicing}}", {
          voicing: voicingFilter,
        }),
        clear: () => setVoicingFilter(""),
      });
    }
    return filters;
  }, [
    composerFilter,
    composerLabelMap,
    epochFilter,
    epochOptions,
    normalizedSearchTerm,
    setComposerFilter,
    setEpochFilter,
    setSearchTerm,
    setVoicingFilter,
    t,
    voicingFilter,
  ]);

  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  // Selection mode: ids live in a Set keyed by String(id); the sheet receives
  // the piece objects so it can read what layouts they already carry.
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isDivisiSheetOpen, setIsDivisiSheetOpen] = useState<boolean>(false);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((on) => !on);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectVisible = useCallback(
    (predicate: (piece: EnrichedPiece) => boolean) => {
      setSelectedIds(
        new Set(
          displayPieces.filter(predicate).map((piece) => String(piece.id)),
        ),
      );
    },
    [displayPieces],
  );

  // The sweep acts on what the list shows: a piece ticked and then hidden by
  // a filter stays ticked but neither counts nor gets written until it is
  // visible again, so the number on the bar is always the number on the save.
  const selectedPieces = useMemo(
    () => displayPieces.filter((piece) => selectedIds.has(String(piece.id))),
    [displayPieces, selectedIds],
  );
  const withoutDivisiCount = useMemo(
    () => displayPieces.filter(lacksPieceWideDivisi).length,
    [displayPieces],
  );

  const exitSelection = useCallback(() => {
    setIsDivisiSheetOpen(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    if (isError) {
      toast.error(
        t("archive.toast.sync_warning_title", "Ostrzeżenie synchronizacji"),
        {
          description: t(
            "archive.toast.sync_warning_desc",
            "Nie udało się pobrać wszystkich danych biblioteki.",
          ),
        },
      );
    }
  }, [isError, t]);

  const navigateToNew = useCallback(() => {
    navigate("/panel/archive-management/new");
  }, [navigate]);

  const navigateToReview = useCallback(
    (pieceId: string) => {
      navigate(pieceCardPath(pieceId, { list: "review", filters }));
    },
    [navigate, filters],
  );

  // Back from a card, the row it was opened from comes into view, once: after
  // that the list scrolls as the manager scrolls it. `PageTransition` resets
  // the window on mount, and as this page's child its effect runs first.
  const returnedFrom = readReturnedPiece(location.state);
  const hasRows = deferredPieces.length > 0;
  const hasScrolledBack = useRef(false);
  useEffect(() => {
    if (hasScrolledBack.current || !returnedFrom || !hasRows) return;
    hasScrolledBack.current = true;
    document
      .getElementById(pieceRowId(returnedFrom))
      ?.scrollIntoView({ block: "center" });
  }, [returnedFrom, hasRows]);

  if (isLoading && displayPieces.length === 0) {
    return <EtherealLoader />;
  }

  const isFreshArchive = !isLoading && totalPieces === 0;

  const awaitingCount = awaitingPieces.length;
  const firstAwaitingPiece = awaitingPieces[0];

  // A count, and the one gap a manager acts on, only while there is one: a
  // coverage percentage restated a default on a healthy library.
  const libraryStatSegments: StatLineItem[] = [
    {
      id: "pieces",
      value: totalPieces,
      label: t("archive.stat_strip.pieces", "utworów", { count: totalPieces }),
    },
    ...(withoutPdf > 0
      ? [
          {
            id: "no_pdf",
            value: withoutPdf,
            label: t("archive.stat_strip.without_pdf", "bez PDF"),
          },
        ]
      : []),
  ];

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-5xl flex-col gap-5 pb-24 pt-6">
        <PageHeader
          size="standard"
          title={t("archive.dashboard.title", "Biblioteka")}
          rightContent={
            !isFreshArchive ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  variant="primary"
                  casing="sentence"
                  onClick={() => setIsUploadOpen(true)}
                  fullWidth
                  leftIcon={<UploadCloud size={16} aria-hidden="true" />}
                >
                  {t("archive.dashboard.upload_pdf", "Wgraj PDF")}
                </Button>
                <Button
                  variant="ghost"
                  casing="sentence"
                  onClick={navigateToNew}
                  fullWidth
                  leftIcon={<Plus size={16} aria-hidden="true" />}
                >
                  {t("archive.dashboard.add_manual", "Dodaj ręcznie")}
                </Button>
              </div>
            ) : undefined
          }
        />

        {!isFreshArchive && <ArchiveTabs />}

        {/* Facts stay a sentence; the review backlog is the one thing here that
            is work, so it is a control and not a restatement of the flags the
            rows already carry. */}
        {!isFreshArchive && (
          <StatLine
            stats={libraryStatSegments}
            action={
              awaitingCount > 0 && firstAwaitingPiece ? (
                <Button
                  variant="outline"
                  size="sm"
                  casing="sentence"
                  leftIcon={<Sparkles size={14} aria-hidden="true" />}
                  onClick={() => navigateToReview(String(firstAwaitingPiece.id))}
                >
                  {t(
                    "archive.stat_strip.review_cta",
                    "{{count}} do przeglądu",
                    { count: awaitingCount },
                  )}
                </Button>
              ) : undefined
            }
          />
        )}

        {/* Every ingestion in flight, refresh-proof, in both the fresh and the
            populated library, then the runs that never reached a piece. Each
            section renders nothing while it is empty, which is nearly always. */}
        {/* The extra air below keeps the search from reading as part of the
            last section; with both sections empty the box collapses away. */}
        <div className="flex flex-col gap-8 pb-4 empty:hidden">
          <ActiveIngestionsPanel />
          <OrphanIngestionsPanel />
        </div>

        {isFreshArchive ? (
          <ArchiveWelcomeState onAddManually={navigateToNew} />
        ) : (
          <>
            <ArchiveSearchBar
              searchTerm={searchTerm}
              composerFilter={composerFilter}
              epochFilter={epochFilter}
              voicingFilter={voicingFilter}
              composers={composers}
              epochOptions={epochOptions}
              availableVoicings={availableVoicings}
              hasActiveFilters={hasActiveFilters}
              activeFilterCount={activeFilterCount}
              activeFilters={activeFilters}
              visibleCount={deferredPieces.length}
              totalCount={totalPieces}
              onSearchTermChange={setSearchTerm}
              onComposerFilterChange={setComposerFilter}
              onEpochFilterChange={setEpochFilter}
              onVoicingFilterChange={setVoicingFilter}
              onResetFilters={resetFilters}
              selectionMode={selectionMode}
              onToggleSelectionMode={toggleSelectionMode}
            />

            {deferredPieces.length > 0 ? (
              <RecordList label={t("archive.list_aria", "Utwory w bibliotece")}>
                {deferredPieces.map((piece) => (
                  <PieceRow
                    key={piece.id}
                    piece={piece}
                    cardPath={pieceCardPath(piece.id, { list: "library", filters })}
                    onDelete={(p) =>
                      handleDeleteRequest(String(p.id), p.title)
                    }
                    selectionMode={selectionMode}
                    selected={selectedIds.has(String(piece.id))}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </RecordList>
            ) : (
              <ArchiveEmptyState
                searchTerm={normalizedSearchTerm}
                hasActiveFilters={hasActiveFilters}
                onCreatePiece={navigateToNew}
                onResetFilters={resetFilters}
              />
            )}
          </>
        )}

        <EditionUploadDrawer
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
        />

        <AnimatePresence>
          {selectionMode && !isFreshArchive && (
            <PieceBulkBar
              selectedCount={selectedPieces.length}
              visibleCount={displayPieces.length}
              withoutDivisiCount={withoutDivisiCount}
              onSelectAll={() => selectVisible(() => true)}
              onSelectWithoutDivisi={() => selectVisible(lacksPieceWideDivisi)}
              onClear={() => setSelectedIds(new Set())}
              onSetDivisi={() => setIsDivisiSheetOpen(true)}
              onExit={exitSelection}
            />
          )}
        </AnimatePresence>

        <BulkDivisiSheet
          isOpen={isDivisiSheetOpen && selectedPieces.length > 0}
          pieces={selectedPieces}
          voiceLines={voiceLines}
          onClose={() => setIsDivisiSheetOpen(false)}
          onApplied={exitSelection}
        />

        <ConfirmModal
          isOpen={!!pieceToDelete}
          title={t("archive.delete_modal.title", "Usunąć utwór z biblioteki?")}
          description={t(
            "archive.delete_modal.desc",
            "Ten krok usunie bezpowrotnie metadane utworu i powiązane pliki zarządzane w bibliotece.",
          )}
          onConfirm={async () => {
            await executeDelete();
          }}
          onCancel={() => setPieceToDelete(null)}
          isLoading={isDeleting}
        />
      </div>
    </PageTransition>
  );
}
