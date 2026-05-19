/**
 * @file PieceLyricsViewer.tsx
 * @description Artist-facing collapsible viewer for the sung text and every
 * Score-Compiler-generated study aid attached to a Piece: original lyrics,
 * the legacy single-string translation, IPA pronunciation, every multilingual
 * translation, and the audience-facing program note. Each section appears
 * only when data is present.
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { AlignLeft, ChevronDown, Languages, ScrollText } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type {
  MaterialsProgramNote,
  MaterialsTranslation,
} from "../types/materials.dto";

interface PieceLyricsViewerProps {
  originalLyrics?: string | null;
  /** Legacy single-string translation field on Piece. */
  translationNotes?: string | null;
  /** Score Compiler IPA transcription. */
  lyricsIpa?: string | null;
  /** Multilingual translations from the Score Compiler (en, pl, fr, …). */
  translations?: MaterialsTranslation[];
  /** Audience-facing program notes. */
  programNotes?: MaterialsProgramNote[];
}

export const PieceLyricsViewer = ({
  originalLyrics,
  translationNotes,
  lyricsIpa,
  translations,
  programNotes,
}: PieceLyricsViewerProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const cleanedTranslations = (translations ?? []).filter((tr) =>
    Boolean(tr.text?.trim()),
  );
  const cleanedProgramNotes = (programNotes ?? []).filter((note) =>
    Boolean(note.content?.trim()),
  );

  const hasAnything =
    Boolean(originalLyrics) ||
    Boolean(translationNotes) ||
    Boolean(lyricsIpa) ||
    cleanedTranslations.length > 0 ||
    cleanedProgramNotes.length > 0;

  if (!hasAnything) {
    return null;
  }

  return (
    <GlassCard padding="none" variant="ethereal" className="overflow-hidden">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-ethereal-marble/40 active:bg-ethereal-marble/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 focus-visible:ring-inset"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <AlignLeft
            size={15}
            className="text-ethereal-gold shrink-0"
            aria-hidden="true"
          />
          <Eyebrow color="default">
            {t("materials.piece.lyrics_translation", "Tekst i Tłumaczenie")}
          </Eyebrow>
        </div>
        <div
          className={`shrink-0 p-1.5 rounded-full border border-ethereal-marble bg-ethereal-alabaster shadow-glass-solid text-ethereal-graphite transition-transform duration-300 ${
            isExpanded ? "rotate-180" : "rotate-0"
          }`}
          aria-hidden="true"
        >
          <ChevronDown size={14} />
        </div>
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
            <div className="border-t border-ethereal-marble/60 p-4 md:p-6 flex flex-col gap-6 bg-ethereal-marble/15">
              {/* Original + IPA — side by side when both are present, since
                  IPA aligns line-by-line with the original. */}
              {(originalLyrics || lyricsIpa) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {originalLyrics && (
                    <div>
                      <div className="border-b border-ethereal-marble pb-2 mb-3">
                        <Eyebrow color="muted">
                          {t("materials.piece.original_lyrics", "Oryginał")}
                        </Eyebrow>
                      </div>
                      <Text
                        color="default"
                        className="whitespace-pre-wrap leading-relaxed font-serif"
                      >
                        {originalLyrics}
                      </Text>
                    </div>
                  )}
                  {lyricsIpa && (
                    <div>
                      <div className="border-b border-ethereal-marble pb-2 mb-3 flex items-center gap-2">
                        <Eyebrow color="muted">
                          {t("materials.piece.lyrics_ipa", "Wymowa (IPA)")}
                        </Eyebrow>
                      </div>
                      <pre className="whitespace-pre-wrap leading-relaxed font-serif text-[13px] text-ethereal-ink">
                        {lyricsIpa}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Translations — every target language as its own block. */}
              {cleanedTranslations.length > 0 && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-ethereal-marble pb-2">
                    <Languages
                      size={14}
                      className="text-ethereal-gold"
                      aria-hidden="true"
                    />
                    <Eyebrow color="muted">
                      {t(
                        "materials.piece.translations_section",
                        "Tłumaczenia",
                      )}
                    </Eyebrow>
                  </div>
                  {cleanedTranslations.map((tr) => (
                    <article
                      key={tr.id}
                      className="rounded-2xl border border-ethereal-marble bg-ethereal-alabaster/55 p-3"
                    >
                      <div className="flex items-baseline justify-between">
                        <Eyebrow color="muted">
                          {t(
                            "materials.piece.translation_label",
                            "{{lang}}",
                            { lang: tr.target_language.toUpperCase() },
                          )}
                        </Eyebrow>
                        {tr.is_singable && (
                          <Text size="xs" color="muted">
                            {t(
                              "materials.piece.translation_singable",
                              "śpiewalne",
                            )}
                          </Text>
                        )}
                      </div>
                      <Text
                        color="graphite"
                        className="mt-2 whitespace-pre-wrap leading-relaxed font-serif italic"
                      >
                        {tr.text}
                      </Text>
                    </article>
                  ))}
                </div>
              )}

              {/* Legacy single-string translation — only show when no
                  multilingual translations[] are present (otherwise the new
                  ones supersede). */}
              {translationNotes && cleanedTranslations.length === 0 && (
                <div>
                  <div className="border-b border-ethereal-marble pb-2 mb-3">
                    <Eyebrow color="muted">
                      {t(
                        "materials.piece.translation_notes",
                        "Tłumaczenie",
                      )}
                    </Eyebrow>
                  </div>
                  <Text
                    color="graphite"
                    className="whitespace-pre-wrap leading-relaxed font-serif italic"
                  >
                    {translationNotes}
                  </Text>
                </div>
              )}

              {/* Program notes — audience-facing context, useful for the
                  choir to know what they're singing about. */}
              {cleanedProgramNotes.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 border-b border-ethereal-marble pb-2">
                    <ScrollText
                      size={14}
                      className="text-ethereal-gold"
                      aria-hidden="true"
                    />
                    <Eyebrow color="muted">
                      {t(
                        "materials.piece.program_note_section",
                        "Notka programowa",
                      )}
                    </Eyebrow>
                  </div>
                  {cleanedProgramNotes.map((note) => (
                    <article
                      key={note.id}
                      className="rounded-2xl border border-ethereal-marble bg-ethereal-alabaster/55 p-3"
                    >
                      <Eyebrow color="muted">
                        {note.language.toUpperCase()} · {note.target_tone}
                      </Eyebrow>
                      <Text
                        color="default"
                        className="mt-2 whitespace-pre-wrap leading-relaxed"
                      >
                        {note.content}
                      </Text>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
