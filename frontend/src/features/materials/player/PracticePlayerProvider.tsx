/**
 * @file PracticePlayerProvider.tsx
 * @description React bridge for the multitrack practice engine. Mounted once
 * at the Songbook layout level so playback survives navigation between the
 * materials list and piece pages (mini-player pattern).
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import {
  PracticePlayerEngine,
  type PracticePieceSource,
  type PracticePlayerSnapshot,
  type PracticeTrackSource,
} from "./practicePlayerEngine";
import type { MaterialsPiece, MaterialsTrack } from "../types/materials.dto";

interface PracticePlayerContextValue {
  engine: PracticePlayerEngine;
}

const PracticePlayerContext = createContext<PracticePlayerContextValue | null>(
  null,
);

export const PracticePlayerProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => {
  const engineRef = useRef<PracticePlayerEngine | null>(null);
  engineRef.current ??= new PracticePlayerEngine();

  useEffect(() => {
    const engine = engineRef.current;
    return () => engine?.destroy();
  }, []);

  const value = useMemo(
    () => ({ engine: engineRef.current as PracticePlayerEngine }),
    [],
  );

  return (
    <PracticePlayerContext.Provider value={value}>
      {children}
    </PracticePlayerContext.Provider>
  );
};

export const usePracticePlayer = (): {
  engine: PracticePlayerEngine;
  snapshot: PracticePlayerSnapshot;
} => {
  const context = useContext(PracticePlayerContext);
  if (!context) {
    throw new Error(
      "usePracticePlayer must be used within PracticePlayerProvider",
    );
  }
  const snapshot = useSyncExternalStore(
    context.engine.subscribe,
    context.engine.getSnapshot,
  );
  return { engine: context.engine, snapshot };
};

/** Maps API piece/tracks into engine sources (shared by list quick-play and mixer). */
export const buildPracticeSources = (
  piece: MaterialsPiece,
  projectId: string,
): { source: PracticePieceSource; tracks: PracticeTrackSource[] } => {
  const myVoicePart = piece.my_casting?.voice_line ?? null;
  return {
    source: {
      pieceId: piece.id,
      projectId,
      title: piece.title,
      composer: piece.composer?.full_name ?? "",
    },
    tracks: piece.tracks.map((track: MaterialsTrack) => ({
      id: track.id,
      voicePart: track.voice_part,
      label: track.voice_part_display || track.voice_part,
      url: track.audio_file,
      isMine: myVoicePart !== null && track.voice_part === myVoicePart,
    })),
  };
};
