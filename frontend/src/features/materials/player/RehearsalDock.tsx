/**
 * @file RehearsalDock.tsx
 * @description The rehearsal instrument inside the open score (mounted through
 * PdfViewer.overlaySlot): a bottom-left pill that expands into a dark glass
 * panel with two sections. PITCHES — the piece's starting pitches as playable
 * voice chips plus "Podaj dźwięki", which arpeggiates them top-voice-first the
 * way a conductor reads a pitch pipe (managers edit the list inline; it saves
 * to the piece). TRANSPORT — a compact remote for the multitrack practice
 * engine (play/pause, seek, one-tap presets), so audio can be driven without
 * closing the score. Tonic from `musical_key` is the fallback when no pitches
 * are configured yet.
 * @module features/materials/player
 * @architecture Enterprise SaaS 2026
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Headphones,
  Mic,
  Music4,
  Pause,
  Pencil,
  Play,
  Plus,
  Square,
  User,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { PITCH_NOTES, parseMusicalKeyTonic } from "@/shared/ui/instruments/PitchPipe";

import { useUpdateStartingPitches } from "../api/materials.queries";
import type { MaterialsPiece, MaterialsStartingPitch } from "../types/materials.dto";
import {
  buildPracticeSources,
  usePracticePlayer,
} from "./PracticePlayerProvider";
import { formatPlayerTime } from "./VoiceMixerPanel";
import { playPitchSequence, type PitchSequenceHandle } from "./pitchTones";
import type { PracticePreset } from "./practicePlayerEngine";

interface RehearsalDockProps {
  piece: MaterialsPiece;
  projectId: string;
  /** Managers may set the piece's starting pitches inline. */
  canEditPitches: boolean;
}

const OCTAVES = [2, 3, 4, 5] as const;

/** Sensible first draft when a conductor sets pitches on a blank piece. */
const DEFAULT_PITCH_TEMPLATE: MaterialsStartingPitch[] = [
  { voice: "S", note: 9, octave: 4 },
  { voice: "A", note: 9, octave: 4 },
  { voice: "T", note: 9, octave: 3 },
  { voice: "B", note: 9, octave: 3 },
];

const PRESETS: readonly {
  id: PracticePreset;
  labelKey: string;
  fallback: string;
  Icon: typeof Users;
  requiresMine: boolean;
}[] = [
  { id: "blend", labelKey: "materials.player.preset_blend", fallback: "Cały chór", Icon: Users, requiresMine: false },
  { id: "solo-mine", labelKey: "materials.player.preset_solo_mine", fallback: "Tylko mój głos", Icon: User, requiresMine: true },
  { id: "minus-mine", labelKey: "materials.player.preset_minus_mine", fallback: "Bez mojego głosu", Icon: Mic, requiresMine: true },
];

const pitchLabel = (pitch: MaterialsStartingPitch): string =>
  `${PITCH_NOTES[pitch.note] ?? "?"}${pitch.octave}`;

const sectionLabel =
  "mb-2 text-[11px] uppercase tracking-wide text-ethereal-marble/50";

