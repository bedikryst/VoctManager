/**
 * @file VoiceMixerPanel.tsx
 * @description Multitrack practice mixer for one piece: shared transport
 * (play/seek/tempo/A-B loop) plus a channel strip per voice with volume,
 * mute and solo. "Hear the whole choir, lift your own line" — the core
 * practice workflow choristers otherwise emulate with multiple tabs.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Headphones,
  Mic,
  Pause,
  Play,
  Repeat,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { usePracticePlayer, buildPracticeSources } from "./PracticePlayerProvider";
import type { PracticePreset } from "./practicePlayerEngine";
import type { MaterialsPiece } from "../types/materials.dto";

const PLAYBACK_RATES = [0.5, 0.75, 1] as const;

const PRESETS: readonly {
  id: PracticePreset;
  labelKey: string;
  fallback: string;
  Icon: LucideIcon;
  /** solo-mine / minus-mine are meaningless without the chorister's own track. */
  requiresMine: boolean;
  activeClass: string;
}[] = [
  {
    id: "blend",
    labelKey: "materials.player.preset_blend",
    fallback: "Cały chór",
    Icon: Users,
    requiresMine: false,
    activeClass: "border-ethereal-sage/40 bg-ethereal-sage/12 text-ethereal-sage",
  },
  {
    id: "solo-mine",
    labelKey: "materials.player.preset_solo_mine",
    fallback: "Tylko mój głos",
    Icon: User,
    requiresMine: true,
    activeClass: "border-ethereal-gold/40 bg-ethereal-gold/12 text-ethereal-gold",
  },
  {
    id: "minus-mine",
    labelKey: "materials.player.preset_minus_mine",
    fallback: "Bez mojego głosu",
    Icon: Mic,
    requiresMine: true,
    activeClass: "border-ethereal-incense/40 bg-ethereal-incense/12 text-ethereal-incense",
  },
];

export const formatPlayerTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

interface VoiceMixerPanelProps {
  piece: MaterialsPiece;
  projectId: string;
}

