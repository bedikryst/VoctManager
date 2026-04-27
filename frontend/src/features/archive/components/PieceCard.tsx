/**
 * @file PieceCard.tsx
 * @description Expandable UI component representing a single repertoire piece.
 * Consumes enriched piece data to display metadata, composers, and assigned audio tracks.
 * Refactored to Enterprise 2026 standards with Ethereal kinematics and "No-Raw-HTML" mandate.
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
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";

interface PieceCardProps {
  piece: EnrichedPiece;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenPanel: (piece: EnrichedPiece, tab: "DETAILS" | "TRACKS") => void;
  onDelete: () => void;
}

const EPOCH_COLORS: Record<string, string> = {
  MED: "bg-ethereal-graphite/10 text-ethereal-graphite border-ethereal-graphite/20",
  REN: "bg-ethereal-sage/10 text-ethereal-sage border-ethereal-sage/20",
  BAR: "bg-ethereal-gold/10 text-ethereal-gold border-ethereal-gold/20",
  CLA: "bg-ethereal-amethyst/10 text-ethereal-amethyst border-ethereal-amethyst/20",
  ROM: "bg-ethereal-crimson/10 text-ethereal-crimson border-ethereal-crimson/20",
  M20: "bg-ethereal-ink/10 text-ethereal-ink border-ethereal-ink/20",
  CON: "bg-ethereal-marble/10 text-ethereal-marble border-ethereal-marble/20",
  POP: "bg-ethereal-parchment/30 text-ethereal-ink border-ethereal-parchment/50",
  FOLK: "bg-ethereal-incense/10 text-ethereal-incense border-ethereal-incense/20",
};

const getEpochColor = (epochId?: string | null): string => {
  return (
    EPOCH_COLORS[epochId || ""] || "bg-ethereal-alabaster/50 text-ethereal-graphite border-ethereal-incense/20"
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
      variant="ethereal"
      className={`p-0 overflow-hidden transition-all duration-500 border ${
        isExpanded
          ? "border-ethereal-gold/30 shadow-glass-ethereal"
          : "border-ethereal-incense/20 hover:border-ethereal-gold/20 hover:-translate-y-0.5 hover:shadow-glass-ethereal-hover"
      }`}
    >
      <div
        className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer hover:bg-ethereal-alabaster/40 transition-colors relative z-10"
        onClick={onToggleExpand}
      >
        <div className="flex items-start gap-4 md:gap-5">
          <div className="w-12 h-12 rounded-2xl bg-ethereal-alabaster/80 border border-ethereal-incense/20 flex items-center justify-center flex-shrink-0 text-ethereal-gold shadow-sm">
            <Music size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <Heading as="h3" size="2xl" color="default" className="tracking-tight">
                {piece.title}
              </Heading>
              {piece.epoch && (
                <Text
                  as="span"
                  className={`text-[8px] font-bold antialiased uppercase tracking-widest px-2 py-1 rounded-lg border font-sans shadow-sm ${getEpochColor(
                    piece.epoch,
                  )}`}
                >
                  {getEpochLabel(piece.epoch)}
                </Text>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 text-ethereal-graphite">
              <Eyebrow color="inherit" className="!mb-0">
                {composer
                  ? `${composer.first_name || ""} ${composer.last_name}`.trim()
                  : t("archive.card.traditional_unknown", "Tradycyjny / Nieznany")}
              </Eyebrow>
              {piece.composition_year && (
                <Eyebrow color="inherit" className="!mb-0 flex items-center gap-1.5 border-l border-ethereal-incense/30 pl-3">
                  <Clock size={12} aria-hidden="true" /> {piece.composition_year}
                </Eyebrow>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-2.5">
              {piece.voicing && (
                <Eyebrow className="!mb-0 px-2 py-1 border border-ethereal-incense/20 bg-ethereal-alabaster/60 backdrop-blur-sm rounded-md shadow-sm">
                  🎤 {piece.voicing}
                </Eyebrow>
              )}
              {piece.estimated_duration && (
                <Eyebrow className="!mb-0 px-2 py-1 border border-ethereal-incense/20 bg-ethereal-alabaster/60 backdrop-blur-sm rounded-md flex items-center gap-1 shadow-sm">
                  <Clock size={10} aria-hidden="true" />{" "}
                  {formatDuration(
                    piece.estimated_duration,
                    minutesLabel,
                    secondsLabel,
                  )}
                </Eyebrow>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="hidden md:flex gap-2">
            {piece.sheet_music && (
              <Eyebrow className="!mb-0 px-2.5 py-1.5 bg-ethereal-amethyst/10 text-ethereal-amethyst rounded-lg border border-ethereal-amethyst/20 shadow-sm flex items-center gap-1.5">
                <FileText size={10} /> PDF
              </Eyebrow>
            )}
            {pieceTracks.length > 0 && (
              <Eyebrow className="!mb-0 px-2.5 py-1.5 bg-ethereal-sage/10 text-ethereal-sage rounded-lg border border-ethereal-sage/20 shadow-sm flex items-center gap-1.5">
                <Headphones size={10} /> Audio ({pieceTracks.length})
              </Eyebrow>
            )}
          </div>
          <div className="text-ethereal-graphite bg-ethereal-alabaster/80 shadow-sm p-2 rounded-full border border-ethereal-incense/20 transition-transform duration-300">
            {isExpanded ? (
              <ChevronUp size={20} className="text-ethereal-gold" aria-hidden="true" />
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
            className="bg-ethereal-parchment/20 border-t border-ethereal-incense/20 overflow-hidden relative z-0"
          >
            <div className="p-6 md:p-8">
              <div className="flex flex-col lg:flex-row justify-between gap-8 mb-10">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div>
                    <Eyebrow className="mb-3 border-b border-ethereal-incense/20 pb-2">
                      {t("archive.card.metadata_title", "Metadane utworu")}
                    </Eyebrow>
                    <div className="space-y-2">
                      {piece.language && (
                        <Text size="sm">
                          <Text as="span" size="sm" className="font-bold antialiased text-ethereal-graphite text-[10px] uppercase tracking-widest w-24 inline-block">
                            {t("archive.card.fields.language", "Język")}:
                          </Text>{" "}
                          {piece.language}
                        </Text>
                      )}
                      {piece.arranger && (
                        <Text size="sm">
                          <Text as="span" size="sm" className="font-bold antialiased text-ethereal-graphite text-[10px] uppercase tracking-widest w-24 inline-block">
                            {t("archive.card.fields.arranger", "Aranżer")}:
                          </Text>{" "}
                          {piece.arranger}
                        </Text>
                      )}
                      {piece.voicing && (
                        <Text size="sm">
                          <Text as="span" size="sm" className="font-bold antialiased text-ethereal-graphite text-[10px] uppercase tracking-widest w-24 inline-block">
                            {t("archive.card.fields.voicing", "Obsada")}:
                          </Text>{" "}
                          {piece.voicing}
                        </Text>
                      )}
                      {piece.estimated_duration && (
                        <Text size="sm">
                          <Text as="span" size="sm" className="font-bold antialiased text-ethereal-graphite text-[10px] uppercase tracking-widest w-24 inline-block">
                            {t("archive.card.fields.duration", "Czas")}:
                          </Text>{" "}
                          {formatDuration(
                            piece.estimated_duration,
                            minutesLabel,
                            secondsLabel,
                          )}
                        </Text>
                      )}
                    </div>
                  </div>

                  <div>
                    <Eyebrow className="mb-3 border-b border-ethereal-incense/20 pb-2">
                      {t("archive.card.composer_title", "Kompozytor")}
                    </Eyebrow>
                    {composer ? (
                      <div>
                        <Text as="div" className="font-bold text-ethereal-ink text-base">
                          {composer.first_name} {composer.last_name}
                        </Text>
                        {(composer.birth_year || composer.death_year) && (
                          <Eyebrow className="!mb-0 mt-1 flex items-center gap-1">
                            <Text as="span" size="xs">
                              {composer.birth_year ? `* ${composer.birth_year}` : ""}
                            </Text>
                            <Text as="span" size="xs" className="mx-1 opacity-50">|</Text>
                            <Text as="span" size="xs">
                              {composer.death_year ? `† ${composer.death_year}` : ""}
                            </Text>
                          </Eyebrow>
                        )}
                      </div>
                    ) : (
                      <Text size="xs" className="italic text-ethereal-graphite">
                        {t("archive.card.traditional_unknown", "Tradycyjny / Nieznany")}
                      </Text>
                    )}

                    {piece.voice_requirements &&
                      piece.voice_requirements.length > 0 && (
                        <div className="mt-5">
                          <Eyebrow className="mb-2 border-b border-ethereal-incense/20 pb-1.5">
                            {t("archive.card.divisi_title", "Algorytm Divisi")}
                          </Eyebrow>
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            {piece.voice_requirements.map((requirement) => (
                              <Text
                                as="span"
                                key={requirement.id}
                                className="px-2.5 py-1 bg-ethereal-alabaster/60 border border-ethereal-gold/20 text-ethereal-gold text-[9px] font-bold antialiased uppercase tracking-widest rounded-md shadow-sm"
                              >
                                {(requirement as { voice_line_display?: string }).voice_line_display || requirement.voice_line}
                                : {requirement.quantity}
                              </Text>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[220px] border-t lg:border-t-0 border-ethereal-incense/20 pt-6 lg:pt-0">
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
                    className="w-full justify-center text-ethereal-crimson hover:text-red-600 hover:bg-ethereal-crimson/10 mt-2"
                  >
                    {t("archive.card.actions.delete", "Usuń utwór")}
                  </Button>
                </div>
              </div>

              {referenceLinks.length > 0 && (
                <div className="border-t border-ethereal-incense/20 pt-8 mb-8">
                  <div className="flex flex-wrap gap-3">
                    {referenceLinks.map((link) => (
                      <a
                        key={`${piece.id}-${link.platform}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-[10px] font-bold antialiased uppercase tracking-[0.15em] transition-colors border shadow-sm active:scale-95 ${
                          link.platform === "youtube"
                            ? "text-ethereal-crimson hover:text-red-700 bg-ethereal-alabaster hover:bg-ethereal-crimson/10 border-ethereal-crimson/20"
                            : "text-ethereal-sage hover:text-emerald-800 bg-ethereal-alabaster hover:bg-ethereal-sage/10 border-ethereal-sage/20"
                        }`}
                      >
                        {link.platform === "youtube" ? (
                          <Youtube size={16} />
                        ) : (
                          <Headphones size={16} />
                        )}
                        {link.platform === "youtube"
                          ? t("archive.card.reference.youtube", "Nagranie referencyjne YouTube")
                          : link.platform === "spotify"
                            ? t("archive.card.reference.spotify", "Nagranie referencyjne Spotify")
                            : t("archive.card.reference.generic", "Nagranie referencyjne")}
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
