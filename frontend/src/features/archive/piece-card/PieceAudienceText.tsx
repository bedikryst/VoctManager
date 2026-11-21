/**
 * @file PieceAudienceText.tsx
 * @description Translations and programme notes in the card's reading measure.
 */

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { INGESTION_STATUS, type Piece, type ProgramNote, type Translation } from "@/shared/types";
import { PropertyRow } from "@/shared/ui/composites/PropertyRow";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Text } from "@/shared/ui/primitives/typography";
import {
  useCreateProgramNote,
  useDeleteProgramNote,
  useDeleteTranslation,
} from "../api/archive.queries";
import { ProgramNoteGenerator, TranslationGenerator } from "./AudienceGenerators";
import { getLanguageLabel } from "../constants/archiveLanguages";
import { getProgramNoteToneLabel } from "../constants/audienceMaterial";
import { CommitText } from "./CommitText";
import { usePieceFieldReview } from "./PieceFieldReview";
import { formText, RecordAdd, RecordRemove } from "./RecordActions";
import { READING_TEXT, RecordText, RecordTextLabel } from "./RecordText";
import { fieldKey, type PieceAutosave } from "./usePieceAutosave";

interface AudienceTextProps {
  readonly piece: Piece;
  readonly autosave: PieceAutosave;
}

const TranslationBlock = ({ translation, piece, autosave }: AudienceTextProps & { translation: Translation }) => {
  const { t } = useTranslation();
  const textId = useId();
  const remove = useDeleteTranslation();
  const pieceId = String(piece.id);
  const id = translation.id;
  const label = getLanguageLabel(translation.target_language, t);
  const translatorLabel = t("archive.review.translator");
  const { marker, action } = usePieceFieldReview({ piece, autosave, label, field: "text", objectId: id, controlId: textId });
  const movement = piece.movements?.find((row) => row.id === translation.movement);
  const save = (field: "text" | "translator", next: string) =>
    autosave.saveField({ kind: "translation", object_id: id, field }, next);

  return (
    <li className="relative min-w-0 space-y-1">
      {marker}
      <div className="flex flex-wrap items-center gap-2">
        <RecordTextLabel
          id={textId}
          label={label}
          prefix={<Badge variant="neutral">{translation.target_language}</Badge>}
        />
        {translation.is_singable && <Text size="sm" color="muted">{t("archive.review.singable")}</Text>}
        <div className="ml-auto flex items-center gap-1">
          {action}
          <RecordRemove label={t("archive.review.delete_translation")} autosave={autosave} remove={() => remove.mutateAsync({ pieceId, id })} />
        </div>
      </div>
      {movement && <Text size="sm" color="muted">{movement.title}</Text>}
      <RecordText id={textId} value={translation.text} draftField={autosave.track("text", label, id)} className={READING_TEXT} onCommit={(next) => save("text", next)} />
      <PropertyRow label={translatorLabel}>
        {(controlId) => (
          <CommitText id={controlId} value={translation.translator} draftField={autosave.track("translator", translatorLabel, id)} onCommit={(next) => save("translator", next)} />
        )}
      </PropertyRow>
    </li>
  );
};

export const PieceTranslations = ({ piece, autosave }: AudienceTextProps) => {
  const translations = piece.translations ?? [];
  return (
    <div className="space-y-4">
      {translations.length > 0 && (
        <ul className="space-y-5">
          {translations.map((translation) => <TranslationBlock key={translation.id} {...{ translation, piece, autosave }} />)}
        </ul>
      )}
      <TranslationGenerator piece={piece} schedule={(dispatch) => autosave.afterFieldsSaved(["lyrics_original", "language"], dispatch)} />
    </div>
  );
};

const ProgramNoteBlock = ({ note, piece, autosave }: AudienceTextProps & { note: ProgramNote }) => {
  const { t } = useTranslation();
  const textId = useId();
  const remove = useDeleteProgramNote();
  const pieceId = String(piece.id);
  const id = note.id;
  const label = getLanguageLabel(note.language, t);
  const save = (next: string) => {
    if (!next) return t("archive.review.note_empty");
    return autosave.saveField({ kind: "program_note", object_id: id, field: "content" }, next);
  };

  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{note.language}</Badge>
        <RecordTextLabel id={textId} label={label} />
        {note.target_tone && <Text size="sm" color="muted">{getProgramNoteToneLabel(note.target_tone, t)}</Text>}
        {note.is_approved && <Text size="sm" color="muted">{t("archive.piece_card.note_approved")}</Text>}
        <div className="ml-auto">
          <RecordRemove label={t("archive.review.delete_note")} autosave={autosave} remove={() => remove.mutateAsync({ pieceId, id })} />
        </div>
      </div>
      <RecordText id={textId} value={note.content} draftField={autosave.track("content", label, id)} onCommit={save} />
    </li>
  );
};

export const PieceProgramNote = ({ piece, autosave }: AudienceTextProps) => {
  const { t } = useTranslation();
  const create = useCreateProgramNote();
  const [manualOpen, setManualOpen] = useState(false);
  const notes = piece.program_notes ?? [];
  // Approval writes the note of a piece that has none, so generating one by
  // hand during the review is a choice, not a step.
  const writtenOnApproval = notes.length === 0
    && (piece.editions ?? []).some((edition) => edition.ingestion_status === INGESTION_STATUS.AWAITING);
  return (
    <div className="space-y-3">
      {notes.length > 0 && (
        <ul className="space-y-5">
          {notes.map((note) => <ProgramNoteBlock key={note.id} {...{ note, piece, autosave }} />)}
        </ul>
      )}
      {writtenOnApproval && (
        <Text size="sm" color="muted">{t("archive.piece_card.note_on_approval")}</Text>
      )}
      <ProgramNoteGenerator
        piece={piece}
        schedule={(dispatch, noteId) => autosave.afterFieldsSaved([
          "composer_id", "arranger", "title", "composition_year", "epoch", "voicing",
          "musical_key", "language", "text_source", "lyrics_original",
          ...(noteId ? [fieldKey("content", noteId)] : []),
        ], dispatch)}
        manualOpen={manualOpen}
        renderManual={(language, tone, busy) => {
          const hasNote = notes.some((note) => !note.project && note.language === language);
          if (hasNote && !manualOpen) return null;
          return (
            <RecordAdd
              label={t("archive.piece_card.write_note")}
              autosave={autosave}
              draftKey="new_program_note"
              disabled={busy}
              onOpenChange={setManualOpen}
              onSubmit={(data) => {
                if (hasNote) return t("archive.piece_card.note_exists");
                const content = formText(data, "content");
                if (!content) return t("archive.review.note_empty");
                return () => create.mutateAsync({ piece: String(piece.id), language, target_tone: tone, content });
              }}
            >
              <Textarea
                name="content"
                label={t("archive.review.note_content")}
                variant="property"
                className="field-sizing-content resize-none text-base leading-relaxed"
                rows={3}
                required
                autoFocus
              />
            </RecordAdd>
          );
        }}
      />
    </div>
  );
};
