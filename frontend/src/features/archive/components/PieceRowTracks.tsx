/**
 * @file PieceRowTracks.tsx
 * @description Slim inline tracks manager used inside [PieceRowExpanded].
 * Compact alternative to the standalone TrackUploadManager — no GlassCard
 * chrome, no section header. Lists existing tracks with mini audio players,
 * plus a slide-in "Add MP3" form that appears when the user clicks the
 * upload button.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceRowTracks
 */

import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, UploadCloud, X } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { useVoiceLines } from "@/shared/api/options.queries";

import type { EnrichedPiece } from "../types/archive.dto";
import {
  useTracks,
  useUploadTrack,
  useDeleteTrack,
} from "../api/archive.queries";

interface PieceRowTracksProps {
  readonly piece: EnrichedPiece;
}

const stopRowToggle = (event: React.SyntheticEvent) => event.stopPropagation();

export const PieceRowTracks = ({
  piece,
}: PieceRowTracksProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: tracks = [], isLoading } = useTracks(piece.id);
  const { data: voiceLines = [] } = useVoiceLines();
  const uploadMutation = useUploadTrack();
  const deleteMutation = useDeleteTrack();

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [voicePart, setVoicePart] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const resetAddForm = () => {
    setIsAdding(false);
    setVoicePart("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !voicePart) return;
    const toastId = toast.loading(
      t("archive.row_tracks.uploading", "Wgrywanie ścieżki…"),
    );
    try {
      await uploadMutation.mutateAsync({
        pieceId: piece.id,
        voiceLine: voicePart,
        file,
      });
      toast.success(
        t("archive.row_tracks.upload_success", "Ścieżka dodana."),
        { id: toastId },
      );
      resetAddForm();
    } catch {
      toast.error(
        t(
          "archive.row_tracks.upload_error",
          "Błąd wgrywania. Sprawdź format pliku (MP3/WAV/MIDI).",
        ),
        { id: toastId },
      );
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    const toastId = toast.loading(
      t("archive.row_tracks.deleting", "Usuwanie ścieżki…"),
    );
    try {
      await deleteMutation.mutateAsync(pendingDeleteId);
      toast.success(t("archive.row_tracks.delete_success", "Ścieżka usunięta."), {
        id: toastId,
      });
    } catch {
      toast.error(
        t("archive.row_tracks.delete_error", "Nie udało się usunąć."),
        { id: toastId },
      );
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleAudioPlay = (event: React.SyntheticEvent<HTMLAudioElement>) => {
    const target = event.currentTarget;
    document.querySelectorAll("audio").forEach((el) => {
      if (el !== target) el.pause();
    });
  };

  return (
    <div className="space-y-3" onClick={stopRowToggle}>
      {isLoading ? (
        <Caption color="muted" className="flex items-center gap-2">
          <Loader2 size={11} className="animate-spin" />
          {t("archive.row_tracks.loading", "Ładowanie…")}
        </Caption>
      ) : (
        <ul role="list" className="flex flex-col gap-2">
          {tracks.map((track) => (
            <li
              key={track.id}
              className="flex items-center gap-3 rounded-lg border border-ethereal-incense/15 bg-ethereal-alabaster/70 px-3 py-2"
            >
              <span
                className="inline-flex h-6 min-w-12 items-center justify-center rounded-md border border-ethereal-gold/25 bg-ethereal-gold/10 px-2 text-[10px] font-bold uppercase tracking-widest text-ethereal-gold"
                aria-hidden="true"
              >
                {track.voice_part_display || track.voice_part}
              </span>
              <audio
                controls
                controlsList="nodownload"
                className="h-9 flex-1 outline-none"
                onPlay={handleAudioPlay}
                onClick={stopRowToggle}
              >
                <source src={track.audio_file} type="audio/mpeg" />
              </audio>
              <Button
                variant="icon"
                size="icon"
                onClick={() => setPendingDeleteId(String(track.id))}
                disabled={deleteMutation.isPending}
                aria-label={t(
                  "archive.row_tracks.delete_aria",
                  "Usuń ścieżkę {{label}}",
                  { label: track.voice_part_display || track.voice_part },
                )}
                className="h-8 w-8 text-ethereal-graphite hover:text-ethereal-crimson"
              >
                <Trash2 size={13} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <form
          onSubmit={handleUpload}
          className="flex flex-col gap-2 rounded-lg border border-ethereal-gold/30 bg-ethereal-gold/5 p-3 md:flex-row md:items-center"
        >
          <Select
            value={voicePart}
            onChange={(event) => setVoicePart(event.target.value)}
            disabled={uploadMutation.isPending}
            required
            className="md:w-40"
            aria-label={t("archive.row_tracks.voice_part", "Partia wokalna")}
          >
            <option value="">— {t("archive.row_tracks.pick", "Wybierz")} —</option>
            <option value="TUTTI">{t("archive.row_tracks.tutti", "Tutti")}</option>
            {voiceLines.map((vl) => (
              <option key={vl.value} value={vl.value}>
                {vl.label}
              </option>
            ))}
          </Select>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mid,.midi"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            required
            disabled={uploadMutation.isPending}
            className="flex-1 text-[12px] text-ethereal-graphite file:mr-3 file:rounded-md file:border-0 file:bg-ethereal-gold/10 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:text-ethereal-gold hover:file:bg-ethereal-gold/20"
          />
          <div className="flex gap-1.5">
            <Button
              type="submit"
              size="sm"
              disabled={uploadMutation.isPending || !file || !voicePart}
              isLoading={uploadMutation.isPending}
              leftIcon={
                !uploadMutation.isPending ? (
                  <UploadCloud size={13} aria-hidden="true" />
                ) : undefined
              }
            >
              {t("archive.row_tracks.upload_btn", "Wgraj")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAddForm}
              disabled={uploadMutation.isPending}
              aria-label={t("common.actions.cancel", "Anuluj")}
            >
              <X size={13} aria-hidden="true" />
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          leftIcon={<Plus size={13} aria-hidden="true" />}
        >
          {tracks.length === 0
            ? t("archive.row_tracks.add_first", "Dodaj pierwszą ścieżkę")
            : t("archive.row_tracks.add_more", "Dodaj kolejną ścieżkę")}
        </Button>
      )}

      {tracks.length === 0 && !isAdding && (
        <Text size="xs" color="graphite" className="italic">
          {t(
            "archive.row_tracks.empty_hint",
            "MP3 dla głosów dostępne dla śpiewaków w zakładce Materiały.",
          )}
        </Text>
      )}

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        isDestructive
        title={t("archive.row_tracks.delete_title", "Usunąć ścieżkę?")}
        description={t(
          "archive.row_tracks.delete_desc",
          "Plik audio zostanie usunięty z serwera. Tej operacji nie da się cofnąć.",
        )}
        confirmText={t("archive.row_tracks.delete_confirm", "Usuń ścieżkę")}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isLoading={deleteMutation.isPending}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
