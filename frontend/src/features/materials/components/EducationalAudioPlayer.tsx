import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gauge, Lock, PlayCircle } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import type { MaterialsTrack } from "../types/materials.dto";

const PLAYBACK_RATES = [0.5, 0.75, 1] as const;

interface EducationalAudioPlayerProps {
  track: MaterialsTrack;
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

  const changeSpeed = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setSpeed(rate);
    }
  };

  return (
    <GlassCard
      variant={isMyTrack && !isLocked ? "outline" : "ethereal"}
      padding="sm"
      className={`transition-all duration-300 ${
        isMyTrack && !isLocked ? "bg-ethereal-sage/5" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
            isLocked
              ? "bg-ethereal-marble/40 border-ethereal-marble"
              : isMyTrack
                ? "bg-ethereal-sage border-ethereal-sage/80"
                : "bg-ethereal-sage/10 border-ethereal-sage/20"
          }`}
        >
          {isLocked ? (
            <Lock
              size={12}
              className="text-ethereal-graphite shrink-0"
              aria-hidden="true"
            />
          ) : (
            <PlayCircle
              size={12}
              className={isMyTrack ? "text-white shrink-0" : "text-ethereal-sage shrink-0"}
              aria-hidden={!isMyTrack}
            />
          )}
          <Eyebrow color={isMyTrack && !isLocked ? "white" : "muted"}>
            {track.voice_part_display || track.voice_part}
            {isMyTrack &&
              !isLocked &&
              ` ${t("materials.player.your_voice", "(Twój głos)")}`}
          </Eyebrow>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <audio
          ref={audioRef}
          controls
          controlsList="nodownload"
          src={track.audio_file}
          className={`h-10 w-full flex-1 outline-none rounded-lg transition-opacity ${
            isLocked ? "opacity-40 grayscale pointer-events-none" : ""
          }`}
          preload="none"
          onPlay={onPlay}
        />

        {!isLocked && (
          <div className="flex items-center gap-1 bg-ethereal-alabaster px-1 py-1 rounded-lg border border-ethereal-marble shadow-glass-solid shrink-0">
            <Gauge
              size={12}
              className="text-ethereal-graphite mx-1"
              aria-hidden="true"
            />
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                onClick={() => changeSpeed(rate)}
                aria-pressed={speed === rate}
                className={`px-2.5 py-1.5 rounded-md transition-all active:scale-95 min-h-8 ${
                  speed === rate
                    ? "bg-ethereal-sage/10 shadow-glass-ethereal border border-ethereal-sage/20"
                    : "border border-transparent hover:border-ethereal-marble"
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

