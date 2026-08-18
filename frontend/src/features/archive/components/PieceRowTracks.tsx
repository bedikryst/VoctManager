/**
 * @file PieceRowTracks.tsx
 * @description Slim inline tracks manager used inside [PieceRowExpanded].
 * Compact alternative to the standalone TrackUploadManager — no GlassCard
 * chrome, no section header. Lists existing tracks with mini audio players,
 * plus a slide-in "Add MP3" form that appears when the user clicks the
 * upload button.
 *
 * Each row states the file it was made from, because a player alone cannot
 * answer the only question a manager has here — whether the take sitting on
 * the alto line is the alto take. The note beside it travels on to the singer;
 * the filename does not.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceRowTracks
 */

import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { toastApiError } from "@/shared/api/errors";
import { Loader2, Plus, Trash2, UploadCloud, X } from "lucide-react";

import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { useVoiceLines } from "@/shared/api/options.queries";
import { collapseVoiceLabels } from "@/shared/lib/voiceLabels";

import { scopedToEdition } from "../constants/divisiScope";
import { getPiecePdfLinks } from "../constants/piecePdfs";
import type { EnrichedPiece } from "../types/archive.dto";
import {
  useTracks,
  useUploadTrack,
  useUpdateTrack,
  useDeleteTrack,
} from "../api/archive.queries";

interface PieceRowTracksProps {
  readonly piece: EnrichedPiece;
}

const stopRowToggle = (event: React.SyntheticEvent) => event.stopPropagation();

/** Last path segment of a stored file — the fallback for tracks uploaded
 *  before the original name was kept. */
const storedFileName = (url: string): string => {
  const path = url.split("?")[0];
  return decodeURIComponent(path.slice(path.lastIndexOf("/") + 1));
};

