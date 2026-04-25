import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { AlignLeft, ChevronDown } from "lucide-react";

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
            <div className="border-t border-ethereal-marble/60 p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-ethereal-marble/15">
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
              {translationNotes && (
                <div>
                  <div className="border-b border-ethereal-marble pb-2 mb-3">
                    <Eyebrow color="muted">
                      {t("materials.piece.translation_notes", "Tłumaczenie")}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
