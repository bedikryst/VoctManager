/**
 * @file ArchiveManagement.tsx
 * @description Operational controller for the repertoire library.
 * Layout philosophy (rev. 2026-05-30): dense, action-first, library-like.
 * No bento decoration — stats live in a one-line strip in the header, the
 * heavy hero / metrics cards are gone, the drag-drop upload only appears
 * when the conductor explicitly asks for it (drawer triggered from the
 * primary CTA).
 *
 * Three states:
 *   1. Fresh archive (zero pieces) → ArchiveWelcomeState.
 *   2. Has awaiting editions → AwaitingBanner at top with deep-link.
 *   3. Normal browsing → search-first bar + dense rows.
 * @architecture Enterprise SaaS 2026
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
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Plus, UploadCloud } from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Button } from "@/shared/ui/primitives/Button";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { INGESTION_STATUS } from "@/shared/types";

import ArchiveEditorPanel from "./components/ArchiveEditorPanel";
import { ArchiveAwaitingBanner } from "./components/ArchiveAwaitingBanner";
import { ArchiveEmptyState } from "./components/ArchiveEmptyState";
import {
  ArchiveSearchBar,
  type ArchiveActiveFilter,
} from "./components/ArchiveSearchBar";
import { ArchiveStatStrip } from "./components/ArchiveStatStrip";
import { ArchiveWelcomeState } from "./components/ArchiveWelcomeState";
import { EditionUploadDrawer } from "./components/EditionUploadDrawer";
import { PieceRow } from "./components/PieceRow";
import { useArchiveData } from "./hooks/useArchiveData";
import type { EnrichedPiece } from "./types/archive.dto";
import { getArchiveEpochOptions } from "./constants/archiveEpochs";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ARCHIVE_TABS, type ArchiveTabId } from "./constants/archiveDomain";

const formatCoverage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

export default function ArchiveManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const epochOptions = getArchiveEpochOptions(t);

  const {
    isLoading,
    isError,
    composers,
    voiceLines,
    libraryStats,
    availableVoicings,
    displayPieces,
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

  // ---- Editor panel state ------------------------------------------------
  const closeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ArchiveTabId>(ARCHIVE_TABS.DETAILS);
  const [editingPiece, setEditingPiece] = useState<EnrichedPiece | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<string>("");
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  useBodyScrollLock(isPanelOpen || pieceToDelete !== null);

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

  useEffect(
    () => () => {
      if (closeResetTimeoutRef.current) {
        clearTimeout(closeResetTimeoutRef.current);
      }
    },
    [],
  );

  const openPanel = useCallback(
    (
      piece: EnrichedPiece | null = null,
      tab: ArchiveTabId = ARCHIVE_TABS.DETAILS,
      context: string = "",
    ) => {
      if (closeResetTimeoutRef.current) {
        clearTimeout(closeResetTimeoutRef.current);
        closeResetTimeoutRef.current = null;
      }
      setEditingPiece(piece);
      setActiveTab(tab);
      setInitialSearchContext(context);
      setIsPanelOpen(true);
    },
    [],
  );

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    if (closeResetTimeoutRef.current) {
      clearTimeout(closeResetTimeoutRef.current);
    }
    closeResetTimeoutRef.current = setTimeout(() => {
      setEditingPiece(null);
      setInitialSearchContext("");
      closeResetTimeoutRef.current = null;
    }, 300);
  }, []);

  const handleDeleteConfirm = async () => {
    const deletedId = pieceToDelete?.id;
    await executeDelete();
    if (editingPiece?.id && editingPiece.id === deletedId) {
      closePanel();
    }
  };

  // ---- Empty state gating ------------------------------------------------
  if (isLoading && displayPieces.length === 0) {
    return <EtherealLoader />;
  }

  const isFreshArchive = !isLoading && totalPieces === 0;

  // Count derived from full pieces list (not filtered) so the banner is
  // visible even when the conductor has a search active that hides the AWAI ones.
  const awaitingCount = libraryStats.totalPieces > 0
    ? deferredPieces.filter((p) =>
        (p.editions ?? []).some(
          (e) => e.ingestion_status === INGESTION_STATUS.AWAITING,
        ),
      ).length
    : 0;

  const firstAwaitingPiece = deferredPieces.find((p) =>
    (p.editions ?? []).some(
      (e) => e.ingestion_status === INGESTION_STATUS.AWAITING,
    ),
  );

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-24 pt-6 sm:px-0">
        <PageHeader
          size="standard"
          roleText={t("archive.dashboard.subtitle", "Biblioteka nut")}
          title={t("archive.dashboard.title", "Archiwum")}
          titleHighlight={t("archive.dashboard.title_highlight", "repertuaru")}
          rightContent={
            !isFreshArchive ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => setIsUploadOpen(true)}
                  leftIcon={<UploadCloud size={14} aria-hidden="true" />}
                >
                  {t("archive.dashboard.upload_pdf", "Wgraj PDF")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPanel()}
                  leftIcon={<Plus size={14} aria-hidden="true" />}
                >
                  {t("archive.dashboard.add_manual", "Dodaj ręcznie")}
                </Button>
              </div>
            ) : undefined
          }
        />

        {!isFreshArchive && (
          <ArchiveStatStrip
            totalPieces={totalPieces}
            pdfCoverage={pdfCoverage}
            awaitingCount={awaitingCount}
            onJumpToAwaiting={() =>
              firstAwaitingPiece &&
              openPanel(firstAwaitingPiece, ARCHIVE_TABS.AI_CONTEXT)
            }
          />
        )}

        {isFreshArchive ? (
          <ArchiveWelcomeState onAddManually={() => openPanel()} />
        ) : (
          <>
            {awaitingCount > 0 && (
              <ArchiveAwaitingBanner
                pieces={deferredPieces}
                onOpenReview={(piece) =>
                  openPanel(piece, ARCHIVE_TABS.AI_CONTEXT)
                }
              />
            )}

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
            />

            {deferredPieces.length > 0 ? (
              <div className="flex flex-col gap-2">
                {deferredPieces.map((piece) => (
                  <PieceRow
                    key={piece.id}
                    piece={piece}
                    onOpen={(p) => openPanel(p)}
                    onDelete={(p) =>
                      handleDeleteRequest(String(p.id), p.title)
                    }
                  />
                ))}
              </div>
            ) : (
              <ArchiveEmptyState
                searchTerm={normalizedSearchTerm}
                hasActiveFilters={hasActiveFilters}
                onCreatePiece={() =>
                  openPanel(null, ARCHIVE_TABS.DETAILS, normalizedSearchTerm)
                }
                onResetFilters={resetFilters}
              />
            )}
          </>
        )}

        <ArchiveEditorPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          piece={editingPiece}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ArchiveTabId)}
          composers={composers}
          voiceLines={voiceLines}
          initialSearchContext={initialSearchContext}
        />

        <EditionUploadDrawer
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
        />

        <ConfirmModal
          isOpen={!!pieceToDelete}
          title={t("archive.delete_modal.title", "Usunąć utwór z archiwum?")}
          description={t(
            "archive.delete_modal.desc",
            "Ten krok usunie bezpowrotnie metadane utworu i powiązane pliki zarządzane w archiwum.",
          )}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPieceToDelete(null)}
          isLoading={isDeleting}
        />
      </div>
    </PageTransition>
  );
}
