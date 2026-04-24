/**
 * @file EducationalAudioPlayer.tsx
 * @description Interactive educational audio player with localized speed controls.
 * Adapts visual states based on user track assignment and archive locks.
 * @module features/materials/components/EducationalAudioPlayer
 */

import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PlayCircle, Lock, FastForward } from "lucide-react";
import type { Track } from "@/shared/types";

// Design System Primitives
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow } from "@/shared/ui/primitives/typography";

interface EducationalAudioPlayerProps {
  track: Track;
  isMyTrack: boolean;
  isLocked: boolean;
  onPlay: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
}

export const EducationalAudioPlayer = ({
  track,
  isMyTrack,
  isLocked,
  onPlay,
}: EducationalAudioPlayerProps): React.JSX.Element => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState<number>(1);

  const changeSpeed = (newSpeed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
      setSpeed(newSpeed);
    }
  };

  // Zastosowanie wariantów GlassCard i palety Ethereal zamiast surowych klas Tailwind
  return (
    <GlassCard
      variant={isMyTrack && !isLocked ? "outline" : "ethereal"}
      className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-all duration-300"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-glass-solid ${
            isLocked
              ? "bg-ethereal-marble/40 border-ethereal-marble"
              : isMyTrack
                ? "bg-ethereal-sage text-white border-ethereal-sage/80"
                : "bg-ethereal-sage/10 border-ethereal-sage/20"
          }`}
        >
          {isLocked ? (
            <Lock
              size={14}
              className="text-ethereal-graphite"
              aria-hidden="true"
            />
          ) : (
            <PlayCircle size={14} aria-hidden={!isMyTrack} />
          )}

          <Eyebrow
            color={isMyTrack && !isLocked ? "default" : "muted"}
            className={isMyTrack && !isLocked ? "text-white" : ""}
          >
            {track.voice_part_display || track.voice_part}
            {isMyTrack &&
              !isLocked &&
              ` ${t("materials.player.your_voice", "(Twój głos)")}`}
          </Eyebrow>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
        <audio
          ref={audioRef}
          controls
          controlsList="nodownload"
          src={track.audio_file}
          className={`h-9 w-full sm:w-64 outline-none rounded-lg transition-opacity ${
            isLocked ? "opacity-50 grayscale pointer-events-none" : ""
          }`}
          preload="none"
          onPlay={onPlay}
        />

        {!isLocked && (
          <div className="flex items-center bg-ethereal-alabaster p-1 rounded-lg border border-ethereal-marble shadow-glass-solid">
            <FastForward
              size={14}
              className="text-ethereal-graphite mx-2"
              aria-hidden="true"
            />
            {[0.5, 0.75, 1].map((rate) => (
              <button
                key={rate}
                onClick={() => changeSpeed(rate)}
                className={`px-2.5 py-1 rounded-md transition-all active:scale-95 ${
                  speed === rate
                    ? "bg-ethereal-sage/10 text-ethereal-ink shadow-glass-ethereal border border-ethereal-sage/20"
                    : "text-ethereal-graphite hover:text-ethereal-ink border border-transparent"
                }`}
                title={t(
                  "materials.player.speed_title",
                  "Ustaw tempo na {{rate}}x",
                  { rate },
                )}
              >
                <Eyebrow color={speed === rate ? "default" : "muted"}>
                  {rate}x
                </Eyebrow>
              </button>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
};
