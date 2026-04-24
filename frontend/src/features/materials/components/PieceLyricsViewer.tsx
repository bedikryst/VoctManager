import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { AlignLeft, ChevronUp, ChevronDown } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface PieceLyricsViewerProps {
  originalLyrics?: string | null;
  translationNotes?: string | null;
}

export const PieceLyricsViewer = ({
  originalLyrics,
  translationNotes,
}: PieceLyricsViewerProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!originalLyrics && !translationNotes) {
    return null;
  }

  return (
    <GlassCard padding="none" variant="ethereal" className="overflow-hidden">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-ethereal-marble/40 transition-colors focus:outline-none"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5">
          <AlignLeft
            size={16}
            className="text-ethereal-gold"
            aria-hidden="true"
          />
          <Eyebrow color="default">
            {t(
              "materials.piece.lyrics_translation",
              "Tekst Utworu i Tłumaczenie",
            )}
          </Eyebrow>
        </div>
        <div className="text-ethereal-graphite bg-ethereal-alabaster shadow-glass-solid p-1.5 rounded-full border border-ethereal-marble">
          {isExpanded ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden border-t border-ethereal-marble/60"
          >
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-ethereal-marble/20">
              {originalLyrics && (
                <div>
                  <div className="border-b border-ethereal-marble pb-2 mb-3">
                    <Eyebrow color="muted">
                      {t("materials.piece.original_lyrics", "Oryginał")}
                    </Eyebrow>
                  </div>
                  <Text className="whitespace-pre-wrap leading-relaxed font-serif text-ethereal-ink">
                    {originalLyrics}
                  </Text>
                </div>
              )}
              {translationNotes && (
                <div>
                  <div className="border-b border-ethereal-marble pb-2 mb-3">
                    <Eyebrow color="muted">
                      {t(
                        "materials.piece.translation_notes",
                        "Tłumaczenie (Notatki)",
                      )}
                    </Eyebrow>
                  </div>
                  <Text className="whitespace-pre-wrap leading-relaxed font-serif italic text-ethereal-graphite">
                    {translationNotes}
                  </Text>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
