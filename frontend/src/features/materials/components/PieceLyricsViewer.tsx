/**
 * @file PieceLyricsViewer.tsx
 * @description Artist-facing viewer for the sung text and every
 * Score-Compiler-generated study aid attached to a Piece: original lyrics, IPA
 * pronunciation, every multilingual translation, and the audience-facing
 * program note. Each section appears only when data is present, and the whole
 * block renders nothing when none of them are — which is why the block owns
 * its own label rather than the page placing one above it.
 *
 * It is the last reader of a piece's text since the dead `repertoire/*` blocks
 * were deleted. It used to be a disclosure: a chevron that collapsed the only
 * body on the Tekst tab, under a header repeating the tab's own name. The tab
 * switcher already governs whether this is on screen, so the header is a label
 * like every other block's on the page.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, Languages, ScrollText } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { SectionLabel } from "./SectionLabel";
import type {
  MaterialsProgramNote,
  MaterialsTranslation,
} from "../types/materials.dto";

interface PieceLyricsViewerProps {
  originalLyrics?: string | null;
  /** AI-extracted IPA transcription. */
  lyricsIpa?: string | null;
  /** Multilingual translations from the AI pipeline (en, pl, fr, …). */
  translations?: MaterialsTranslation[];
  /** Audience-facing program notes. */
  programNotes?: MaterialsProgramNote[];
}

export const PieceLyricsViewer = ({
  originalLyrics,
  lyricsIpa,
  translations,
  programNotes,
}: PieceLyricsViewerProps): React.JSX.Element | null => {
  const { t } = useTranslation();

  const cleanedTranslations = (translations ?? []).filter((tr) =>
    Boolean(tr.text?.trim()),
  );
  const cleanedProgramNotes = (programNotes ?? []).filter((note) =>
    Boolean(note.content?.trim()),
  );

  const hasAnything =
    Boolean(originalLyrics) ||
    Boolean(lyricsIpa) ||
    cleanedTranslations.length > 0 ||
    cleanedProgramNotes.length > 0;

  if (!hasAnything) {
    return null;
  }

  return (
    <>
      <SectionLabel icon={<AlignLeft size={13} />}>
        {t("materials.piece.lyrics_translation", "Tekst i tłumaczenie")}
      </SectionLabel>
      <GlassCard padding="none" variant="ethereal" className="overflow-hidden">
        <div className="p-4 md:p-6 flex flex-col gap-6">
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
      </GlassCard>
    </>
  );
};
