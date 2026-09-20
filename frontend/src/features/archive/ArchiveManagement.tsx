/**
 * @file ArchiveManagement.tsx
 * @description Operational controller for the repertoire library.
 * Layout philosophy (rev. 2026-05-30): no side panel anywhere. Three states,
 * three patterns:
 *
 *   1. Glance — compact PieceRow list with inline pencil edits for trivial
 *      single-line fields (title, year, voicing). Hover delete.
 *   2. Expand — click row → accordion shows composer / divisi / PDFs /
 *      tracks + CTAs. ~80% of conductor interactions land here.
 *   3. Deep work — dedicated routes for focused tasks:
 *        /panel/archive-management/new   → manual create
 *        /panel/archive-management/:id   → the Piece Card (edit + AI verification)
 *
 * Upload zone stays in a drawer triggered by the header CTA. Fresh-archive
 * empty state hosts the drop zone inline as the dominant CTA.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/ArchiveManagement
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useDeferredValue,
} from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Plus, Sparkles, UploadCloud } from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
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
import { PieceRow } from "./components/PieceRow";
import { useArchiveData } from "./hooks/useArchiveData";
import { getArchiveEpochOptions } from "./constants/archiveEpochs";
import type { EnrichedPiece } from "./types/archive.dto";

const formatCoverage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

/** No piece-wide divisi at all — the rows a layout sweep usually targets. */
const lacksPieceWideDivisi = (piece: EnrichedPiece): boolean =>
  !(piece.voice_requirements_read ?? []).some(
    (r) => (r.edition ?? null) === null,
  );

export default function ArchiveManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const epochOptions = getArchiveEpochOptions(t);

  const {
    isLoading,
    isError,
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
  const pdfCoverage = formatCoverage(libraryStats.withPdf, totalPieces);

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
            "Nie udało się pobrać wszystkich danych archiwum.",
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
      navigate(`/panel/archive-management/${pieceId}`);
    },
    [navigate],
  );

  if (isLoading && displayPieces.length === 0) {
    return <EtherealLoader />;
  }

  const isFreshArchive = !isLoading && totalPieces === 0;

  const awaitingCount = awaitingPieces.length;
  const firstAwaitingPiece = awaitingPieces[0];

  const libraryStatSegments: StatLineItem[] = [
    {
      id: "pieces",
      value: totalPieces,
      label: t("archive.stat_strip.pieces", "utworów"),
    },
    {
      id: "pdf",
      value: `${pdfCoverage}%`,
      label: t("archive.stat_strip.with_pdf", "z PDF"),
    },
  ];

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-5xl flex-col gap-5 pb-24 pt-6">
        <PageHeader
          size="standard"
          roleText={t("archive.dashboard.subtitle", "Biblioteka nut")}
          title={t("archive.dashboard.title", "Archiwum")}
          titleHighlight={t("archive.dashboard.title_highlight", "repertuaru")}
          rightContent={
            !isFreshArchive ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  variant="primary"
                  onClick={() => setIsUploadOpen(true)}
                  fullWidth
                  leftIcon={<UploadCloud size={14} aria-hidden="true" />}
                >
                  {t("archive.dashboard.upload_pdf", "Wgraj PDF")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateToNew}
                  fullWidth
                  leftIcon={<Plus size={14} aria-hidden="true" />}
                >
                  {t("archive.dashboard.add_manual", "Dodaj ręcznie")}
                </Button>
              </div>
            ) : undefined
          }
        />

        {!isFreshArchive && <ArchiveTabs />}

        {/* Facts stay a sentence; the review backlog is the one thing here that
            is work, so it is a control and not a fourth restatement of the count
            the rows already carry. */}
        {!isFreshArchive && (
          <StatLine
            stats={libraryStatSegments}
            action={
              awaitingCount > 0 && firstAwaitingPiece ? (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Sparkles size={13} aria-hidden="true" />}
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

        {/* Persistent, refresh-proof live view of every ingestion in flight —
            rendered in both the fresh and populated archive states, and paired
            with the dead-letter queue for the runs that never reached a piece
            (silent until there is one, which is nearly always). */}
        <ActiveIngestionsPanel />
        <OrphanIngestionsPanel />

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
              <div className="flex flex-col gap-2">
                {deferredPieces.map((piece) => (
                  <PieceRow
                    key={piece.id}
                    piece={piece}
                    onDelete={(p) =>
                      handleDeleteRequest(String(p.id), p.title)
                    }
                    selectionMode={selectionMode}
                    selected={selectedIds.has(String(piece.id))}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
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
          title={t("archive.delete_modal.title", "Usunąć utwór z archiwum?")}
          description={t(
            "archive.delete_modal.desc",
            "Ten krok usunie bezpowrotnie metadane utworu i powiązane pliki zarządzane w archiwum.",
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
