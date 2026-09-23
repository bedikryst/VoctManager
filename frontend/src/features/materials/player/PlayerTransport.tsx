/**
 * @file PlayerTransport.tsx
 * @description Play/pause button and scrubber of one practice surface — the
 * mixer and the tempo giusto player share it so the two read as one
 * instrument. Stateless: the owner decides what "not loaded yet" means and
 * passes zeros until its own take is in the engine.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play } from "lucide-react";

import { Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

export const formatPlayerTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

interface PlayerTransportProps {
  isPlaying: boolean;
  position: number;
  duration: number;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
}

export const PlayerTransport = ({
  isPlaying,
  position,
  duration,
  onToggle,
  onSeek,
}: PlayerTransportProps): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-label={
          isPlaying
            ? t("materials.player.pause", "Pauza")
            : t("materials.player.play", "Odtwarzaj")
        }
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-glass-solid transition-all active:scale-95",
          isPlaying
            ? "border-ethereal-sage/80 bg-ethereal-sage text-ink-on-inverse"
            : "border-ethereal-marble bg-ethereal-alabaster text-ethereal-ink hover:border-ethereal-sage/50",
        )}
      >
        {isPlaying ? (
          <Pause size={18} aria-hidden="true" />
        ) : (
          <Play size={18} className="ml-0.5" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={position}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label={t("materials.player.seek", "Przewiń")}
          className="w-full accent-ethereal-sage"
        />
        <div className="mt-0.5 flex items-center justify-between">
          <Text size="xs" color="muted" className="tabular-nums">
            {formatPlayerTime(position)}
          </Text>
          <Text size="xs" color="muted" className="tabular-nums">
            {formatPlayerTime(duration)}
          </Text>
        </div>
      </div>
    </div>
  );
};
