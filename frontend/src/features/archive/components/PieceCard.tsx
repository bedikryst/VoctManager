/**
 * @file PieceCard.tsx
 * @description Expandable UI component representing a single repertoire piece.
 * Consumes enriched piece data to display metadata, composers, and assigned audio tracks.
 * @module panel/archive/components/PieceCard
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Edit2,
  Trash2,
  Music,
  FileText,
  Headphones,
  ChevronDown,
  ChevronUp,
  Clock,
  Youtube,
} from "lucide-react";

import type { EnrichedPiece } from "../types/archive.dto";
import { getArchiveEpochOptions } from "../constants/archiveEpochs";
import { getReferenceRecordingLinks } from "@/features/archive/constants/referenceRecordings";
import { GlassCard } from "@ui/composites/GlassCard";
import { Button } from "@ui/primitives/Button";

interface PieceCardProps {
  piece: EnrichedPiece;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenPanel: (piece: EnrichedPiece, tab: "DETAILS" | "TRACKS") => void;
  onDelete: () => void;
}

const EPOCH_COLORS: Record<string, string> = {
  MED: "bg-stone-100 text-stone-700 border-stone-200",
  REN: "bg-amber-50 text-amber-700 border-amber-200",
  BAR: "bg-yellow-50 text-yellow-800 border-yellow-300",
  CLA: "bg-blue-50 text-blue-700 border-blue-200",
  ROM: "bg-rose-50 text-rose-700 border-rose-200",
  M20: "bg-purple-50 text-purple-700 border-purple-200",
  CON: "bg-teal-50 text-teal-700 border-teal-200",
  POP: "bg-pink-50 text-pink-700 border-pink-200",
  FOLK: "bg-green-50 text-green-700 border-green-200",
};

const getEpochColor = (epochId?: string | null): string => {
  return (
    EPOCH_COLORS[epochId || ""] || "bg-stone-50 text-stone-500 border-stone-200"
  );
};

const formatDuration = (
  totalSeconds: number | null | undefined,
  minutesLabel: string,
  secondsLabel: string,
): string | null => {
  if (!totalSeconds) {
    return null;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes > 0 ? `${minutes} ${minutesLabel}` : ""} ${seconds > 0 ? `${seconds} ${secondsLabel}` : ""}`.trim();
};

export default function PieceCard({
  piece,
  isExpanded,
  onToggleExpand,
  onOpenPanel,
  onDelete,
}: PieceCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const epochOptions = getArchiveEpochOptions(t);
  const composer = piece.composer;
  const pieceTracks = piece.tracks || [];
  const referenceLinks = getReferenceRecordingLinks(piece);
  const minutesLabel = t("archive.form.units.minutes_short", "min");
  const secondsLabel = t("archive.form.units.seconds_short", "sek");

  const getEpochLabel = (value: string) =>
    epochOptions.find((epoch) => epoch.value === value)?.label || value;

  return (
    <GlassCard
      noPadding
      className={`transition-all duration-300 ${isExpanded ? "border-brand/30 shadow-[0_10px_30px_rgba(0,35,149,0.05)]" : "hover:border-brand/20 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)]"}`}
    >
      <div
        className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer hover:bg-white/40 transition-colors relative z-10"
        onClick={onToggleExpand}
      >
        <div className="flex items-start gap-4 md:gap-5">
          <div className="w-12 h-12 rounded-2xl bg-white border border-stone-100 flex items-center justify-center flex-shrink-0 text-brand shadow-sm">
            <Music size={20} aria-hidden="true" />
          </div>
          <div>
            <h3
              className="text-xl md:text-2xl font-bold text-stone-900 flex items-center gap-2.5 tracking-tight"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              {piece.title}
              {piece.epoch && (
                <span
                  className={`text-[8px] font-bold antialiased uppercase tracking-widest px-2 py-1 rounded-lg border font-sans shadow-sm ${getEpochColor(piece.epoch)}`}
                >
                  {getEpochLabel(piece.epoch)}
                </span>
              )}
            </h3>

            <div className="flex items-center gap-3 text-[10px] font-bold antialiased text-stone-500 uppercase tracking-widest mt-1">
              <span>
                {composer
                  ? `${composer.first_name || ""} ${composer.last_name}`.trim()
                  : t(
                      "archive.card.traditional_unknown",
                      "Tradycyjny / Nieznany",
                    )}
              </span>
              {piece.composition_year && (
                <span className="flex items-center gap-1.5 border-l border-stone-300 pl-3">
                  <Clock size={12} aria-hidden="true" />{" "}
                  {piece.composition_year}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-2.5 text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
              {piece.voicing && (
                <span className="px-2 py-1 border border-stone-200/80 bg-white/60 backdrop-blur-sm rounded-md shadow-sm">
                  🎤 {piece.voicing}
                </span>
              )}
              {piece.estimated_duration && (
                <span className="px-2 py-1 border border-stone-200/80 bg-white/60 backdrop-blur-sm rounded-md flex items-center gap-1 shadow-sm">
                  <Clock size={10} aria-hidden="true" />{" "}
                  {formatDuration(
                    piece.estimated_duration,
                    minutesLabel,
                    secondsLabel,
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="hidden md:flex gap-2">
            {piece.sheet_music && (
              <span className="px-2.5 py-1.5 bg-blue-50 text-brand text-[9px] tracking-widest font-bold antialiased uppercase rounded-lg border border-blue-100 shadow-sm flex items-center gap-1.5">
                <FileText size={10} /> PDF
              </span>
            )}
            {pieceTracks.length > 0 && (
              <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-[9px] tracking-widest font-bold antialiased uppercase rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1.5">
                <Headphones size={10} /> Audio ({pieceTracks.length})
              </span>
            )}
          </div>
          <div className="text-stone-400 bg-white shadow-sm p-2 rounded-full border border-stone-100 transition-transform duration-300">
            {isExpanded ? (
              <ChevronUp size={20} className="text-brand" aria-hidden="true" />
            ) : (
              <ChevronDown size={20} aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-stone-50/40 border-t border-white/60 overflow-hidden relative z-0"
          >
            <div className="p-6 md:p-8">
              <div className="flex flex-col lg:flex-row justify-between gap-8 mb-10">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-3 border-b border-stone-200/60 pb-2">
                      {t("archive.card.metadata_title", "Metadane utworu")}
                    </h4>
                    <div className="space-y-2 text-sm text-stone-700 font-medium">
                      {piece.language && (
                        <p>
                          <span className="font-bold antialiased text-stone-400 text-[10px] uppercase tracking-widest w-24 inline-block">
                            {t("archive.card.fields.language", "Język")}:
                          </span>{" "}
                          {piece.language}
                        </p>
                      )}
                      {piece.arranger && (
                        <p>
                          <span className="font-bold antialiased text-stone-400 text-[10px] uppercase tracking-widest w-24 inline-block">
                            {t("archive.card.fields.arranger", "Aranżer")}:
                          </span>{" "}
                          {piece.arranger}
                        </p>
                      )}
                      {piece.voicing && (
                        <p>
                          <span className="font-bold antialiased text-stone-400 text-[10px] uppercase tracking-widest w-24 inline-block">
                            {t("archive.card.fields.voicing", "Obsada")}:
                          </span>{" "}
                          {piece.voicing}
                        </p>
                      )}
                      {piece.estimated_duration && (
                        <p>
                          <span className="font-bold antialiased text-stone-400 text-[10px] uppercase tracking-widest w-24 inline-block">
                            {t("archive.card.fields.duration", "Czas")}:
                          </span>{" "}
                          {formatDuration(
                            piece.estimated_duration,
                            minutesLabel,
                            secondsLabel,
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-3 border-b border-stone-200/60 pb-2">
                      {t("archive.card.composer_title", "Kompozytor")}
                    </h4>
                    {composer ? (
                      <div className="text-sm text-stone-700">
                        <p className="font-bold text-stone-900 text-base">
                          {composer.first_name} {composer.last_name}
                        </p>
                        {(composer.birth_year || composer.death_year) && (
                          <p className="mt-1 flex items-center gap-1 text-stone-500 text-[11px] font-bold antialiased tracking-widest uppercase">
                            <span>
                              {composer.birth_year
                                ? `* ${composer.birth_year}`
                                : ""}
                            </span>
                            <span className="mx-1 opacity-50">|</span>
                            <span>
                              {composer.death_year
                                ? `† ${composer.death_year}`
                                : ""}
                            </span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 italic">
                        {t(
                          "archive.card.traditional_unknown",
                          "Tradycyjny / Nieznany",
                        )}
                      </p>
                    )}

                    {piece.voice_requirements &&
                      piece.voice_requirements.length > 0 && (
                        <div className="mt-5">
                          <h4 className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 border-b border-stone-200/60 pb-1.5">
                            {t("archive.card.divisi_title", "Algorytm Divisi")}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            {piece.voice_requirements.map((requirement) => (
                              <span
                                key={requirement.id}
                                className="px-2.5 py-1 bg-white/60 border border-brand/20 text-brand text-[9px] font-bold antialiased uppercase tracking-widest rounded-md shadow-sm"
                              >
                                {(
                                  requirement as { voice_line_display?: string }
                                ).voice_line_display || requirement.voice_line}
                                : {requirement.quantity}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[220px] border-t lg:border-t-0 border-stone-200/60 pt-6 lg:pt-0">
                  <Button
                    variant="outline"
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                      event.stopPropagation();
                      onOpenPanel(piece, "DETAILS");
                    }}
                    leftIcon={<Edit2 size={14} />}
                    className="w-full justify-center"
                  >
                    {t("archive.card.actions.edit", "Edytuj metadane")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                      event.stopPropagation();
                      onOpenPanel(piece, "TRACKS");
                    }}
                    leftIcon={<Headphones size={14} />}
                    className="w-full justify-center"
                  >
                    {t("archive.card.actions.manage_audio", "Zarządzaj audio")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                      event.stopPropagation();
                      onDelete();
                    }}
                    leftIcon={<Trash2 size={14} />}
                    className="w-full justify-center text-red-500 hover:text-red-600 hover:bg-red-50 mt-2"
                  >
                    {t("archive.card.actions.delete", "Usuń utwór")}
                  </Button>
                </div>
              </div>

              {referenceLinks.length > 0 && (
                <div className="border-t border-stone-200/60 pt-8 mb-8">
                  <div className="flex flex-wrap gap-3">
                    {referenceLinks.map((link) => (
                      <a
                        key={`${piece.id}-${link.platform}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-[10px] font-bold antialiased uppercase tracking-[0.15em] transition-colors border shadow-sm active:scale-95 ${link.platform === "youtube" ? "text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border-red-100" : "text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 border-emerald-100"}`}
                      >
                        {link.platform === "youtube" ? (
                          <Youtube size={16} />
                        ) : (
                          <Headphones size={16} />
                        )}
                        {link.platform === "youtube"
                          ? t(
                              "archive.card.reference.youtube",
                              "Nagranie referencyjne YouTube",
                            )
                          : link.platform === "spotify"
                            ? t(
                                "archive.card.reference.spotify",
                                "Nagranie referencyjne Spotify",
                              )
                            : t(
                                "archive.card.reference.generic",
                                "Nagranie referencyjne",
                              )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
