/**
 * @file RehearsalSection.tsx
 * @description The rehearsal instrument inside the open score, as sections of
 * the stand's sheet (mounted through `sheetSection`), so it never floats over
 * the music. KAMERTON — the piece's starting pitches as playable voice chips
 * plus "Podaj dźwięki", which arpeggiates them top-voice-first the way a
 * conductor reads a pitch pipe (managers edit the list inline; it saves to the
 * piece). Tonic from `musical_key` is the fallback when no pitches are
 * configured yet. RECORDINGS — a compact remote for the multitrack practice
 * engine (play/pause, seek, one-tap presets), so audio can be driven without
 * closing the score; the engine lives above the sheet, so closing the sheet
 * does not stop it, while a pitch still sounding stops with the sheet.
 * @module features/materials/player
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Headphones,
  Mic,
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
import { Select } from "@/shared/ui/primitives/Select";
import { FIELD_TEXT_SCALE } from "@/shared/ui/primitives/fieldShell";
import { PITCH_NOTES, parseMusicalKeyTonic } from "@/shared/ui/instruments/PitchPipe";
import { PdfSheetSection } from "@/shared/ui/composites/PdfViewer";

import { useUpdateStartingPitches } from "../api/materials.queries";
import type { MaterialsPiece, MaterialsStartingPitch } from "../types/materials.dto";
import {
  buildPracticeSources,
  practiceTracksOf,
  usePracticePlayer,
} from "./PracticePlayerProvider";
import { formatPlayerTime } from "./PlayerTransport";
import { playPitchSequence, type PitchSequenceHandle } from "./pitchTones";
import { holdsTake, type PracticePreset } from "./practicePlayerEngine";

interface RehearsalSectionProps {
  piece: MaterialsPiece;
  projectId: string;
  /** Managers may set the piece's starting pitches inline. */
  canEditPitches: boolean;
}

const OCTAVES = [2, 3, 4, 5] as const;

/** Pitch names and octave numbers are notation, not copy — never translated. */
const NOTE_OPTIONS = PITCH_NOTES.map((label, index) => ({
  value: String(index),
  label,
}));

const OCTAVE_OPTIONS = OCTAVES.map((octave) => ({
  value: String(octave),
  label: String(octave),
}));

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

