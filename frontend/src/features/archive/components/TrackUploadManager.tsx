/**
 * @file TrackUploadManager.tsx
 * @description Component for uploading and managing individual audio rehearsal tracks (MIDI/MP3).
 * Delegates all HTTP requests and cache invalidation to strict React Query hooks.
 * @architecture Enterprise SaaS 2026
 * @module panel/archive/components/TrackUploadManager
 */

import React, { useState, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  UploadCloud,
  Trash2,
  Music2,
  PlayCircle,
} from "lucide-react";

import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Button } from "@ui/primitives/Button";
import { Select } from "@ui/primitives/Select";
import { Eyebrow, Text } from "@ui/primitives/typography";
import type { VoiceLineOption } from "@/shared/types";
import {
  useTracks,
  useUploadTrack,
  useDeleteTrack,
} from "../api/archive.queries";

interface TrackUploadManagerProps {
  pieceId: string | number;
  voiceLines: VoiceLineOption[];
}

export default function TrackUploadManager({
  pieceId,
  voiceLines,
}: TrackUploadManagerProps): React.JSX.Element {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadVoicePart, setUploadVoicePart] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [trackToDelete, setTrackToDelete] = useState<string | null>(null);

  const { data: tracks = [], isLoading } = useTracks(pieceId);
  const uploadMutation = useUploadTrack();
  const deleteMutation = useDeleteTrack();

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFile || !uploadVoicePart) {
      return;
    }

    const toastId = toast.loading(
      t("archive.tracks.uploading", "Wgrywanie nagrania..."),
    );

    try {
      await uploadMutation.mutateAsync({
        pieceId,
        voiceLine: uploadVoicePart,
        file: selectedFile,
      });

      toast.success(
        t("archive.tracks.upload_success", "Nagranie zostało dodane pomyślnie."),
        { id: toastId },
      );

      setSelectedFile(null);
      setUploadVoicePart("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      toast.error(
        t("archive.tracks.upload_error", "Błąd wgrywania. Upewnij się, że plik ma odpowiedni format."),
        { id: toastId },
      );
    }
  };

  const handleDelete = async () => {
    if (!trackToDelete) {
      return;
    }

    const toastId = toast.loading(
      t("archive.tracks.deleting", "Usuwanie nagrania..."),
    );

    try {
      await deleteMutation.mutateAsync(trackToDelete);
      toast.success(
        t("archive.tracks.delete_success", "Plik został usunięty z serwera."),
        { id: toastId },
      );
    } catch {
      toast.error(
        t("archive.tracks.delete_error", "Błąd podczas usuwania nagrania."),
        { id: toastId },
      );
    } finally {
      setTrackToDelete(null);
    }
  };

  const handleAudioPlay = (event: React.SyntheticEvent<HTMLAudioElement>) => {
    const target = event.currentTarget;
    document.querySelectorAll("audio").forEach((audioElement) => {
      if (audioElement !== target) {
        audioElement.pause();
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Upload section ── */}
      <GlassCard variant="ethereal" className="p-6 md:p-8">
        <SectionHeader
          title={t("archive.tracks.add_material", "Dodaj materiał ćwiczeniowy")}
          icon={<UploadCloud size={16} />}
        />
        <form onSubmit={handleUpload} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select
              label={t("archive.tracks.voice_part", "Partia wokalna *")}
              required
              value={uploadVoicePart}
              onChange={(event) => setUploadVoicePart(event.target.value)}
              disabled={uploadMutation.isPending}
            >
              <option value="">— {t("common.actions.select", "Wybierz")} —</option>
              <option value="TUTTI">{t("archive.tracks.tutti", "Tutti")}</option>
              {voiceLines.map((voiceLine) => (
                <option key={voiceLine.value} value={voiceLine.value}>
                  {voiceLine.label}
                </option>
              ))}
            </Select>

            <div>
              <Eyebrow as="label" color="muted" className="mb-2 ml-1 block">
                {t("archive.tracks.file_upload", "Plik audio (MP3/WAV/MIDI) *")}
              </Eyebrow>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] || null)
                }
                accept="audio/*,.mid,.midi"
                required
                disabled={uploadMutation.isPending}
                className="w-full text-sm text-ethereal-graphite file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-ethereal-gold/10 file:text-ethereal-gold hover:file:bg-ethereal-gold/20 transition-all cursor-pointer bg-ethereal-alabaster/60 backdrop-blur-sm border border-ethereal-incense/20 rounded-xl shadow-glass-ethereal"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-ethereal-incense/10">
            <Button
              type="submit"
              variant="primary"
              disabled={uploadMutation.isPending || !selectedFile || !uploadVoicePart}
              isLoading={uploadMutation.isPending}
              leftIcon={!uploadMutation.isPending ? <UploadCloud size={16} /> : undefined}
            >
              {t("archive.tracks.upload_button", "Wgraj nagranie")}
            </Button>
          </div>
        </form>
      </GlassCard>

      {/* ── Track list ── */}
      <div className="space-y-4">
        <Eyebrow className="border-b border-ethereal-incense/20 pb-2 flex items-center gap-2">
          {t("archive.tracks.uploaded_tracks", "Wgrane ścieżki audio")} ({tracks.length})
        </Eyebrow>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-ethereal-graphite/50" size={24} />
          </div>
        ) : tracks.length > 0 ? (
          tracks.map((track) => (
            <div
              key={track.id}
              className="bg-ethereal-alabaster/60 backdrop-blur-sm p-4 rounded-2xl border border-ethereal-incense/20 shadow-glass-ethereal flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-ethereal-gold/30"
            >
              <div className="flex items-center gap-3">
                <Eyebrow className="!mb-0 px-3 py-1.5 bg-ethereal-gold/10 text-ethereal-gold border border-ethereal-gold/20 rounded-lg flex items-center gap-2 w-max">
                  <PlayCircle size={14} aria-hidden="true" />{" "}
                  {track.voice_part_display || track.voice_part}
                </Eyebrow>
              </div>
              <audio
                controls
                controlsList="nodownload"
                className="w-full md:w-72 h-10 outline-none rounded-lg flex-1"
                onPlay={handleAudioPlay}
              >
                <source src={track.audio_file} type="audio/mpeg" />
              </audio>
              <Button
                variant="destructive"
                onClick={() => setTrackToDelete(String(track.id))}
                disabled={deleteMutation.isPending}
                className="self-end md:self-auto px-4 py-2"
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </div>
          ))
        ) : (
          <GlassCard
            variant="ethereal"
            className="flex flex-col items-center justify-center py-12 border-dashed border-ethereal-incense/30"
          >
            <Music2 size={32} className="mb-3 text-ethereal-graphite opacity-30" aria-hidden="true" />
            <Text size="xs" color="graphite" className="uppercase tracking-widest font-bold">
              {t("archive.tracks.no_files", "Brak plików audio")}
            </Text>
          </GlassCard>
        )}
      </div>

      <ConfirmModal
        isOpen={!!trackToDelete}
        title={t("archive.tracks.delete_confirm_title", "Usunąć nagranie z serwera?")}
        description={t(
          "archive.tracks.delete_confirm_desc",
          "Plik audio zostanie bezpowrotnie usunięty z bazy danych.",
        )}
        onConfirm={handleDelete}
        onCancel={() => setTrackToDelete(null)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
