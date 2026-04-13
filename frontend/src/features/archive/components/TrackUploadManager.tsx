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
  AlertCircle,
  PlayCircle,
} from "lucide-react";

import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { Button } from "@ui/primitives/Button";
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
        t(
          "archive.tracks.upload_success",
          "Nagranie zostało dodane pomyślnie.",
        ),
        { id: toastId },
      );

      setSelectedFile(null);
      setUploadVoicePart("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      toast.error(
        t(
          "archive.tracks.upload_error",
          "Błąd wgrywania. Upewnij się, że plik ma odpowiedni format.",
        ),
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
    <div className="space-y-10">
      <div className="bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-sm relative">
        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-brand mb-5 flex items-center gap-2 border-b border-stone-200/60 pb-2">
          <UploadCloud size={14} />{" "}
          {t("archive.tracks.add_material", "Dodaj materiał ćwiczeniowy")}
        </h4>
        <form onSubmit={handleUpload} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">
                {t("archive.tracks.voice_part", "Partia wokalna *")}
              </label>
              <select
                required
                value={uploadVoicePart}
                onChange={(event) => setUploadVoicePart(event.target.value)}
                className="w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all font-bold appearance-none"
                disabled={uploadMutation.isPending}
              >
                <option value="">
                  — {t("common.actions.select", "Wybierz")} —
                </option>
                <option value="TUTTI">
                  {t("archive.tracks.tutti", "Tutti")}
                </option>
                {voiceLines.map((voiceLine) => (
                  <option key={voiceLine.value} value={voiceLine.value}>
                    {voiceLine.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">
                {t("archive.tracks.file_upload", "Plik audio (MP3/WAV/MIDI) *")}
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] || null)
                }
                accept="audio/*,.mid,.midi"
                required
                disabled={uploadMutation.isPending}
                className="w-full text-sm text-stone-600 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-brand file:text-white hover:file:bg-brand-dark transition-all cursor-pointer bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-stone-100">
            <Button
              type="submit"
              variant="primary"
              disabled={
                uploadMutation.isPending || !selectedFile || !uploadVoicePart
              }
              isLoading={uploadMutation.isPending}
              leftIcon={
                !uploadMutation.isPending ? (
                  <UploadCloud size={16} />
                ) : undefined
              }
            >
              {t("archive.tracks.upload_button", "Wgraj nagranie")}
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-4 border-b border-stone-200/60 pb-2">
          {t("archive.tracks.uploaded_tracks", "Wgrane ścieżki audio")} (
          {tracks.length})
        </h4>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-stone-400" size={24} />
          </div>
        ) : tracks.length > 0 ? (
          tracks.map((track) => (
            <div
              key={track.id}
              className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-brand/30"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-widest font-bold antialiased text-brand bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-2 w-max">
                  <PlayCircle size={14} aria-hidden="true" />{" "}
                  {track.voice_part_display || track.voice_part}
                </span>
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
                variant="danger"
                onClick={() => setTrackToDelete(String(track.id))}
                disabled={deleteMutation.isPending}
                className="self-end md:self-auto px-4 py-2"
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-stone-400 bg-white/40 border border-dashed border-stone-300/60 rounded-2xl">
            <AlertCircle size={32} className="mb-3 opacity-30" />
            <p className="text-[10px] font-bold antialiased uppercase tracking-widest">
              {t("archive.tracks.no_files", "Brak plików audio")}
            </p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!trackToDelete}
        title={t(
          "archive.tracks.delete_confirm_title",
          "Usunąć nagranie z serwera?",
        )}
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
