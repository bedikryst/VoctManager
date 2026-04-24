import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  FileText,
  Youtube,
  Lock,
  ChevronDown,
  ChevronUp,
  User,
  Headphones,
  Music2,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Heading,
  Text,
  Eyebrow,
  Emphasis,
} from "@/shared/ui/primitives/typography";
import { getReferenceRecordingLinks } from "@/features/archive/constants/referenceRecordings";
import { EducationalAudioPlayer } from "./EducationalAudioPlayer";
import { PieceDivisiRoster } from "./PieceDivisiRoster";
import { PieceLyricsViewer } from "./PieceLyricsViewer";
import type { MaterialsPiece } from "../types/materials.dto";

interface PieceMaterialCardProps {
  piece: MaterialsPiece;
  order: number;
  isEncored: boolean;
  isArchived: boolean;
}

export const PieceMaterialCard = ({
  piece,
  order,
  isEncored,
  isArchived,
}: PieceMaterialCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const referenceLinks = getReferenceRecordingLinks({
    reference_recording: undefined,
    reference_recording_youtube: piece.reference_recording_youtube || undefined,
    reference_recording_spotify: piece.reference_recording_spotify || undefined,
  });

  const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const target = e.currentTarget;
    document.querySelectorAll("audio").forEach((el) => {
      if (el !== target) el.pause();
    });
  };

  return (
    <motion.div layout>
      <GlassCard
        padding="none"
        variant={isArchived ? "dark" : "ethereal"}
        className={`transition-all duration-300 overflow-hidden ${
          isExpanded
            ? "border-ethereal-amethyst shadow-glass-ethereal"
            : "hover:shadow-glass-ethereal-hover"
        } ${isArchived ? "grayscale opacity-80" : ""}`}
      >
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left hover:bg-ethereal-marble/20 transition-colors focus:outline-none"
          aria-expanded={isExpanded}
        >
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl bg-ethereal-alabaster flex items-center justify-center flex-shrink-0 shadow-glass-solid ${
                isArchived ? "text-ethereal-graphite" : "text-ethereal-ink"
              }`}
            >
              <Heading size="3xl" weight="medium">
                {String(order)}
              </Heading>
            </div>
            <div>
              <Heading size="3xl" weight="medium">
                {piece.title}
              </Heading>
              <Eyebrow color="muted" className="mt-1">
                {piece.composer
                  ? `${piece.composer.first_name || ""} ${piece.composer.last_name}`.trim()
                  : t("materials.piece.traditional", "Tradycyjny / Nieznany")}
              </Eyebrow>
              {piece.my_casting && (
                <div className="mt-2 inline-flex bg-ethereal-sage/10 px-2 py-0.5 rounded border border-ethereal-sage/20">
                  <Eyebrow color="default" className="text-ethereal-incense">
                    {t("materials.piece.you_sing", "Śpiewasz:")}{" "}
                    {piece.my_casting.voice_line_display ||
                      piece.my_casting.voice_line}
                  </Eyebrow>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0">
            <div className="flex gap-2">
              {isEncored && (
                <div className="px-2.5 py-1.5 bg-ethereal-amethyst/10 rounded-lg border border-ethereal-amethyst/20">
                  <Eyebrow className="text-ethereal-amethyst">
                    {t("materials.piece.encore_badge", "Bis")}
                  </Eyebrow>
                </div>
              )}
              {!isArchived && piece.sheet_music && (
                <div className="px-2.5 py-1.5 bg-ethereal-sage/10 rounded-lg border border-ethereal-sage/20">
                  <Eyebrow className="text-ethereal-incense">
                    {t("materials.piece.pdf_badge", "PDF")}
                  </Eyebrow>
                </div>
              )}
              {!isArchived && piece.tracks.length > 0 && (
                <div className="px-2.5 py-1.5 bg-ethereal-gold/10 rounded-lg border border-ethereal-gold/20">
                  <Eyebrow className="text-ethereal-gold">
                    {t("materials.piece.audio_badge", "Audio")}
                  </Eyebrow>
                </div>
              )}
              {isArchived && (
                <div className="px-2.5 py-1.5 bg-ethereal-marble/40 rounded-lg border border-ethereal-marble flex items-center gap-1.5">
                  <Lock
                    size={12}
                    className="text-ethereal-graphite"
                    aria-hidden="true"
                  />
                  <Eyebrow color="muted">
                    {t("materials.piece.locked_badge", "Chronione")}
                  </Eyebrow>
                </div>
              )}
            </div>

            <div className="text-ethereal-graphite bg-ethereal-alabaster shadow-glass-solid p-1.5 rounded-full border border-ethereal-marble transition-transform duration-300">
              {isExpanded ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="bg-ethereal-parchment/30 border-t border-ethereal-marble overflow-hidden"
            >
              {isArchived ? (
                <div className="p-8 md:p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-ethereal-alabaster border border-ethereal-marble rounded-full flex items-center justify-center mb-4 shadow-glass-solid">
                    <Lock
                      size={24}
                      className="text-ethereal-graphite"
                      aria-hidden="true"
                    />
                  </div>
                  <Eyebrow color="muted" className="mb-2">
                    {t(
                      "materials.piece.access_locked_title",
                      "Dostęp Zablokowany",
                    )}
                  </Eyebrow>
                  <Text className="text-ethereal-graphite max-w-md">
                    {t(
                      "materials.piece.access_locked_desc",
                      "Projekt został zakończony. Materiały ćwiczeniowe oraz partytury nie są już dostępne ze względu na ochronę własności intelektualnej i aranżacji dyrygenta.",
                    )}
                  </Text>
                </div>
              ) : (
                <div className="p-5 md:p-8 space-y-8">
                  <div className="flex flex-wrap gap-4 pb-6 border-b border-ethereal-marble">
                    {piece.sheet_music ? (
                      <a
                        href={piece.sheet_music}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-3.5 bg-ethereal-sage hover:bg-ethereal-sage/90 rounded-xl transition-all shadow-glass-solid active:scale-95"
                      >
                        <Download
                          size={16}
                          className="text-white"
                          aria-hidden="true"
                        />
                        <Eyebrow color="default" className="text-white">
                          {t(
                            "materials.piece.download_pdf",
                            "Pobierz Partyturę (PDF)",
                          )}
                        </Eyebrow>
                      </a>
                    ) : (
                      <div className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-3.5 bg-ethereal-marble/40 border border-ethereal-marble rounded-xl cursor-not-allowed">
                        <FileText
                          size={16}
                          className="text-ethereal-graphite"
                          aria-hidden="true"
                        />
                        <Eyebrow color="muted">
                          {t("materials.piece.no_pdf", "Nuty niedostępne")}
                        </Eyebrow>
                      </div>
                    )}

                    {referenceLinks.length > 0 && (
                      <a
                        href={referenceLinks[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl transition-all border border-ethereal-marble shadow-glass-solid bg-ethereal-alabaster hover:bg-ethereal-marble/50 active:scale-95"
                      >
                        {referenceLinks[0].platform === "youtube" ? (
                          <Youtube
                            size={16}
                            className="text-ethereal-crimson"
                            aria-hidden="true"
                          />
                        ) : (
                          <Music2
                            size={16}
                            className="text-ethereal-sage"
                            aria-hidden="true"
                          />
                        )}
                        <Eyebrow color="default">
                          {t(
                            "materials.piece.listen_reference",
                            "Posłuchaj Referencji",
                          )}
                        </Eyebrow>
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {piece.my_casting && (
                      <GlassCard
                        variant="ethereal"
                        className="bg-ethereal-sage/10 h-full"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-ethereal-alabaster flex items-center justify-center text-ethereal-incense shadow-glass-solid flex-shrink-0">
                            <User size={16} aria-hidden="true" />
                          </div>
                          <div>
                            <Eyebrow
                              color="default"
                              className="text-ethereal-incense"
                            >
                              {t(
                                "materials.piece.your_guidelines",
                                "Twoje wytyczne do utworu",
                              )}
                            </Eyebrow>
                            <Text>
                              <Emphasis>
                                {t("materials.piece.part", "Partia:")}
                              </Emphasis>{" "}
                              {piece.my_casting.voice_line_display ||
                                piece.my_casting.voice_line}
                            </Text>
                          </div>
                        </div>
                        {piece.my_casting.notes ? (
                          <div className="bg-ethereal-marble/40 p-3 rounded-lg border border-ethereal-marble/60">
                            <Text className="italic text-ethereal-graphite">
                              &quot;{piece.my_casting.notes}&quot;
                            </Text>
                          </div>
                        ) : (
                          <Text className="italic text-ethereal-graphite opacity-80">
                            {t(
                              "materials.piece.no_notes",
                              "Dyrygent nie dodał specjalnych uwag.",
                            )}
                          </Text>
                        )}
                      </GlassCard>
                    )}

                    <PieceDivisiRoster castings={piece.castings} />
                  </div>

                  {piece.tracks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4 ml-1 border-b border-ethereal-marble pb-2">
                        <Headphones
                          size={14}
                          className="text-ethereal-gold"
                          aria-hidden="true"
                        />
                        <Eyebrow color="muted">
                          {t(
                            "materials.piece.practice_tracks",
                            "Ścieżki Ćwiczeniowe (Midi / MP3)",
                          )}
                        </Eyebrow>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {piece.tracks.map((track) => (
                          <EducationalAudioPlayer
                            key={track.id}
                            track={track}
                            isMyTrack={
                              piece.my_casting?.voice_line === track.voice_part
                            }
                            isLocked={isArchived}
                            onPlay={handleAudioPlay}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <PieceLyricsViewer
                    originalLyrics={piece.lyrics_original}
                    translationNotes={piece.lyrics_translation}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
};
