/**
 * @file ArchiveManagement.tsx
 * @description Master view for the Sheet Music & Repertoire Archive.
 * Integrates global search, filtering, and triggers sliding editor panels.
 * Refactored to Enterprise 2026 standards: safe DOM mutations, i18n, and strict typing.
 * @module panel/archive/ArchiveManagement
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
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

import ConfirmModal from "../../shared/ui/ConfirmModal";
import { GlassCard } from "../../shared/ui/GlassCard";
import { Input } from "../../shared/ui/Input";
import { Button } from "../../shared/ui/Button";

import PieceCard from "./components/PieceCard";
import ArchiveEditorPanel from "./components/ArchiveEditorPanel";
import { useArchiveData } from "./hooks/useArchiveData";
import type { EnrichedPiece } from "./types/archive.dto";
import { getArchiveEpochOptions } from "./constants/archiveEpochs";

import { useBodyScrollLock } from "../../shared/lib/hooks/useBodyScrollLock";
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

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <header className="relative pt-8 mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                <Library
                  size={12}
                  className="text-[#002395]"
                  aria-hidden="true"
                />
                <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                  {t("archive.dashboard.subtitle")}
                </p>
              </div>
              <h1
                className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                {t("archive.dashboard.title")}{" "}
                <span className="italic text-[#002395] font-bold">
                  {t("archive.dashboard.title_highlight")}
                </span>
                .
              </h1>
            </div>
            <Button
              variant="primary"
              onClick={() => openPanel()}
              leftIcon={<Plus size={16} aria-hidden="true" />}
              className="flex-shrink-0"
            >
              {t("archive.dashboard.new_piece")}
            </Button>
          </div>
        </motion.div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <GlassCard
          variant="dark"
          className="relative group hover:-translate-y-0.5 transition-transform"
        >
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#002395] rounded-full blur-[80px] opacity-40 pointer-events-none transition-transform duration-1000 group-hover:scale-125" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-300 mb-1.5 flex items-center gap-2">
                <Library size={12} /> {t("archive.dashboard.stats_total")}
              </p>
              <p className="text-4xl font-black text-white tracking-tight">
                {libraryStats.totalPieces}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard
          variant="solid"
          className="flex items-center justify-between hover:-translate-y-0.5 transition-transform"
        >
          <div>
            <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395]/70 mb-1.5">
              {t("archive.dashboard.stats_pdf")}
            </p>
            <p className="text-3xl font-black text-[#002395] tracking-tight">
              {libraryStats.withPdf}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
            <FileText size={24} className="text-[#002395]" aria-hidden="true" />
          </div>
        </GlassCard>

        <GlassCard
          variant="solid"
          className="flex items-center justify-between hover:-translate-y-0.5 transition-transform"
        >
          <div>
            <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-emerald-600/70 mb-1.5">
              {t("archive.dashboard.stats_audio")}
            </p>
            <p className="text-3xl font-black text-emerald-700 tracking-tight">
              {libraryStats.totalAudio}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
            <Headphones
              size={24}
              className="text-emerald-600"
              aria-hidden="true"
            />
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-8">
        <div className="sm:col-span-5">
          <Input
            variant="glass"
            leftIcon={<Search size={16} />}
            type="text"
            placeholder={t("archive.dashboard.search_placeholder")}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="relative sm:col-span-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Filter size={16} className="text-stone-400" />
          </div>
          <select
            value={composerFilter}
            onChange={(event) => setComposerFilter(event.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all font-bold appearance-none cursor-pointer"
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
            <Clock size={16} className="text-stone-400" />
          </div>
          <select
            value={epochFilter}
            onChange={(event) => setEpochFilter(event.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all font-bold appearance-none cursor-pointer"
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

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-28 bg-stone-100/50 rounded-[2rem] w-full border border-white/50"
              />
            ))}
          </div>
        ) : displayPieces.length > 0 ? (
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GlassCard className="p-16 flex flex-col items-center justify-center text-center">
              <Layers
                size={48}
                className="mb-4 text-stone-300 opacity-50"
                aria-hidden="true"
              />
              <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">
                {t("archive.dashboard.empty_state")}
              </span>

              {searchTerm ? (
                <div className="flex flex-col items-center gap-3 mt-2">
                  <span className="text-xs text-stone-400 max-w-sm">
                    {t("archive.dashboard.not_found")} "{searchTerm}".
                  </span>
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
                <span className="text-xs text-stone-400 max-w-sm">
                  {t("archive.dashboard.empty_hint")}
                </span>
              )}
            </GlassCard>
          </motion.div>
        )}
      </div>

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
  );
}
