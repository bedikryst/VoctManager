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
import { useTranslation } from "react-i18next";

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

const SEEK_STEP_S = 10;

/** Best-effort handler registration — Safari throws on unsupported actions. */
const setHandler = (
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
): void => {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Action unsupported in this browser — ignore.
  }
};

/**
 * Bridges the practice engine to the OS media controls (lock screen, headset,
 * car). Rendered beside the children so its 250 ms position ticks never
 * re-render the rest of the tree. No-op where MediaSession is unavailable.
 */
const MediaSessionBridge = ({
  engine,
}: {
  engine: PracticePlayerEngine;
}): null => {
  const { t } = useTranslation();
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const { piece, isPlaying, position, duration, rate } = snapshot;

  // Transport handlers — registered once; they read fresh state from the engine.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    setHandler("play", () => void engine.play());
    setHandler("pause", () => engine.pause());
    setHandler("stop", () => engine.close());
    setHandler("seekbackward", (details) => {
      const s = engine.getSnapshot();
      engine.seek(Math.max(0, s.position - (details.seekOffset ?? SEEK_STEP_S)));
    });
    setHandler("seekforward", (details) => {
      const s = engine.getSnapshot();
      const max = s.duration || s.position;
      engine.seek(Math.min(max, s.position + (details.seekOffset ?? SEEK_STEP_S)));
    });
    setHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") engine.seek(details.seekTime);
    });

    return () => {
      if (!("mediaSession" in navigator)) return;
      (
        ["play", "pause", "stop", "seekbackward", "seekforward", "seekto"] as const
      ).forEach((action) => setHandler(action, null));
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    };
  }, [engine]);

  // Now-playing metadata — refreshed only when the piece changes.
  useEffect(() => {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") {
      return;
    }
    navigator.mediaSession.metadata = piece
      ? new MediaMetadata({
          title: piece.title,
          artist: piece.composer || undefined,
          album: t("materials.dashboard.title_highlight", "Śpiewnik"),
        })
      : null;
  }, [piece, t]);

  // Playback state + scrubber position.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = !piece
      ? "none"
      : isPlaying
        ? "playing"
        : "paused";

    if (!piece || !(duration > 0) || !Number.isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(Math.max(position, 0), duration),
        playbackRate: rate || 1,
      });
    } catch {
      // Inconsistent values mid-seek — the next tick corrects it.
    }
  }, [piece, isPlaying, position, duration, rate]);

  return null;
};

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
      <MediaSessionBridge engine={value.engine} />
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
