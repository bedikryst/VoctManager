import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Download,
  FileText,
  Headphones,
  Lock,
  Music2,
  User,
  Youtube,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Emphasis,
  Eyebrow,
  Heading,
  Text,
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

  const composerName = piece.composer
    ? `${piece.composer.first_name || ""} ${piece.composer.last_name}`.trim()
    : t("materials.piece.traditional", "Tradycyjny / Nieznany");

  const hasBadges =
    isEncored ||
    (!isArchived && piece.sheet_music) ||
    (!isArchived && piece.tracks.length > 0) ||
    isArchived;

  return (
    <GlassCard
      padding="none"
      variant={isArchived ? "dark" : "ethereal"}
      className={`overflow-hidden transition-all duration-300 ${
        isExpanded
          ? "border-ethereal-amethyst/50 shadow-glass-ethereal"
          : "hover:shadow-glass-ethereal-hover"
      } ${isArchived ? "opacity-75" : ""}`}
    >
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full p-4 text-left hover:bg-ethereal-marble/20 active:bg-ethereal-marble/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 focus-visible:ring-inset"
        aria-expanded={isExpanded}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-glass-solid border ${
              isArchived
                ? "bg-ethereal-marble text-ethereal-graphite border-ethereal-marble"
                : "bg-ethereal-alabaster text-ethereal-ink border-ethereal-marble"
            }`}
            aria-hidden="true"
          >
            <Heading size="lg" weight="medium">
              {String(order)}
            </Heading>
          </div>

          <div className="flex-1 min-w-0">
            <Heading size="xl" weight="medium" className="leading-snug">
              {piece.title}
            </Heading>
            <Eyebrow color="muted" className="mt-0.5 block">
              {composerName}
            </Eyebrow>
            {piece.my_casting && (
              <div className="mt-2 inline-flex items-center gap-1.5 bg-ethereal-sage/10 px-2 py-1 rounded-md border border-ethereal-sage/20">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-ethereal-sage shrink-0"
                  aria-hidden="true"
                />
                <Eyebrow color="incense">
                  {piece.my_casting.voice_line_display ||
                    (piece.my_casting.voice_line
                      ? t(
                          `dashboard.layout.roles.${piece.my_casting.voice_line}`,
                        )
                      : piece.my_casting.voice_line)}
                </Eyebrow>
              </div>
            )}
          </div>

          <div
            className={`shrink-0 mt-0.5 p-1.5 rounded-full border border-ethereal-marble bg-ethereal-alabaster shadow-glass-solid text-ethereal-graphite transition-transform duration-300 ${
              isExpanded ? "rotate-180" : "rotate-0"
            }`}
            aria-hidden="true"
          >
            <ChevronDown size={14} />
          </div>
        </div>

        {hasBadges && (
          <div className="flex flex-wrap gap-1.5 mt-3 ml-12">
            {isEncored && (
              <span className="inline-flex items-center px-2 py-0.5 bg-ethereal-amethyst/10 rounded border border-ethereal-amethyst/20">
                <Eyebrow color="amethyst">
                  {t("materials.piece.encore_badge", "Bis")}
                </Eyebrow>
              </span>
            )}
            {!isArchived && piece.sheet_music && (
              <span className="inline-flex items-center px-2 py-0.5 bg-ethereal-sage/10 rounded border border-ethereal-sage/20">
                <Eyebrow color="incense">
                  {t("materials.piece.pdf_badge", "PDF")}
                </Eyebrow>
              </span>
            )}
            {!isArchived && piece.tracks.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 bg-ethereal-gold/10 rounded border border-ethereal-gold/20">
                <Eyebrow color="gold">
                  {t("materials.piece.audio_badge", "Audio")}
                </Eyebrow>
              </span>
            )}
            {isArchived && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ethereal-marble/40 rounded border border-ethereal-marble">
                <Lock
                  size={10}
                  className="text-ethereal-graphite"
                  aria-hidden="true"
                />
                <Eyebrow color="muted">
                  {t("materials.piece.locked_badge", "Chronione")}
                </Eyebrow>
              </span>
            )}
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] as const }}
            className="overflow-hidden"
          >
            <div className="border-t border-ethereal-marble bg-ethereal-parchment/20">
              {isArchived ? (
                <div className="p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 bg-ethereal-alabaster border border-ethereal-marble rounded-full flex items-center justify-center mb-4 shadow-glass-solid">
                    <Lock
                      size={20}
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
                  <Text color="graphite" className="max-w-xs">
                    {t(
                      "materials.piece.access_locked_desc",
                      "Projekt został zakończony. Materiały ćwiczeniowe nie są już dostępne ze względu na ochronę własności intelektualnej.",
                    )}
                  </Text>
                </div>
              ) : (
                <div className="p-4 md:p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {piece.sheet_music ? (
                      <a
                        href={piece.sheet_music}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-ethereal-sage hover:bg-ethereal-sage/90 active:scale-95 rounded-xl transition-all shadow-glass-solid"
                      >
                        <Download
                          size={15}
                          className="text-white"
                          aria-hidden="true"
                        />
                        <Eyebrow color="white">
                          {t(
                            "materials.piece.download_pdf",
                            "Pobierz Partyturę (PDF)",
                          )}
                        </Eyebrow>
                      </a>
                    ) : (
                      <div className="flex items-center justify-center gap-2 px-5 py-3 bg-ethereal-marble/40 border border-ethereal-marble rounded-xl cursor-not-allowed">
                        <FileText
                          size={15}
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
                        className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl transition-all border border-ethereal-marble shadow-glass-solid bg-ethereal-alabaster hover:bg-ethereal-marble/50 active:scale-95"
                      >
                        {referenceLinks[0].platform === "youtube" ? (
                          <Youtube
                            size={15}
                            className="text-ethereal-crimson"
                            aria-hidden="true"
                          />
                        ) : (
                          <Music2
                            size={15}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {piece.my_casting && (
                      <GlassCard
                        variant="ethereal"
                        className="bg-ethereal-sage/5"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-full bg-ethereal-alabaster border border-ethereal-marble flex items-center justify-center text-ethereal-incense shadow-glass-solid shrink-0">
                            <User size={14} aria-hidden="true" />
                          </div>
                          <div>
                            <Eyebrow color="incense">
                              {t(
                                "materials.piece.your_guidelines",
                                "Twoje wytyczne",
                              )}
                            </Eyebrow>
                            <Text size="sm">
                              <Emphasis>
                                {t("materials.piece.part", "Partia:")}
                              </Emphasis>{" "}
                              {piece.my_casting.voice_line_display ||
                                (piece.my_casting.voice_line
                                  ? t(
                                      `dashboard.layout.roles.${piece.my_casting.voice_line}`,
                                    )
                                  : piece.my_casting.voice_line)}
                            </Text>
                          </div>
                        </div>
                        {piece.my_casting.notes ? (
                          <div className="bg-ethereal-marble/40 p-3 rounded-lg border border-ethereal-marble/60">
                            <Text size="sm" color="graphite" className="italic">
                              &quot;{piece.my_casting.notes}&quot;
                            </Text>
                          </div>
                        ) : (
                          <Text
                            size="sm"
                            color="graphite"
                            className="italic opacity-70"
                          >
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
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-ethereal-marble">
                        <Headphones
                          size={13}
                          className="text-ethereal-gold"
                          aria-hidden="true"
                        />
                        <Eyebrow color="muted">
                          {t(
                            "materials.piece.practice_tracks",
                            "Ścieżki Ćwiczeniowe",
                          )}
                        </Eyebrow>
                      </div>
                      <div className="flex flex-col gap-3">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
