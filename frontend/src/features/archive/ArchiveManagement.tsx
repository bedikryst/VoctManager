/**
 * @file ArchiveManagement.tsx
 * @description Master view for the Sheet Music & Repertoire Archive.
 * Integrates global search, filtering, and triggers sliding editor panels.
 * Refactored to Enterprise 2026 standards: safe DOM mutations, i18n, strict typing,
 * and Ethereal Theme kinematics.
 * @module panel/archive/ArchiveManagement
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Plus,
  FileText,
  Headphones,
  Search,
  Filter,
  Library,
  Clock,
  Layers,
} from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Input } from "@/shared/ui/primitives/Input";
import { Button } from "@/shared/ui/primitives/Button";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

import PieceCard from "./components/PieceCard";
import ArchiveEditorPanel from "./components/ArchiveEditorPanel";
import { useArchiveData } from "./hooks/useArchiveData";
import type { EnrichedPiece } from "./types/archive.dto";
import { getArchiveEpochOptions } from "./constants/archiveEpochs";

import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ARCHIVE_TABS, ArchiveTabId } from "./constants/archiveDomain";

export default function ArchiveManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const epochOptions = getArchiveEpochOptions(t);

  const {
    isLoading,
    isError,
    composers,
    voiceLines,
    libraryStats,
    displayPieces,
    searchTerm,
    setSearchTerm,
    composerFilter,
    setComposerFilter,
    epochFilter,
    setEpochFilter,
    pieceToDelete,
    setPieceToDelete,
    isDeleting,
    executeDelete,
    handleDeleteRequest,
  } = useArchiveData();

  const closeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ArchiveTabId>(
    ARCHIVE_TABS.DETAILS,
  );
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
      <div className="relative cursor-default pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <StaggeredBentoContainer className="space-y-6">
          <StaggeredBentoItem>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mb-2">
              <PageHeader
                roleText={t("archive.dashboard.subtitle", "Biblioteka nut")}
                title={t("archive.dashboard.title", "Repertuar")}
                titleHighlight={t("archive.dashboard.title_highlight", "i Archiwum")}
                size="standard"
              />
              <Button
                variant="primary"
                onClick={() => openPanel()}
                leftIcon={<Plus size={16} aria-hidden="true" />}
                className="flex-shrink-0"
              >
                {t("archive.dashboard.new_piece", "Dodaj utwór")}
              </Button>
            </div>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <GlassCard variant="ethereal" className="p-0 overflow-hidden border border-ethereal-incense/20">
                <MetricBlock
                  interactiveMode="glass"
                  label={t("archive.dashboard.stats_total")}
                  value={libraryStats.totalPieces}
                  icon={<Library />}
                  accentColor="default"
                />
              </GlassCard>

              <GlassCard variant="ethereal" className="p-0 overflow-hidden border border-ethereal-gold/30">
                <MetricBlock
                  interactiveMode="glass"
                  label={t("archive.dashboard.stats_pdf")}
                  value={libraryStats.withPdf}
                  icon={<FileText />}
                  accentColor="gold"
                />
              </GlassCard>

              <GlassCard variant="ethereal" className="p-0 overflow-hidden border border-ethereal-crimson/30">
                <MetricBlock
                  interactiveMode="glass"
                  label={t("archive.dashboard.stats_audio")}
                  value={libraryStats.totalAudio}
                  icon={<Headphones />}
                  accentColor="crimson"
                />
              </GlassCard>
            </div>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-5">
                <Input
                  leftIcon={<Search size={16} />}
                  type="search"
                  placeholder={t("archive.dashboard.search_placeholder")}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="relative sm:col-span-4">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Filter size={16} className="text-ethereal-graphite/50" aria-hidden="true" />
                </div>
                <select
                  value={composerFilter}
                  onChange={(event) => setComposerFilter(event.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-sm text-ethereal-ink bg-ethereal-alabaster/80 backdrop-blur-sm border border-ethereal-incense/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-ethereal-gold/20 focus:border-ethereal-gold/40 transition-all shadow-glass-ethereal font-bold appearance-none cursor-pointer"
                >
                  <option value="">{t("archive.dashboard.filter_composer")}</option>
                  {composers.map((composer) => (
                    <option key={composer.id} value={composer.id}>
                      {composer.last_name} {composer.first_name || ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative sm:col-span-3">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Clock size={16} className="text-ethereal-graphite/50" aria-hidden="true" />
                </div>
                <select
                  value={epochFilter}
                  onChange={(event) => setEpochFilter(event.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-sm text-ethereal-ink bg-ethereal-alabaster/80 backdrop-blur-sm border border-ethereal-incense/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-ethereal-gold/20 focus:border-ethereal-gold/40 transition-all shadow-glass-ethereal font-bold appearance-none cursor-pointer"
                >
                  <option value="">{t("archive.dashboard.filter_epoch")}</option>
                  {epochOptions.map((epoch) => (
                    <option key={epoch.value} value={epoch.value}>
                      {epoch.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="grid grid-cols-1 gap-4">
              {displayPieces.length > 0 ? (
                displayPieces.map((piece) => (
                  <PieceCard
                    key={piece.id}
                    piece={piece}
                    isExpanded={expandedPieceId === String(piece.id)}
                    onToggleExpand={() =>
                      setExpandedPieceId(
                        expandedPieceId === String(piece.id)
                          ? null
                          : String(piece.id),
                      )
                    }
                    onOpenPanel={openPanel}
                    onDelete={() =>
                      handleDeleteRequest(String(piece.id), piece.title)
                    }
                  />
                ))
              ) : (
                <GlassCard variant="ethereal" className="p-16 flex flex-col items-center justify-center text-center">
                  <Layers
                    size={48}
                    className="mb-4 text-ethereal-graphite opacity-30"
                    aria-hidden="true"
                  />
                  <Eyebrow className="mb-2">
                    {t("archive.dashboard.empty_state")}
                  </Eyebrow>

                  {searchTerm ? (
                    <div className="flex flex-col items-center gap-3 mt-2">
                      <Text size="sm" color="graphite" className="max-w-sm">
                        {t("archive.dashboard.not_found")} "{searchTerm}".
                      </Text>
                      <Button
                        variant="outline"
                        onClick={() =>
                          openPanel(null, ARCHIVE_TABS.DETAILS, searchTerm)
                        }
                        leftIcon={<Plus size={14} aria-hidden="true" />}
                        className="mt-2"
                      >
                        {t("archive.dashboard.add_piece")} {searchTerm}
                      </Button>
                    </div>
                  ) : (
                    <Text size="sm" color="graphite" className="max-w-sm">
                      {t("archive.dashboard.empty_hint")}
                    </Text>
                  )}
                </GlassCard>
              )}
            </div>
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
            "Ten krok usunie bezpowrotnie metadane utworu...",
          )}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPieceToDelete(null)}
          isLoading={isDeleting}
        />
      </div>
    </PageTransition>
  );
}
