/**
 * @file TempoGiustoPlayer.tsx
 * @description The conductor's target-tempo recording of one piece — how it is
 * meant to sound — played on its own, outside the mixer. It runs its own
 * length, so it can never sit in the synced voice set; it has no voices, so
 * there is nothing to mute or solo; and it IS the tempo, so there is no rate
 * control (the engine pins it to 1x).
 *
 * It drives the same engine as the mixer, so starting one stops the other and
 * the mini-player and lock-screen controls follow whichever is playing.
 */
import React from "react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Text } from "@/shared/ui/primitives/typography";
import {
  buildTempoGiustoSource,
  usePracticePlayer,
} from "./PracticePlayerProvider";
import { holdsTake } from "./practicePlayerEngine";
import { PlayerTransport } from "./PlayerTransport";
import type { MaterialsPiece, MaterialsTrack } from "../types/materials.dto";

interface TempoGiustoPlayerProps {
  piece: MaterialsPiece;
  projectId: string;
  track: MaterialsTrack;
}

export const TempoGiustoPlayer = ({
  piece,
  projectId,
  track,
}: TempoGiustoPlayerProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { engine, snapshot } = usePracticePlayer();

  const isLoaded =
    holdsTake(snapshot, piece.id, "tempo-giusto") &&
    snapshot.tracks[0]?.id === track.id;

  const ensureLoadedThen = (action: () => void) => {
    if (!isLoaded) {
      const { source, tracks } = buildTempoGiustoSource(
        piece,
        projectId,
        track,
        t("materials.player.tempo_giusto", "Tempo giusto"),
      );
      engine.load(source, tracks, { autoplay: true });
      return;
    }
    action();
  };

  return (
    <GlassCard variant="ethereal" padding="none" isHoverable={false}>
      <div className="p-4">
        <PlayerTransport
          isPlaying={isLoaded && snapshot.isPlaying}
          position={isLoaded ? snapshot.position : 0}
          duration={isLoaded ? snapshot.duration : 0}
          onToggle={() => ensureLoadedThen(() => engine.toggle())}
          onSeek={(seconds) => ensureLoadedThen(() => engine.seek(seconds))}
        />
        {track.description && (
          <Text size="xs" color="graphite" className="mt-2 block pl-0.5">
            {track.description}
          </Text>
        )}
      </div>
    </GlassCard>
  );
};
