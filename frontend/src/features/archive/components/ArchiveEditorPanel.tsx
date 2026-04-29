/**
 * @file ArchiveEditorPanel.tsx
 * @description Slide-over panel for editing repertoire metadata and managing audio tracks.
 * Integrates dirty-state interception to prevent accidental data loss during active editing.
 * @architecture Enterprise SaaS 2026
 * @module panel/archive/components/ArchiveEditorPanel
 */

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, FileText, Headphones } from "lucide-react";

import PieceDetailsForm from "./PieceDetailsForm";
import TrackUploadManager from "./TrackUploadManager";
import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { Button } from "@ui/primitives/Button";
import { Heading } from "@ui/primitives/typography";
import type { Composer, VoiceLineOption } from "@/shared/types";
import type { EnrichedPiece } from "../types/archive.dto";
import { ArchiveTabId } from "../constants/archiveDomain";

interface ArchiveEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  piece: EnrichedPiece | null;
  activeTab: ArchiveTabId;
  onTabChange: (tabId: ArchiveTabId) => void;
  composers: Composer[];
  voiceLines: VoiceLineOption[];
  initialSearchContext?: string;
}

export default function ArchiveEditorPanel({
  isOpen,
  onClose,
  piece,
  activeTab,
  onTabChange,
  composers,
  voiceLines,
  initialSearchContext,
}: ArchiveEditorPanelProps): React.ReactPortal | null {
  const { t } = useTranslation();
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAttemptClose = useCallback(() => {
    if (isFormDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [isFormDirty, onClose]);

  const forceClose = useCallback(() => {
    setIsFormDirty(false);
    setShowExitConfirm(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        if (showExitConfirm) {
          setShowExitConfirm(false);
        } else {
          handleAttemptClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showExitConfirm, handleAttemptClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleAttemptClose}
            className="fixed inset-0 bg-ethereal-ink/20 backdrop-blur-sm z-focus-trap"
            aria-hidden="true"
          />

          <motion.div
            initial={{ right: "-100%" }}
            animate={{ right: 0 }}
            exit={{ right: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[600px] lg:w-[800px] xl:w-[900px] bg-ethereal-parchment shadow-glass-solid z-toast flex flex-col border-l border-ethereal-incense/20"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center px-6 md:px-10 pt-6 md:pt-10 pb-6 flex-shrink-0 z-20">
              <Heading as="h2" size="4xl" color="default" className="tracking-tight font-serif">
                {piece
                  ? piece.title
                  : t("archive.editor.new_piece", "Nowy Utwór")}
              </Heading>
              <Button
                variant="ghost"
                onClick={handleAttemptClose}
                aria-label={t("common.actions.close", "Zamknij")}
                className="text-ethereal-graphite hover:text-ethereal-ink border border-ethereal-incense/20 hover:border-ethereal-incense/40 bg-ethereal-alabaster/60 hover:bg-ethereal-alabaster p-3 rounded-2xl"
              >
                <X size={20} aria-hidden="true" />
              </Button>
            </div>

            {piece && (
              <div className="px-6 md:px-10 pb-6 flex-shrink-0 relative z-30">
                <div className="inline-flex items-center p-1.5 bg-ethereal-incense/10 backdrop-blur-xl border border-ethereal-incense/20 rounded-2xl shadow-glass-ethereal">
                  <button
                    onClick={() => onTabChange("DETAILS")}
                    className={`px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
                      activeTab === "DETAILS"
                        ? "bg-ethereal-alabaster text-ethereal-gold shadow-glass-ethereal border border-ethereal-incense/20"
                        : "text-ethereal-graphite hover:text-ethereal-ink hover:bg-ethereal-alabaster/40 border border-transparent"
                    }`}
                  >
                    <FileText size={14} aria-hidden="true" />{" "}
                    {t("archive.editor.tabs.details", "Metadane")}
                  </button>
                  <button
                    onClick={() => onTabChange("TRACKS")}
                    className={`px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
                      activeTab === "TRACKS"
                        ? "bg-ethereal-alabaster text-ethereal-gold shadow-glass-ethereal border border-ethereal-incense/20"
                        : "text-ethereal-graphite hover:text-ethereal-ink hover:bg-ethereal-alabaster/40 border border-transparent"
                    }`}
                  >
                    <Headphones size={14} aria-hidden="true" />{" "}
                    {t("archive.editor.tabs.tracks", "Ścieżki MP3")}
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 md:px-10 md:pb-10 relative">
              <div className="max-w-4xl mx-auto">
                {activeTab === "DETAILS" && (
                  <PieceDetailsForm
                    piece={piece}
                    composers={composers}
                    voiceLines={voiceLines}
                    initialSearchContext={initialSearchContext}
                    onDirtyStateChange={setIsFormDirty}
                    onSuccess={(
                      _updatedPiece: EnrichedPiece,
                      actionType: "SAVE_AND_ADD" | "SAVE_AND_CLOSE",
                    ) => {
                      setIsFormDirty(false);
                      if (actionType === "SAVE_AND_CLOSE") {
                        onClose();
                      }
                    }}
                  />
                )}
                {activeTab === "TRACKS" && piece && (
                  <TrackUploadManager
                    pieceId={piece.id}
                    voiceLines={voiceLines}
                  />
                )}
              </div>
            </div>

            <ConfirmModal
              isOpen={showExitConfirm}
              title={t(
                "archive.editor.unsaved_title",
                "Masz niezapisane zmiany!",
              )}
              description={t(
                "archive.editor.unsaved_desc",
                "Wprowadziłeś zmiany w formularzu, które nie zostały jeszcze zapisane w bazie. Czy na pewno chcesz zamknąć panel? Niezapisane dane przepadną.",
              )}
              onConfirm={forceClose}
              onCancel={() => setShowExitConfirm(false)}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
