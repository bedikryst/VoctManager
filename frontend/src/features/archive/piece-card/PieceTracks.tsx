/**
 * @file PieceTracks.tsx
 * @description The card's "Ścieżki" section. Practice takes play together in
 * the singer's mixer and must share one length; the tempo giusto take is heard
 * on its own, so it is listed apart (see `trackSlots`). A Tutti take can be
 * moved across in place: the target-tempo recording often arrives as the
 * piece's first Tutti, before the practice mix exists.
 *
 * Each row names the file it was made from, because a player alone cannot
 * answer whether the take on the alto line is the alto take. The note under
 * the player travels on to the singer; the filename does not.
 *
 * One take is added through the card's add line, with its voice and file.
 * Several files, picked through "Wgraj wiele" or dropped on the card, wait in
 * `TrackBatchUpload`, each already on the voice its name declares
 * (`trackFilenames`). The section is not a drop target of its own: the page's
 * target routes audio into the queue it is handed (`useTrackBatch`).
 * @module features/archive/piece-card/PieceTracks
 */

import { useId, useMemo, useState, type SyntheticEvent } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowRightLeft, FolderUp } from "lucide-react";

import { useVoiceLines } from "@/shared/api/options.queries";
import { collapseVoiceLabels } from "@/shared/lib/voiceLabels";
import { cn } from "@/shared/lib/utils";
import type { Piece, Track, TrackKind } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { useDeleteTrack, useTracks, useUpdateTrack, useUploadTrack } from "../api/archive.queries";
import { scopedToEdition } from "../constants/divisiScope";
import { getPiecePdfLinks } from "../constants/piecePdfs";
import { isTempoGiusto, trackSlotOptions, uploadTargetForSlot } from "../constants/trackSlots";
import { CommitText } from "./CommitText";
import { formText, RecordAdd, RecordRemove } from "./RecordActions";
import { TrackBatchUpload } from "./TrackBatchUpload";
import type { PieceAutosave } from "./usePieceAutosave";
import {
  AUDIO_ACCEPT,
  AUDIO_INPUT_ACCEPT,
  hasTrackExtension,
  type TrackBatch,
} from "./useTrackBatch";

/** The server's `validate_file_size`. */
const MAX_TRACK_BYTES = 50 * 1024 * 1024;
const NOTE_MAX_LENGTH = 200;

/** Last path segment of a stored file: the name of a take uploaded before the original was kept. */
const storedFileName = (url: string): string => {
  const path = url.split("?")[0];
  return decodeURIComponent(path.slice(path.lastIndexOf("/") + 1));
};

/** One take sounds at a time: starting one pauses every other player on the page. */
const pauseOthers = (event: SyntheticEvent<HTMLAudioElement>): void => {
  const playing = event.currentTarget;
  document.querySelectorAll("audio").forEach((element) => {
    if (element !== playing) element.pause();
  });
};

interface TrackRowProps {
  readonly track: Track;
  /** The voice as the singer's materials name it, or "Tempo giusto". */
  readonly label: string;
  /** Named only while the piece has more than one edition to tell apart. */
  readonly editionLabel?: string;
  readonly autosave: PieceAutosave;
}