export const RehearsalDock = ({
  piece,
  projectId,
  canEditPitches,
}: RehearsalDockProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { engine, snapshot } = usePracticePlayer();
  const updatePitches = useUpdateStartingPitches();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MaterialsStartingPitch[]>([]);
  /** "seq" while the full arpeggio sounds, a pitch index for a single chip. */
  const [playing, setPlaying] = useState<"seq" | number | null>(null);
  const toneRef = useRef<PitchSequenceHandle | null>(null);

  const pitches = useMemo(() => piece.starting_pitches ?? [], [piece.starting_pitches]);
  const hasTracks = piece.tracks.length > 0;
  const isCurrentPiece = snapshot.piece?.pieceId === piece.id;
  const suggestedTonic = piece.musical_key
    ? parseMusicalKeyTonic(piece.musical_key)
    : null;

  const stopTones = useCallback(() => {
    toneRef.current?.stop();
    toneRef.current = null;
    setPlaying(null);
  }, []);

  // Never leave an oscillator sounding after the viewer closes.
  useEffect(() => () => toneRef.current?.stop(), []);

  const playAll = useCallback(
    (list: ReadonlyArray<MaterialsStartingPitch>) => {
      stopTones();
      setPlaying("seq");
      toneRef.current = playPitchSequence(list, () => setPlaying(null));
    },
    [stopTones],
  );

  const playOne = useCallback(
    (pitch: MaterialsStartingPitch, index: number) => {
      stopTones();
      setPlaying(index);
      toneRef.current = playPitchSequence([pitch], () => setPlaying(null));
    },
    [stopTones],
  );

  const beginEdit = useCallback(() => {
    setDraft(pitches.length > 0 ? pitches.map((p) => ({ ...p })) : DEFAULT_PITCH_TEMPLATE.map((p) => ({ ...p })));
    setEditing(true);
  }, [pitches]);

  const saveDraft = useCallback(() => {
    const cleaned = draft
      .map((row) => ({ ...row, voice: row.voice.trim().slice(0, 16) }))
      .filter((row) => row.voice.length > 0);
    updatePitches.mutate(
      { pieceId: piece.id, pitches: cleaned },
      { onSuccess: () => setEditing(false) },
    );
  }, [draft, piece.id, updatePitches]);

  const handleLoadAndPlay = useCallback(() => {
    const { source, tracks } = buildPracticeSources(piece, projectId);
    engine.load(source, tracks, { autoplay: true });
  }, [engine, piece, projectId]);

  const hasMine = piece.my_casting !== null;

  if (!open) {
    return (
      <div className="pointer-events-none absolute bottom-20 left-3 z-10 sm:bottom-24 sm:left-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("materials.rehearsal_dock.open_aria", "Otwórz instrumenty próby")}
          className="pointer-events-auto flex h-11 items-center gap-1.5 rounded-full border border-white/10 bg-ethereal-ink/70 px-3.5 text-ethereal-marble shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-colors hover:bg-ethereal-ink/85"
        >
          <Music4 size={17} aria-hidden="true" />
          <span className="text-sm font-medium">
            {t("materials.rehearsal_dock.pitch_pipe", "Kamerton")}
          </span>
          {hasTracks && <Headphones size={14} className="opacity-70" aria-hidden="true" />}
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute bottom-20 left-3 z-10 sm:bottom-24 sm:left-6">
      <div className="pointer-events-auto flex w-[19.5rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-ethereal-ink/85 text-ethereal-marble shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Music4 size={15} aria-hidden="true" />
            {t("materials.rehearsal_dock.title", "Instrumenty próby")}
          </span>
          <button
            type="button"
            onClick={() => {
              stopTones();
              setOpen(false);
              setEditing(false);
            }}
            aria-label={t("common.close_aria", "Zamknij")}
            className="rounded-full p-1 text-ethereal-marble/70 hover:bg-white/10 hover:text-white"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-col gap-4 px-4 py-3">
          {/* ── starting pitches ─────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between">
              <p className={sectionLabel}>
                {t("materials.rehearsal_dock.starting_pitches", "Dźwięki startowe")}
              </p>
              {canEditPitches && !editing && (
                <button
                  type="button"
                  onClick={beginEdit}
                  aria-label={t("materials.rehearsal_dock.edit_pitches", "Edytuj dźwięki startowe")}
                  className="rounded-full p-1 text-ethereal-marble/60 hover:bg-white/10 hover:text-white"
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
              )}
            </div>

            {editing ? (
              <div className="flex flex-col gap-1.5">
                {draft.map((row, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={row.voice}
                      maxLength={16}
                      onChange={(e) =>
                        setDraft((d) =>
                          d.map((r, i) => (i === index ? { ...r, voice: e.target.value } : r)),
                        )
                      }
                      placeholder={t("materials.rehearsal_dock.voice_placeholder", "Głos")}
                      aria-label={t("materials.rehearsal_dock.voice_placeholder", "Głos")}
                      className="h-8 w-16 rounded-lg border border-white/15 bg-white/5 px-2 text-xs text-ethereal-marble outline-none placeholder:text-ethereal-marble/30 focus:border-ethereal-gold/50"
                    />
                    <select
                      value={row.note}
                      onChange={(e) =>
                        setDraft((d) =>
                          d.map((r, i) =>
                            i === index ? { ...r, note: Number(e.target.value) } : r,
                          ),
                        )
                      }
                      aria-label={t("materials.rehearsal_dock.note_label", "Dźwięk")}
                      className="h-8 flex-1 rounded-lg border border-white/15 bg-ethereal-ink px-1.5 text-xs text-ethereal-marble outline-none focus:border-ethereal-gold/50"
                    >
                      {PITCH_NOTES.map((label, value) => (
                        <option key={label} value={value}>{label}</option>
                      ))}
                    </select>
                    <select
                      value={row.octave}
                      onChange={(e) =>
                        setDraft((d) =>
                          d.map((r, i) =>
                            i === index ? { ...r, octave: Number(e.target.value) } : r,
                          ),
                        )
                      }
                      aria-label={t("materials.rehearsal_dock.octave_label", "Oktawa")}
                      className="h-8 w-14 rounded-lg border border-white/15 bg-ethereal-ink px-1.5 text-xs text-ethereal-marble outline-none focus:border-ethereal-gold/50"
                    >
                      {OCTAVES.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setDraft((d) => d.filter((_, i) => i !== index))}
                      aria-label={t("materials.rehearsal_dock.remove_voice", "Usuń głos")}
                      className="rounded-full p-1 text-ethereal-marble/50 hover:text-ethereal-crimson"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}

                <div className="mt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => [...d, { voice: "", note: 9, octave: 4 }])
                    }
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-ethereal-marble/70 hover:bg-white/10 hover:text-white"
                  >
                    <Plus size={12} aria-hidden="true" />
                    {t("materials.rehearsal_dock.add_voice", "Dodaj głos")}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium text-ethereal-marble/70 hover:bg-white/10"
                    >
                      {t("common.actions.cancel", "Anuluj")}
                    </button>
                    <button
                      type="button"
                      onClick={saveDraft}
                      disabled={updatePitches.isPending}
                      className="flex items-center gap-1 rounded-full bg-ethereal-gold/90 px-3 py-1 text-[11px] font-semibold text-ethereal-ink transition-colors hover:bg-ethereal-gold disabled:opacity-50"
                    >
                      <Check size={12} aria-hidden="true" />
                      {t("common.actions.save", "Zapisz")}
                    </button>
                  </div>
                </div>
              </div>
            ) : pitches.length > 0 ? (
              <>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {pitches.map((pitch, index) => (
                    <button
                      key={`${pitch.voice}-${index}`}
                      type="button"
                      onClick={() =>
                        playing === index ? stopTones() : playOne(pitch, index)
                      }
                      aria-pressed={playing === index}
                      className={cn(
                        "flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors",
                        playing === index
                          ? "border-ethereal-gold bg-ethereal-gold text-ethereal-ink"
                          : "border-white/15 bg-white/5 text-ethereal-marble hover:border-ethereal-gold/50",
                      )}
                    >
                      <span className="opacity-70">{pitch.voice}</span>
                      <span className="font-semibold tabular-nums">{pitchLabel(pitch)}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => (playing === "seq" ? stopTones() : playAll(pitches))}
                  className={cn(
                    "flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors",
                    playing === "seq"
                      ? "bg-white/15 text-white"
                      : "bg-ethereal-gold/90 text-ethereal-ink hover:bg-ethereal-gold",
                  )}
                >
                  {playing === "seq" ? (
                    <>
                      <Square size={13} aria-hidden="true" />
                      {t("materials.rehearsal_dock.stop_pitches", "Zatrzymaj")}
                    </>
                  ) : (
                    <>
                      <Play size={13} aria-hidden="true" />
                      {t("materials.rehearsal_dock.give_pitches", "Podaj dźwięki")}
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                {suggestedTonic !== null && (
                  <button
                    type="button"
                    onClick={() =>
                      playing === 0
                        ? stopTones()
                        : playOne({ voice: "", note: suggestedTonic, octave: 4 }, 0)
                    }
                    aria-pressed={playing === 0}
                    className={cn(
                      "flex h-8 w-fit items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                      playing === 0
                        ? "border-ethereal-gold bg-ethereal-gold text-ethereal-ink"
                        : "border-white/15 bg-white/5 text-ethereal-marble hover:border-ethereal-gold/50",
                    )}
                  >
                    {t("materials.rehearsal_dock.tonic", "Tonika: {{note}}", {
                      note: PITCH_NOTES[suggestedTonic],
                    })}
                  </button>
                )}
                {canEditPitches ? (
                  <button
                    type="button"
                    onClick={beginEdit}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 text-xs font-medium text-ethereal-marble/70 transition-colors hover:border-ethereal-gold/50 hover:text-ethereal-marble"
                  >
                    <Plus size={13} aria-hidden="true" />
                    {t("materials.rehearsal_dock.set_pitches", "Ustaw dźwięki startowe")}
                  </button>
                ) : (
                  <p className="text-xs text-ethereal-marble/50">
                    {t("materials.rehearsal_dock.no_pitches", "Brak dźwięków startowych.")}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── practice-player transport ────────────────────────────── */}
          {hasTracks && (
            <section>
              <p className={sectionLabel}>
                {t("materials.rehearsal_dock.recordings", "Nagrania do ćwiczeń")}
              </p>
              {!isCurrentPiece ? (
                <button
                  type="button"
                  onClick={handleLoadAndPlay}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 text-xs font-semibold text-ethereal-marble transition-colors hover:bg-white/15"
                >
                  <Headphones size={13} aria-hidden="true" />
                  {t("materials.rehearsal_dock.load_play", "Odtwórz nagrania")}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => engine.toggle()}
                      aria-label={
                        snapshot.isPlaying
                          ? t("materials.player.pause", "Pauza")
                          : t("materials.player.play", "Odtwarzaj")
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ethereal-gold/90 text-ethereal-ink transition-colors hover:bg-ethereal-gold"
                    >
                      {snapshot.isPlaying ? (
                        <Pause size={15} aria-hidden="true" />
                      ) : (
                        <Play size={15} aria-hidden="true" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(snapshot.duration, 1)}
                      step={1}
                      value={Math.min(snapshot.position, snapshot.duration || snapshot.position)}
                      onChange={(e) => engine.seek(Number(e.target.value))}
                      aria-label={t("materials.player.seek", "Przewiń")}
                      className="h-1 w-full accent-ethereal-gold"
                    />
                    <span className="shrink-0 text-[10px] tabular-nums text-ethereal-marble/60">
                      {formatPlayerTime(snapshot.position)} / {formatPlayerTime(snapshot.duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {PRESETS.map(({ id, labelKey, fallback, Icon, requiresMine }) => {
                      const blocked = requiresMine && !hasMine;
                      const active = snapshot.activePreset === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={blocked}
                          onClick={() => engine.applyPreset(id)}
                          aria-pressed={active}
                          title={
                            blocked
                              ? t(
                                  "materials.player.preset_needs_my_voice",
                                  "Brak Twojego głosu w tym utworze",
                                )
                              : t(labelKey, fallback)
                          }
                          className={cn(
                            "flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border text-[10px] font-medium transition-colors",
                            active
                              ? "border-ethereal-gold/50 bg-ethereal-gold/15 text-ethereal-gold"
                              : "border-white/10 bg-white/5 text-ethereal-marble/80 hover:border-white/25",
                            blocked && "opacity-40",
                          )}
                        >
                          <Icon size={11} aria-hidden="true" />
                          <span className="truncate">{t(labelKey, fallback)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