export const PieceRowTracks = ({
  piece,
}: PieceRowTracksProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: tracks = [], isLoading } = useTracks(piece.id);
  const { data: voiceLines = [] } = useVoiceLines();
  const uploadMutation = useUploadTrack();
  const updateMutation = useUpdateTrack();
  const deleteMutation = useDeleteTrack();

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [voicePart, setVoicePart] = useState<string>("");
  const [editionId, setEditionId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Per-edition tracks only make sense once there is more than one arrangement
  // to tell apart; below that the control would ask a question with one answer.
  const editions = useMemo(() => getPiecePdfLinks(piece), [piece]);
  const showEditionPicker = editions.length > 1;

  // A track is named inside its own arrangement, so a piece with one tenor
  // line reads "Tenor" here exactly as it will in the singer's materials.
  const labelsByEdition = useMemo(() => {
    // Without the dictionary a "collapsed" label is just the raw code, which
    // reads worse than the server's own display — so wait for it to land.
    if (voiceLines.length === 0) return new Map<string, Record<string, string>>();
    const requirements = piece.voice_requirements_read ?? [];
    const keys = new Set(tracks.map((track) => track.edition ?? ""));
    return new Map(
      Array.from(keys, (key) => {
        const scope = [
          // Through `scopedToEdition`, exactly as the server resolves it: an
          // edition that declares no divisi of its own is read against the
          // piece-wide layer, never against its own takes alone. Filtering the
          // rows by hand here would name a lone take "Tenor" while the singer's
          // materials — which do fall back — say "Tenor 1".
          ...scopedToEdition(requirements, key || null).map((requirement) =>
            String(requirement.voice_line),
          ),
          ...tracks
            .filter((other) => (other.edition ?? "") === key)
            .map((other) => String(other.voice_part)),
        ];
        return [key, collapseVoiceLabels(scope, voiceLines, t)] as const;
      }),
    );
  }, [piece.voice_requirements_read, tracks, voiceLines, t]);

  const resetAddForm = () => {
    setIsAdding(false);
    setVoicePart("");
    setEditionId("");
    setNote("");
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
        description: note.trim(),
        editionId: editionId || null,
      });
      toast.success(
        t("archive.row_tracks.upload_success", "Ścieżka dodana."),
        { id: toastId },
      );
      resetAddForm();
    } catch (error) {
      toastApiError(error, t, { id: toastId, fallbackDescription: t(
          "archive.row_tracks.upload_error",
          "Błąd wgrywania. Sprawdź format pliku (MP3/WAV/MIDI).",
        ) });
    }
  };

  const handleNoteSave = async (trackId: string, value: string) => {
    try {
      await updateMutation.mutateAsync({
        trackId,
        patch: { description: value.trim() },
      });
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t(
          "archive.row_tracks.note_error",
          "Nie udało się zapisać komentarza.",
        ),
      });
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
    } catch (error) {
      toastApiError(error, t, { id: toastId, fallbackDescription: t("archive.row_tracks.delete_error", "Nie udało się usunąć.") });
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
          {tracks.map((track) => {
            const partLabel =
              labelsByEdition.get(track.edition ?? "")?.[
                String(track.voice_part)
              ] ||
              track.voice_part_display ||
              track.voice_part;
            const editionLabel = editions.find(
              (edition) => edition.id === track.edition,
            )?.label;
            const fileName =
              track.original_filename?.trim() ||
              storedFileName(track.audio_file);
            return (
              <li
                key={track.id}
                className="flex flex-col gap-2 rounded-nested border border-hairline bg-ethereal-alabaster/70 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="warning"
                    className="min-w-12 shrink-0 justify-center py-0.5"
                    aria-hidden="true"
                  >
                    {partLabel}
                  </Badge>
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
                      { label: partLabel },
                    )}
                    className="h-8 w-8 text-ethereal-graphite hover:text-ethereal-crimson"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1">
                  <InlineEditable
                    value={track.description ?? ""}
                    onSave={(value) => handleNoteSave(String(track.id), value)}
                    placeholder={t(
                      "archive.row_tracks.note_placeholder",
                      "Dodaj komentarz",
                    )}
                    ariaLabel={t(
                      "archive.row_tracks.note_aria",
                      "Komentarz do ścieżki {{label}}",
                      { label: partLabel },
                    )}
                  />
                  <Caption color="muted" className="truncate">
                    {editionLabel ? `${editionLabel} · ${fileName}` : fileName}
                  </Caption>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isAdding ? (
        <form
          onSubmit={handleUpload}
          className="flex flex-col gap-2 rounded-nested border border-ethereal-gold/30 bg-ethereal-gold/5 p-3"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Select
              value={voicePart}
              onValueChange={setVoicePart}
              disabled={uploadMutation.isPending}
              required
              className="md:w-40"
              placeholder={t("archive.row_tracks.pick", "Wybierz")}
              ariaLabel={t("archive.row_tracks.voice_part", "Partia wokalna")}
              options={voiceLines}
            />
            {showEditionPicker && (
              <Select
                value={editionId}
                onValueChange={setEditionId}
                disabled={uploadMutation.isPending}
                className="md:w-52"
                placeholder={t(
                  "archive.row_tracks.edition_any",
                  "Wspólne dla wydań",
                )}
                ariaLabel={t("archive.row_tracks.edition", "Wydanie")}
                options={editions.map((edition) => ({
                  value: edition.id,
                  label: edition.label,
                }))}
              />
            )}
            {/* The native file button is a CONTROL, so it wears the control
                recipe (radius, sentence case) rather than an overline. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mid,.midi"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              required
              disabled={uploadMutation.isPending}
              className="flex-1 text-xs text-ethereal-graphite file:mr-3 file:rounded-control file:border-0 file:bg-ethereal-gold/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ethereal-gold hover:file:bg-ethereal-gold/20"
            />
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={uploadMutation.isPending}
              maxLength={200}
              placeholder={t(
                "archive.row_tracks.note_hint",
                "Komentarz dla śpiewaków (np. „od taktu 34, tempo 90”)",
              )}
              aria-label={t("archive.row_tracks.note", "Komentarz")}
              className="flex-1"
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