const TrackRow = ({ track, label, editionLabel, autosave }: TrackRowProps) => {
  const { t } = useTranslation();
  const noteId = useId();
  const update = useUpdateTrack();
  const remove = useDeleteTrack();
  const [isMoving, setIsMoving] = useState(false);
  // An empty note is not a field of its own: it is offered on the file line,
  // and once opened it stays for as long as the card is open, filled or not.
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const showsNote = isNoteOpen || Boolean(track.description?.trim());
  const id = String(track.id);
  const noteLabel = t("archive.tracks.note_aria", { label });
  const noteDraft = autosave.track("description", noteLabel, id);
  const fileName = track.original_filename?.trim() || storedFileName(track.audio_file);
  // Only a Tutti take can be the target-tempo recording.
  const moveTo: TrackKind | null = isTempoGiusto(track)
    ? "PRACTICE"
    : track.voice_part === "TUTTI"
      ? "TEMPO_GIUSTO"
      : null;
  const move = (kind: TrackKind): void => {
    setIsMoving(true);
    void autosave
      .enqueue(() => update.mutateAsync({ trackId: id, patch: { kind } }))
      .catch(autosave.showSaveError)
      .finally(() => setIsMoving(false));
  };

  return (
    <li className="border-t border-hairline py-2">
      {/* On a phone the player takes a line of its own under the voice. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Text className="min-w-0 flex-1 wrap-anywhere sm:w-32 sm:flex-none">{label}</Text>
        <audio
          controls
          controlsList="nodownload"
          aria-label={label}
          className="order-last h-9 w-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1"
          onPlay={pauseOthers}
        >
          <source src={track.audio_file} type="audio/mpeg" />
        </audio>
        <RecordRemove
          label={t("archive.tracks.delete_aria", { label })}
          autosave={autosave}
          remove={() => remove.mutateAsync(id)}
        />
      </div>
      {showsNote && (
        // The note's text starts on the voice's edge; the field pads it by 0.5rem.
        <div className="-mx-2">
          <CommitText
            id={noteId}
            ariaLabel={noteLabel}
            placeholder={t("archive.tracks.note_placeholder")}
            value={track.description ?? ""}
            className="text-sm fine-pointer:text-sm"
            draftField={noteDraft}
            onCommit={(next) => next.length > NOTE_MAX_LENGTH
              ? t("archive.piece_card.field_too_long")
              : autosave.commitDraft(noteDraft.key, async () => {
                await update.mutateAsync({ trackId: id, patch: { description: next } });
              })}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-1">
        <Text size="sm" color="muted" className="min-w-0 flex-1 wrap-anywhere">
          {[fileName, editionLabel].filter(Boolean).join(" · ")}
        </Text>
        {!showsNote && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            casing="sentence"
            // An offer for an empty value, quiet like the "Dodaj: …" line of Dane.
            className="text-ethereal-graphite hover:text-ethereal-ink"
            aria-label={t("archive.tracks.add_note_aria", { label })}
            onClick={() => {
              setIsNoteOpen(true);
              // The field mounts on the next render.
              requestAnimationFrame(() => document.getElementById(noteId)?.focus());
            }}
          >
            {t("archive.tracks.add_note")}
          </Button>
        )}
        {moveTo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            casing="sentence"
            isLoading={isMoving}
            leftIcon={<ArrowRightLeft size={16} aria-hidden="true" />}
            onClick={() => move(moveTo)}
          >
            {moveTo === "TEMPO_GIUSTO"
              ? t("archive.tracks.move_to_tempo_giusto")
              : t("archive.tracks.move_to_practice")}
          </Button>
        )}
      </div>
    </li>
  );
};

interface PieceTracksProps {
  readonly piece: Piece;
  readonly autosave: PieceAutosave;
  /** The batch queue, held by the owner of the drop target. */
  readonly batch: TrackBatch;
}

export const PieceTracks = ({ piece, autosave, batch }: PieceTracksProps) => {
  const { t } = useTranslation();
  const voiceId = useId();
  const fileId = useId();
  const { data: tracks = [] } = useTracks(piece.id);
  const { data: voiceLines = [] } = useVoiceLines();
  const upload = useUploadTrack();
  const [isAdding, setIsAdding] = useState(false);
  const [voice, setVoice] = useState("");
  const [editionId, setEditionId] = useState("");

  // Per-edition takes only mean something once there is more than one
  // arrangement to tell apart; below that the question has one answer.
  const editions = useMemo(() => getPiecePdfLinks(piece), [piece]);
  const hasEditionChoice = editions.length > 1;
  const editionOptions = editions.map((edition) => ({ value: edition.id, label: edition.label }));
  const slotOptions = useMemo(() => trackSlotOptions(voiceLines, t), [voiceLines, t]);
  const practiceTracks = tracks.filter((track) => !isTempoGiusto(track));
  const tempoGiustoTracks = tracks.filter(isTempoGiusto);

  // The codes this piece already speaks of, for reading a bare `(B)` in a
  // filename the way the singer will see the part named.
  const voiceScope = useMemo(
    () => [
      ...(piece.voice_requirements_read ?? [])
        .filter((requirement) => (requirement.edition ?? null) === null)
        .map((requirement) => String(requirement.voice_line)),
      ...tracks.map((track) => String(track.voice_part)),
    ],
    [piece.voice_requirements_read, tracks],
  );

  // A take is named inside its own arrangement, so a piece with one tenor
  // line reads "Tenor" here exactly as it will in the singer's materials.
  const labelsByEdition = useMemo(() => {
    // Without the dictionary a collapsed label is the raw code, which reads
    // worse than the server's own display: wait for it to land.
    if (voiceLines.length === 0) return new Map<string, Record<string, string>>();
    const requirements = piece.voice_requirements_read ?? [];
    const keys = new Set(tracks.map((track) => track.edition ?? ""));
    return new Map(
      Array.from(keys, (key) => {
        const scope = [
          // Through `scopedToEdition`, exactly as the server resolves it: an
          // edition that declares no divisi of its own is read against the
          // piece-wide layer, never against its own takes alone, or a lone
          // take would read "Tenor" where the singer's materials say "Tenor 1".
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

  const picker = useDropzone({
    accept: AUDIO_ACCEPT,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    noDrag: true,
    useFsAccessApi: false,
    onDrop: (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        toast.error(t("archive.tracks.batch.rejected", { count: rejected.length }));
      }
      batch.add(accepted);
    },
  });

  const tempoGiustoLabel = t("archive.tracks.tempo_giusto");
  const renderList = (list: readonly Track[]) => (
    <ul className="border-b border-hairline">
      {list.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          autosave={autosave}
          label={isTempoGiusto(track)
            ? tempoGiustoLabel
            : labelsByEdition.get(track.edition ?? "")?.[String(track.voice_part)]
              || track.voice_part_display
              || track.voice_part}
          editionLabel={hasEditionChoice
            ? editions.find((edition) => edition.id === track.edition)?.label
            : undefined}
        />
      ))}
    </ul>
  );

  const addTrack = (data: FormData): (() => Promise<unknown>) | string => {
    const file = data.get("file");
    if (!voice) return t("archive.tracks.voice_required");
    if (!(file instanceof File) || !file.name) return t("archive.tracks.file_required");
    if (!hasTrackExtension(file.name)) return t("archive.tracks.file_type");
    if (file.size > MAX_TRACK_BYTES) return t("archive.upload.error_too_large");
    return () => upload.mutateAsync({
      pieceId: piece.id,
      ...uploadTargetForSlot(voice),
      file,
      description: formText(data, "note"),
      editionId: editionId || null,
    });
  };

  const hasBatch = batch.files.length > 0;

  return (
    // Positioned, so the picker's visually hidden input, which is absolute,
    // stays inside the record's scroller instead of lengthening the page.
    <div className="relative space-y-1">
      {practiceTracks.length > 0 && renderList(practiceTracks)}
      {tempoGiustoTracks.length > 0 && (
        <div className={cn(practiceTracks.length > 0 && "pt-4")}>
          <Text size="sm" color="graphite" className="pb-2">
            {t("archive.tracks.tempo_giusto_hint")}
          </Text>
          {renderList(tempoGiustoTracks)}
        </div>
      )}
      {hasBatch && (
        <TrackBatchUpload
          piece={piece}
          files={batch.files}
          voiceLines={voiceLines}
          scope={voiceScope}
          editions={editions}
          onDone={batch.clear}
        />
      )}
      {/* The queue takes the add line's place, unless a take was already
          being added by hand when the files arrived. */}
      {(!hasBatch || isAdding) && (
        <div>
          <div className={cn(!isAdding && "flex flex-wrap items-center gap-x-1")}>
            <RecordAdd
              label={t("archive.tracks.add")}
              draftKey="new_track"
              autosave={autosave}
              onSubmit={addTrack}
              onOpenChange={(open) => {
                setIsAdding(open);
                if (open) {
                  requestAnimationFrame(() => document.getElementById(voiceId)?.focus());
                } else {
                  setVoice("");
                  setEditionId("");
                }
              }}
            >
              <Select
                id={voiceId}
                label={t("archive.tracks.voice_part")}
                value={voice}
                onValueChange={setVoice}
                options={slotOptions}
                placeholder={t("archive.tracks.pick")}
                variant="property"
              />
              {hasEditionChoice && (
                <Select
                  label={t("archive.tracks.edition")}
                  value={editionId}
                  onValueChange={setEditionId}
                  options={editionOptions}
                  placeholder={t("archive.tracks.edition_any")}
                  clearLabel={t("archive.tracks.edition_any")}
                  variant="property"
                />
              )}
              <div className="flex flex-col gap-1.5">
                <Eyebrow as="label" htmlFor={fileId} color="muted" className="ml-1">
                  {t("archive.tracks.file")}
                </Eyebrow>
                {/* The native file button is a control, so it wears the control
                    recipe: radius and sentence case. */}
                <input
                  id={fileId}
                  name="file"
                  type="file"
                  accept={AUDIO_INPUT_ACCEPT}
                  required
                  className="text-sm text-ethereal-graphite file:mr-3 file:rounded-control file:border-0 file:bg-ethereal-gold/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ethereal-gold hover:file:bg-ethereal-gold/20"
                />
              </div>
              <Input
                name="note"
                label={t("archive.tracks.note")}
                placeholder={t("archive.tracks.note_hint")}
                variant="property"
                maxLength={NOTE_MAX_LENGTH}
              />
            </RecordAdd>
            {!isAdding && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                casing="sentence"
                leftIcon={<FolderUp size={16} aria-hidden="true" />}
                onClick={picker.open}
              >
                {t("archive.tracks.batch.add_many")}
              </Button>
            )}
          </div>
          {!isAdding && (
            <Text size="sm" color="muted">
              {t("archive.tracks.batch.naming_hint")}
              {/* Dropping is a mouse affordance; a finger never sees it. */}
              <Text as="span" size="sm" color="inherit" className="hidden fine-pointer:inline">
                {" "}{t("archive.tracks.batch.drop_hint")}
              </Text>
            </Text>
          )}
        </div>
      )}
      <input {...picker.getInputProps()} />
    </div>
  );
};
