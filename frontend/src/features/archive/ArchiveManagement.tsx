/**
 * @file ArchiveManagement.tsx
 * @description Operational controller for archive dashboard state and piece workflows.
 * Delegates large presentation surfaces to archive-specific components to keep the shell maintainable.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/ArchiveManagement
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useDeferredValue,
} from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Library, Plus } from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

import ArchiveEditorPanel from "./components/ArchiveEditorPanel";
import { ArchiveEmptyState } from "./components/ArchiveEmptyState";
import {
  ArchiveFiltersPanel,
  type ArchiveActiveFilter,
} from "./components/ArchiveFiltersPanel";
import { ArchiveHeroPanel } from "./components/ArchiveHeroPanel";
import { ArchiveMetricsGrid } from "./components/ArchiveMetricsGrid";
import PieceCard from "./components/PieceCard";
import { useArchiveData } from "./hooks/useArchiveData";
import type { EnrichedPiece } from "./types/archive.dto";
import { getArchiveEpochOptions } from "./constants/archiveEpochs";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ARCHIVE_TABS, type ArchiveTabId } from "./constants/archiveDomain";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";

const formatCoverage = (value: number, total: number): number => {
  if (total === 0) {
    return 0;
  }

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
  const audioCoverage = formatCoverage(libraryStats.piecesWithAudio, totalPieces);

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
        label: t("archive.filters.search_token", "Fraza: \"{{term}}\"", {
          term: normalizedSearchTerm,
        }),
        clear: () => setSearchTerm(""),
      });
    }

    if (composerFilter) {
      filters.push({
        id: "composer",
        label: t(
          "archive.filters.composer_token",
          "Kompozytor: {{composer}}",
          {
            composer:
              composerLabelMap.get(composerFilter) ||
              t("archive.filters.unknown_composer", "Nieznany"),
          },
        ),
        clear: () => setComposerFilter(""),
      });
    }

    if (epochFilter) {
      filters.push({
        id: "epoch",
        label: t(
          "archive.filters.epoch_token",
          "Epoka: {{epoch}}",
          {
            epoch:
              epochOptions.find((epoch) => epoch.value === epochFilter)
                ?.label || epochFilter,
          },
        ),
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
    voicingFilter,
  ]);

  const closeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ArchiveTabId>(ARCHIVE_TABS.DETAILS);
  const [editingPiece, setEditingPiece] = useState<EnrichedPiece | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<string>("");

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

  if (isLoading && displayPieces.length === 0) {
    return <EtherealLoader />;
  }

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-0">
        <StaggeredBentoContainer className="flex flex-col gap-6">
          <StaggeredBentoItem>
            <PageHeader
              size="standard"
              roleText={t("archive.dashboard.subtitle", "Biblioteka nut")}
              title={t("archive.dashboard.title", "Repertuar")}
              titleHighlight={t(
                "archive.dashboard.title_highlight",
                "i Archiwum",
              )}
              rightContent={
                <Button
                  variant="primary"
                  onClick={() => openPanel()}
                  leftIcon={<Plus size={16} aria-hidden="true" />}
                >
                  {t("archive.dashboard.new_piece", "Dodaj utwór")}
                </Button>
              }
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem className="md:hidden">
            <Button
              variant="primary"
              fullWidth
              onClick={() => openPanel()}
              leftIcon={<Plus size={16} aria-hidden="true" />}
            >
              {t("archive.dashboard.new_piece", "Dodaj utwór")}
            </Button>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <ArchiveHeroPanel
              pdfCoverage={pdfCoverage}
              audioCoverage={audioCoverage}
              uniqueComposers={libraryStats.uniqueComposers}
              uniqueVoicings={libraryStats.uniqueVoicings}
              withReferenceLinks={libraryStats.withReferenceLinks}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <ArchiveMetricsGrid
              totalPieces={totalPieces}
              pdfCoverage={pdfCoverage}
              uniqueComposers={libraryStats.uniqueComposers}
              totalAudio={libraryStats.totalAudio}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <ArchiveFiltersPanel
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
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <SectionHeader
                  title={t("archive.dashboard.collection_title", "Kolekcja robocza")}
                  icon={<Library size={14} aria-hidden="true" />}
                  withFluidDivider={false}
                  className="mb-0 pb-0"
                />
                <Text color="graphite" className="mt-2 max-w-2xl">
                  {t(
                    "archive.dashboard.collection_desc",
                    "Każda karta prowadzi bezpośrednio do szczegółów utworu, plików nutowych i zarządzania ścieżkami audio.",
                  )}
                </Text>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="glass">{deferredPieces.length} w widoku</Badge>
                {hasActiveFilters && (
                  <Badge variant="outline">Widok filtrowany</Badge>
                )}
              </div>
            </div>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <StaggeredBentoContainer className="grid grid-cols-1 gap-4">
              {deferredPieces.length > 0 ? (
                deferredPieces.map((piece) => (
                  <StaggeredBentoItem key={piece.id}>
                    <PieceCard
                      piece={piece}
                      isExpanded={expandedPieceId === String(piece.id)}
                      onToggleExpand={() =>
                        setExpandedPieceId((currentValue) =>
                          currentValue === String(piece.id)
                            ? null
                            : String(piece.id),
                        )
                      }
                      onOpenPanel={openPanel}
                      onDelete={() =>
                        handleDeleteRequest(String(piece.id), piece.title)
                      }
                    />
                  </StaggeredBentoItem>
                ))
              ) : (
                <StaggeredBentoItem>
                  <ArchiveEmptyState
                    searchTerm={normalizedSearchTerm}
                    hasActiveFilters={hasActiveFilters}
                    onCreatePiece={() =>
                      openPanel(
                        null,
                        ARCHIVE_TABS.DETAILS,
                        normalizedSearchTerm,
                      )
                    }
                    onResetFilters={resetFilters}
                  />
                </StaggeredBentoItem>
              )}
            </StaggeredBentoContainer>
          </StaggeredBentoItem>
        </StaggeredBentoContainer>

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