export const RehearsalSection = ({
  piece,
  projectId,
  canEditPitches,
}: RehearsalSectionProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { engine, snapshot } = usePracticePlayer();
  const updatePitches = useUpdateStartingPitches();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MaterialsStartingPitch[]>([]);
  /** "seq" while the full arpeggio sounds, a pitch index for a single chip. */
  const [playing, setPlaying] = useState<"seq" | number | null>(null);
  const toneRef = useRef<PitchSequenceHandle | null>(null);

  const pitches = useMemo(() => piece.starting_pitches ?? [], [piece.starting_pitches]);
  const hasTracks = practiceTracksOf(piece).length > 0;
  const isCurrentPiece = holdsTake(snapshot, piece.id, "practice");
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

  return (
    <>
          <PdfSheetSection
            title={t("materials.rehearsal_dock.pitch_pipe", "Kamerton")}
            action={
              canEditPitches && !editing ? (
                <button
                  type="button"
                  onClick={beginEdit}
                  aria-label={t("materials.rehearsal_dock.edit_pitches", "Edytuj dźwięki startowe")}
                  title={t("materials.rehearsal_dock.edit_pitches", "Edytuj dźwięki startowe")}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-on-inverse/60 hover:bg-ink-on-inverse/10 hover:text-ink-on-inverse"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              ) : undefined
            }
          >

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
                      className={cn(
                        "h-8 w-16 rounded-lg border border-ink-on-inverse/15 bg-ink-on-inverse/5 px-2 text-ink-on-inverse outline-none placeholder:text-ink-on-inverse/30 focus:border-ethereal-gold/50",
                        FIELD_TEXT_SCALE.xs,
                      )}
                    />
                    <Select
                      variant="dark"
                      size="sm"
                      value={String(row.note)}
                      onValueChange={(value) =>
                        setDraft((d) =>
                          d.map((r, i) =>
                            i === index ? { ...r, note: Number(value) } : r,
                          ),
                        )
                      }
                      ariaLabel={t("materials.rehearsal_dock.note_label", "Dźwięk")}
                      className="flex-1"
                      options={NOTE_OPTIONS}
                    />
                    <Select
                      variant="dark"
                      size="sm"
                      value={String(row.octave)}
                      onValueChange={(value) =>
                        setDraft((d) =>
                          d.map((r, i) =>
                            i === index ? { ...r, octave: Number(value) } : r,
                          ),
                        )
                      }
                      ariaLabel={t("materials.rehearsal_dock.octave_label", "Oktawa")}
                      className="w-16"
                      options={OCTAVE_OPTIONS}
                    />
                    <button
                      type="button"
                      onClick={() => setDraft((d) => d.filter((_, i) => i !== index))}
                      aria-label={t("materials.rehearsal_dock.remove_voice", "Usuń głos")}
                      className="rounded-full p-1 text-ink-on-inverse/50 hover:text-ethereal-crimson"
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
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-ink-on-inverse/70 hover:bg-ink-on-inverse/10 hover:text-ink-on-inverse"
                  >
                    <Plus size={12} aria-hidden="true" />
                    {t("materials.rehearsal_dock.add_voice", "Dodaj głos")}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-on-inverse/70 hover:bg-ink-on-inverse/10"
                    >
                      {t("common.actions.cancel", "Anuluj")}
                    </button>
                    <button
                      type="button"
                      onClick={saveDraft}
                      disabled={updatePitches.isPending}
                      className="flex items-center gap-1 rounded-full bg-ethereal-gold/90 px-3 py-1 text-[11px] font-semibold text-surface-inverse transition-colors hover:bg-ethereal-gold disabled:opacity-50"
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
                          ? "border-ethereal-gold bg-ethereal-gold text-surface-inverse"
                          : "border-ink-on-inverse/15 bg-ink-on-inverse/5 text-ink-on-inverse hover:border-ethereal-gold/50",
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
                      ? "bg-ink-on-inverse/15 text-ink-on-inverse"
                      : "bg-ethereal-gold/90 text-surface-inverse hover:bg-ethereal-gold",
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
                        ? "border-ethereal-gold bg-ethereal-gold text-surface-inverse"
                        : "border-ink-on-inverse/15 bg-ink-on-inverse/5 text-ink-on-inverse hover:border-ethereal-gold/50",
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
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-on-inverse/20 text-xs font-medium text-ink-on-inverse/70 transition-colors hover:border-ethereal-gold/50 hover:text-ink-on-inverse"
                  >
                    <Plus size={13} aria-hidden="true" />
                    {t("materials.rehearsal_dock.set_pitches", "Ustaw dźwięki startowe")}
                  </button>
                ) : (
                  <p className="text-xs text-ink-on-inverse/50">
                    {t("materials.rehearsal_dock.no_pitches", "Brak dźwięków startowych.")}
                  </p>
                )}
              </div>
            )}
          </PdfSheetSection>

          {/* ── practice-player transport ────────────────────────────── */}
          {hasTracks && (
            <PdfSheetSection title={t("materials.rehearsal_dock.recordings", "Nagrania do ćwiczeń")}>
              {!isCurrentPiece ? (
                <button
                  type="button"
                  onClick={handleLoadAndPlay}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-ink-on-inverse/10 text-xs font-semibold text-ink-on-inverse transition-colors hover:bg-ink-on-inverse/15"
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
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ethereal-gold/90 text-surface-inverse transition-colors hover:bg-ethereal-gold"
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
                    <span className="shrink-0 text-[10px] tabular-nums text-ink-on-inverse/60">
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
                              : "border-line-on-inverse bg-ink-on-inverse/5 text-ink-on-inverse/80 hover:border-ink-on-inverse/25",
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
            </PdfSheetSection>
          )}
    </>
  );
};
