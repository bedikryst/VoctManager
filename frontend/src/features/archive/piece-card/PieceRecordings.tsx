/**
 * @file PieceRecordings.tsx
 * @description Reference recording links, featured choices and manual additions.
 */

import { ArrowUpRight, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import type { Piece, Recording } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Text } from "@/shared/ui/primitives/typography";
import { useCreateRecording, useDeleteRecording, useUpdateRecording } from "../api/archive.queries";
import { formText, RecordAdd, RecordRemove } from "./RecordActions";
import type { PieceAutosave } from "./usePieceAutosave";

interface PieceRecordingsProps {
  readonly piece: Piece;
  readonly autosave: PieceAutosave;
}

const parseRecordingUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

const RecordingRow = ({ piece, recording, autosave }: PieceRecordingsProps & { recording: Recording }) => {
  const { t } = useTranslation();
  const remove = useDeleteRecording();
  const update = useUpdateRecording();
  const pieceId = String(piece.id);
  const { id, is_featured: featured } = recording;
  const toggleFeatured = () => {
    void autosave.saveValue(
      `${id}:is_featured`,
      !featured,
      (current) => current.recordings.find((row) => row.id === id)?.is_featured,
      async (is_featured) => (await update.mutateAsync({ pieceId, id, data: { is_featured } })).is_featured,
    ).catch(autosave.showSaveError);
  };
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-hairline py-2">
      <div className="min-w-0 flex-1">
        <Text className="wrap-anywhere">{recording.performer || t("archive.review.unknown_performer")}</Text>
        <Text size="sm" color="muted">
          {[recording.source_display || recording.source, recording.year].filter(Boolean).join(" · ")}
        </Text>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("min-h-8 px-2", featured && "text-ethereal-gold")}
          aria-label={featured ? t("archive.review.unfeature") : t("archive.review.feature")}
          aria-pressed={featured}
          onClick={toggleFeatured}
        >
          <Star size={16} fill={featured ? "currentColor" : "none"} aria-hidden="true" />
        </Button>
        {recording.url && (
          <Button asChild variant="ghost" size="sm" className="min-h-8 px-2">
            <a href={recording.url} target="_blank" rel="noopener noreferrer" aria-label={t("archive.review.open_recording")}>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </Button>
        )}
        <RecordRemove label={t("archive.review.delete_recording")} autosave={autosave} remove={() => remove.mutateAsync({ pieceId, id })} />
      </div>
    </li>
  );
};

export const PieceRecordings = ({ piece, autosave }: PieceRecordingsProps) => {
  const { t } = useTranslation();
  const create = useCreateRecording();
  const recordings = piece.recordings ?? [];
  return (
    <div className="space-y-1">
      {recordings.length > 0 && (
        <ul className="border-b border-hairline">
          {recordings.map((recording) => <RecordingRow key={recording.id} {...{ piece, recording, autosave }} />)}
        </ul>
      )}
      <RecordAdd label={t("archive.piece_card.add_recording")} onSubmit={(data) => {
        const url = parseRecordingUrl(formText(data, "url"));
        if (!url) return t("archive.piece_card.recording_url_invalid");
        if (recordings.some((recording) => parseRecordingUrl(recording.url) === url)) {
          return t("archive.piece_card.recording_exists");
        }
        return autosave.enqueue(() => create.mutateAsync({
          piece: String(piece.id),
          url,
          performer: formText(data, "performer"),
          source: "OTH",
          external_id: crypto.randomUUID(),
        }));
      }}>
        <Input name="url" label={t("archive.piece_card.recording_url")} type="url" variant="property" required maxLength={200} autoFocus />
        <Input name="performer" label={t("archive.piece_card.recording_performer")} variant="property" maxLength={200} />
      </RecordAdd>
    </div>
  );
};