export const VoiceMixerPanel = ({
  piece,
  projectId,
}: VoiceMixerPanelProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { engine, snapshot } = usePracticePlayer();

  if (piece.tracks.length === 0) return null;

  const isLoaded = snapshot.piece?.pieceId === piece.id;
  const tracks = isLoaded
    ? snapshot.tracks
    : buildPracticeSources(piece, projectId).tracks;

  const ensureLoadedThen = (action?: () => void) => {
    if (!isLoaded) {
      const { source, tracks: sources } = buildPracticeSources(piece, projectId);
      engine.load(source, sources, { autoplay: true });
      return;
    }
    action?.();
  };

  // Presets must load the piece first, then apply — load() commits tracks
  // synchronously, so applyPreset right after sees the populated mix.
  const handlePreset = (preset: PracticePreset) => {
    if (!isLoaded) {
      const { source, tracks: sources } = buildPracticeSources(piece, projectId);
      engine.load(source, sources, { autoplay: true });
    }
    engine.applyPreset(preset);
  };

  const hasMine = tracks.some((track) => track.isMine);
  const activePreset = isLoaded ? snapshot.activePreset : null;
  const loopActive = snapshot.loop.a !== null && snapshot.loop.b !== null;

  return (
    <GlassCard variant="ethereal" padding="none" isHoverable={false}>
      {/* ── practice presets — the one-tap mixes choristers actually reach for ── */}
      <div className="border-b border-ethereal-marble/60 p-3 sm:p-4">
        <Eyebrow color="muted" className="mb-2 block px-0.5">
          {t("materials.player.presets_label", "Tryb ćwiczeń")}
        </Eyebrow>
        <div role="group" className="grid grid-cols-3 gap-1.5">
          {PRESETS.map(({ id, labelKey, fallback, Icon, requiresMine, activeClass }) => {
            const disabled = requiresMine && !hasMine;
            const isActive = activePreset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handlePreset(id)}
                disabled={disabled}
                aria-pressed={isActive}
                title={
                  disabled
                    ? t(
                        "materials.player.preset_needs_my_voice",
                        "Brak Twojej partii w nagraniach tego utworu.",
                      )
                    : undefined
                }
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2 text-center transition-all active:scale-[0.97] disabled:opacity-40",
                  isActive
                    ? cn(activeClass, "shadow-glass-ethereal")
                    : "border-ethereal-marble bg-ethereal-alabaster text-ethereal-graphite shadow-glass-solid hover:border-ethereal-gold/30 hover:text-ethereal-ink",
                )}
              >
                <Icon size={17} aria-hidden="true" className="shrink-0" />
                <span className="text-[10.5px] font-bold uppercase leading-tight tracking-[0.06em]">
                  {t(labelKey, fallback)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── transport ─────────────────────────────────────────────── */}
      <div className="border-b border-ethereal-marble/60 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => ensureLoadedThen(() => engine.toggle())}
            aria-label={
              isLoaded && snapshot.isPlaying
                ? t("materials.player.pause", "Pauza")
                : t("materials.player.play", "Odtwarzaj")
            }
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-glass-solid transition-all active:scale-95",
              isLoaded && snapshot.isPlaying
                ? "border-ethereal-sage/80 bg-ethereal-sage text-white"
                : "border-ethereal-marble bg-ethereal-alabaster text-ethereal-ink hover:border-ethereal-sage/50",
            )}
          >
            {isLoaded && snapshot.isPlaying ? (
              <Pause size={18} aria-hidden="true" />
            ) : (
              <Play size={18} className="ml-0.5" aria-hidden="true" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={isLoaded ? Math.max(snapshot.duration, 1) : 1}
              step={0.1}
              value={isLoaded ? snapshot.position : 0}
              onChange={(event) =>
                ensureLoadedThen(() => engine.seek(Number(event.target.value)))
              }
              aria-label={t("materials.player.seek", "Przewiń")}
              className="w-full accent-ethereal-sage"
            />
            <div className="mt-0.5 flex items-center justify-between">
              <Text size="xs" color="muted" className="tabular-nums">
                {formatPlayerTime(isLoaded ? snapshot.position : 0)}
              </Text>
              <Text size="xs" color="muted" className="tabular-nums">
                {formatPlayerTime(isLoaded ? snapshot.duration : 0)}
              </Text>
            </div>
          </div>
        </div>

        {/* tempo + loop */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-ethereal-marble bg-ethereal-alabaster px-1 py-1 shadow-glass-solid">
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => ensureLoadedThen(() => engine.setRate(rate))}
                aria-pressed={snapshot.rate === rate}
                className={cn(
                  "min-h-8 rounded-md border px-2.5 py-1 transition-all active:scale-95",
                  snapshot.rate === rate
                    ? "border-ethereal-sage/20 bg-ethereal-sage/10 shadow-glass-ethereal"
                    : "border-transparent hover:border-ethereal-marble",
                )}
              >
                <Eyebrow color={snapshot.rate === rate ? "default" : "muted"}>
                  {rate}x
                </Eyebrow>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Repeat
              size={13}
              className={
                loopActive ? "text-ethereal-gold" : "text-ethereal-graphite/40"
              }
              aria-hidden="true"
            />
            <button
              type="button"
              disabled={!isLoaded}
              onClick={() => engine.setLoopPointA()}
              className={cn(
                "min-h-8 rounded-md border px-2.5 py-1 transition-all active:scale-95 disabled:opacity-40",
                snapshot.loop.a !== null
                  ? "border-ethereal-gold/30 bg-ethereal-gold/10"
                  : "border-ethereal-marble bg-ethereal-alabaster",
              )}
            >
              <Eyebrow color={snapshot.loop.a !== null ? "gold" : "muted"}>
                A{" "}
                {snapshot.loop.a !== null && formatPlayerTime(snapshot.loop.a)}
              </Eyebrow>
            </button>
            <button
              type="button"
              disabled={!isLoaded || snapshot.loop.a === null}
              onClick={() => engine.setLoopPointB()}
              className={cn(
                "min-h-8 rounded-md border px-2.5 py-1 transition-all active:scale-95 disabled:opacity-40",
                snapshot.loop.b !== null
                  ? "border-ethereal-gold/30 bg-ethereal-gold/10"
                  : "border-ethereal-marble bg-ethereal-alabaster",
              )}
            >
              <Eyebrow color={snapshot.loop.b !== null ? "gold" : "muted"}>
                B{" "}
                {snapshot.loop.b !== null && formatPlayerTime(snapshot.loop.b)}
              </Eyebrow>
            </button>
            {loopActive && (
              <button
                type="button"
                onClick={() => engine.clearLoop()}
                aria-label={t("materials.player.clear_loop", "Wyłącz pętlę")}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ethereal-marble bg-ethereal-alabaster text-ethereal-graphite transition-all hover:text-ethereal-crimson active:scale-95"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── channel strips ────────────────────────────────────────── */}
      <div className="flex flex-col divide-y divide-ethereal-marble/50">
        {tracks.map((track) => {
          const volume = isLoaded ? (snapshot.volumes[track.id] ?? 1) : 1;
          const isMuted = isLoaded ? Boolean(snapshot.muted[track.id]) : false;
          const isSolo = isLoaded && snapshot.soloTrackId === track.id;
          const isSilencedBySolo =
            isLoaded &&
            snapshot.soloTrackId !== null &&
            snapshot.soloTrackId !== track.id;

          return (
            <div
              key={track.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                track.isMine && "bg-ethereal-sage/5",
                (isMuted || isSilencedBySolo) && "opacity-55",
              )}
            >
              <div className="w-24 shrink-0 sm:w-28">
                <Eyebrow
                  color={track.isMine ? "incense" : "muted"}
                  className="block truncate"
                >
                  {track.label}
                </Eyebrow>
                {track.isMine && (
                  <Eyebrow color="sage" className="block">
                    {t("materials.player.your_voice_short", "Twój głos")}
                  </Eyebrow>
                )}
              </div>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) =>
                  ensureLoadedThen(() =>
                    engine.setVolume(track.id, Number(event.target.value)),
                  )
                }
                aria-label={t(
                  "materials.player.volume_for",
                  "Głośność: {{voice}}",
                  { voice: track.label },
                )}
                className="min-w-0 flex-1 accent-ethereal-sage"
              />

              <button
                type="button"
                onClick={() => ensureLoadedThen(() => engine.toggleMute(track.id))}
                aria-pressed={isMuted}
                aria-label={t("materials.player.mute_for", "Wycisz: {{voice}}", {
                  voice: track.label,
                })}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95",
                  isMuted
                    ? "border-ethereal-crimson/30 bg-ethereal-crimson/10 text-ethereal-crimson"
                    : "border-ethereal-marble bg-ethereal-alabaster text-ethereal-graphite hover:text-ethereal-ink",
                )}
              >
                {isMuted ? (
                  <VolumeX size={15} aria-hidden="true" />
                ) : (
                  <Volume2 size={15} aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => ensureLoadedThen(() => engine.setSolo(track.id))}
                aria-pressed={isSolo}
                aria-label={t("materials.player.solo_for", "Solo: {{voice}}", {
                  voice: track.label,
                })}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95",
                  isSolo
                    ? "border-ethereal-gold/40 bg-ethereal-gold/15 text-ethereal-gold"
                    : "border-ethereal-marble bg-ethereal-alabaster text-ethereal-graphite hover:text-ethereal-ink",
                )}
              >
                <Headphones size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
};
