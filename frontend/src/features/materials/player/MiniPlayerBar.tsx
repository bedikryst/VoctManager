/**
 * @file MiniPlayerBar.tsx
 * @description Docked transport that keeps practice audio alive while the
 * chorister browses the Songbook. Sits above the mobile nav dock; hidden on
 * the page of the currently playing piece (the full mixer owns the surface).
 */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Loader2, Music2, Pause, Play, X } from "lucide-react";

import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { Portal } from "@/shared/lib/dom/Portal";
import { usePracticePlayer } from "./PracticePlayerProvider";
import { formatPlayerTime } from "./VoiceMixerPanel";

export const MiniPlayerBar = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { engine, snapshot } = usePracticePlayer();
  const location = useLocation();

  const piece = snapshot.piece;
  const piecePath = piece
    ? `/panel/materials/${piece.projectId}/${piece.pieceId}`
    : null;
  const isOnPiecePage = piecePath !== null && location.pathname === piecePath;
  const isVisible = piece !== null && !isOnPiecePage;

  const progress =
    snapshot.duration > 0 ? (snapshot.position / snapshot.duration) * 100 : 0;

  return (
    <Portal>
    <AnimatePresence>
      {isVisible && piece && piecePath && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-dock z-toast flex justify-center px-4"
        >
          <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 overflow-hidden rounded-2xl border border-glass-border bg-ethereal-alabaster/95 py-2.5 pl-3 pr-2 shadow-[0_10px_32px_-12px_rgba(22,20,18,0.25),0_2px_6px_rgba(22,20,18,0.08)] backdrop-blur-md">
            <button
              type="button"
              onClick={() => engine.toggle()}
              aria-label={
                snapshot.isPlaying
                  ? t("materials.player.pause", "Pauza")
                  : t("materials.player.play", "Odtwarzaj")
              }
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-glass-solid transition-all active:scale-95",
                snapshot.isPlaying
                  ? "border-ethereal-sage/80 bg-ethereal-sage text-white"
                  : "border-ethereal-marble bg-ethereal-alabaster text-ethereal-ink",
              )}
            >
              {snapshot.isBuffering ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : snapshot.isPlaying ? (
                <Pause size={16} aria-hidden="true" />
              ) : (
                <Play size={16} className="ml-0.5" aria-hidden="true" />
              )}
            </button>

            <Link to={piecePath} className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Music2
                  size={11}
                  className="shrink-0 text-ethereal-sage"
                  aria-hidden="true"
                />
                <Text size="sm" weight="semibold" truncate>
                  {piece.title}
                </Text>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ethereal-marble/70">
                <div
                  className="h-full rounded-full bg-ethereal-sage transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </Link>

            <Eyebrow color="muted" className="shrink-0 tabular-nums">
              {formatPlayerTime(snapshot.position)}
            </Eyebrow>

            <button
              type="button"
              onClick={() => engine.close()}
              aria-label={t("materials.player.close", "Zamknij odtwarzacz")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ethereal-graphite/60 transition-colors hover:bg-ethereal-marble/50 hover:text-ethereal-ink"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </Portal>
  );
};
