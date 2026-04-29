/**
 * @file ArchiveManagement.tsx
 * @description Master view for the Sheet Music & Repertoire Archive.
 * Integrates global search, filtering, and triggers sliding editor panels.
 * @architecture Enterprise SaaS 2026
 * @module panel/archive/ArchiveManagement
 */

import React, { useState, useCallback, useEffect, useRef, useDeferredValue } from "react";
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
import { Select } from "@/shared/ui/primitives/Select";
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

  const deferredPieces = useDeferredValue(displayPieces);

  const closeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

        {/* ── Header ── */}
        <PageHeader
          size="standard"
          roleText={t("archive.dashboard.subtitle", "Biblioteka nut")}
          title={t("archive.dashboard.title", "Repertuar")}
          titleHighlight={t("archive.dashboard.title_highlight", "i Archiwum")}
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

        {/* ── Mobile CTA ── */}
        <div className="md:hidden">
          <Button
            variant="primary"
            fullWidth
            onClick={() => openPanel()}
            leftIcon={<Plus size={16} aria-hidden="true" />}
          >
            {t("archive.dashboard.new_piece", "Dodaj utwór")}
          </Button>
        </div>

        {/* ── Library stats ── */}
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

        {/* ── Filters ── */}
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
          <div className="sm:col-span-4">
            <Select
              leftIcon={<Filter size={16} />}
              value={composerFilter}
              onChange={(event) => setComposerFilter(event.target.value)}
            >
              <option value="">{t("archive.dashboard.filter_composer")}</option>
              {composers.map((composer) => (
                <option key={composer.id} value={composer.id}>
                  {composer.last_name} {composer.first_name || ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-3">
            <Select
              leftIcon={<Clock size={16} />}
              value={epochFilter}
              onChange={(event) => setEpochFilter(event.target.value)}
            >
              <option value="">{t("archive.dashboard.filter_epoch")}</option>
              {epochOptions.map((epoch) => (
                <option key={epoch.value} value={epoch.value}>
                  {epoch.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* ── Piece list ── */}
        <StaggeredBentoContainer className="grid grid-cols-1 gap-4">
          {deferredPieces.length > 0 ? (
            deferredPieces.map((piece) => (
              <StaggeredBentoItem key={piece.id}>
                <PieceCard
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
              </StaggeredBentoItem>
            ))
          ) : (
            <StaggeredBentoItem>
              <GlassCard
                variant="light"
                padding="lg"
                isHoverable={false}
                className="flex flex-col items-center justify-center gap-4 text-center"
              >
                <div
                  className="rounded-full border border-ethereal-incense/15 bg-ethereal-alabaster/70 p-4 text-ethereal-graphite/55"
                  aria-hidden="true"
                >
                  <Layers size={32} />
                </div>
                <div className="space-y-2">
                  <Eyebrow color="muted">
                    {t("archive.dashboard.empty_state")}
                  </Eyebrow>
                  {searchTerm ? (
                    <>
                      <Text color="graphite" className="mx-auto max-w-sm">
                        {t("archive.dashboard.not_found")} „{searchTerm}".
                      </Text>
                      <Button
                        variant="secondary"
                        onClick={() => openPanel(null, ARCHIVE_TABS.DETAILS, searchTerm)}
                        leftIcon={<Plus size={14} aria-hidden="true" />}
                        className="mt-2"
                      >
                        {t("archive.dashboard.add_piece")} {searchTerm}
                      </Button>
                    </>
                  ) : (
                    <Text color="graphite" className="mx-auto max-w-sm">
                      {t("archive.dashboard.empty_hint")}
                    </Text>
                  )}
                </div>
              </GlassCard>
            </StaggeredBentoItem>
          )}
        </StaggeredBentoContainer>

        {/* ── Editor panel ── */}
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

        {/* ── Delete confirm ── */}
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
