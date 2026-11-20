/**
 * @file PieceAudienceText.tsx
 * @description Translations and programme notes in the card's reading measure.
 */

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Piece, ProgramNote, Translation } from "@/shared/types";
import { PropertyRow } from "@/shared/ui/composites/PropertyRow";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Text } from "@/shared/ui/primitives/typography";
import {
  useCreateProgramNote,
  useDeleteProgramNote,
  useDeleteTranslation,
  useUpdateProgramNote,
  useUpdateTranslation,
} from "../api/archive.queries";
import { ProgramNoteGenerator, TranslationGenerator } from "../components/ReviewArtifactsEditors";
import { getLanguageLabel } from "../constants/archiveLanguages";
import { getProgramNoteToneLabel } from "../constants/audienceMaterial";
import { CommitText } from "./CommitText";
import { usePieceFieldReview } from "./PieceFieldReview";
import { formText, RecordAdd, RecordRemove } from "./RecordActions";
import { READING_TEXT, RecordText, RecordTextLabel } from "./RecordText";
import type { PieceAutosave } from "./usePieceAutosave";

interface AudienceTextProps {
  readonly piece: Piece;
  readonly autosave: PieceAutosave;
}

const TranslationBlock = ({ translation, piece, autosave }: AudienceTextProps & { translation: Translation }) => {
  const { t } = useTranslation();
  const textId = useId();
  const update = useUpdateTranslation();
  const remove = useDeleteTranslation();
  const pieceId = String(piece.id);
  const id = translation.id;
  const label = getLanguageLabel(translation.target_language, t);
  const { marker, action } = usePieceFieldReview({ piece, autosave, label, field: "text", objectId: id });
  const movement = piece.movements?.find((row) => row.id === translation.movement);
  const save = (field: "text" | "translator", next: string) =>
    autosave.saveValue(
      `${id}:${field}`,
      next,
      (current) => current.translations.find((row) => row.id === id)?.[field],
      async (value) => (await update.mutateAsync({ pieceId, id, data: { [field]: value } }))[field],
    );

  return (
    <li className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <RecordTextLabel
          id={textId}
          label={label}
          marker={marker}
          action={action}
          prefix={<Badge variant="neutral">{translation.target_language}</Badge>}
        />
        {translation.is_singable && <Text size="sm" color="muted">{t("archive.review.singable")}</Text>}
        <div className="ml-auto">
          <RecordRemove label={t("archive.review.delete_translation")} autosave={autosave} remove={() => remove.mutateAsync({ pieceId, id })} />
        </div>
      </div>
      {movement && <Text size="sm" color="muted">{movement.title}</Text>}
      <RecordText id={textId} value={translation.text} className={READING_TEXT} onCommit={(next) => save("text", next)} />
      <PropertyRow label={t("archive.review.translator")}>
        {(controlId) => (
          <CommitText id={controlId} value={translation.translator} onCommit={(next) => save("translator", next)} />
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
      <TranslationGenerator piece={piece} schedule={autosave.enqueue} />
    </div>
  );
};

const ProgramNoteBlock = ({ note, piece, autosave }: AudienceTextProps & { note: ProgramNote }) => {
  const { t } = useTranslation();
  const textId = useId();
  const update = useUpdateProgramNote();
  const remove = useDeleteProgramNote();
  const pieceId = String(piece.id);
  const id = note.id;
  const label = getLanguageLabel(note.language, t);
  const save = (next: string) => {
    if (!next) return t("archive.review.note_empty");
    return autosave.saveValue(
      `${id}:content`,
      next,
      (current) => current.program_notes.find((row) => row.id === id)?.content,
      async (content) => (await update.mutateAsync({ pieceId, id, data: { content } })).content,
    );
  };

  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{note.language}</Badge>
        <RecordTextLabel id={textId} label={label} />
        {note.target_tone && <Text size="sm" color="muted">{getProgramNoteToneLabel(note.target_tone, t)}</Text>}
        {note.is_approved && <Text size="sm" color="muted">{t("repertoire.program_notes.approved")}</Text>}
        <div className="ml-auto">
          <RecordRemove label={t("archive.review.delete_note")} autosave={autosave} remove={() => remove.mutateAsync({ pieceId, id })} />
        </div>
      </div>
      <RecordText id={textId} value={note.content} onCommit={save} />
    </li>
  );
};

export const PieceProgramNote = ({ piece, autosave }: AudienceTextProps) => {
  const { t } = useTranslation();
  const create = useCreateProgramNote();
  const [manualOpen, setManualOpen] = useState(false);
  const notes = piece.program_notes ?? [];
  return (
    <div className="space-y-3">
      {notes.length > 0 && (
        <ul className="space-y-5">
          {notes.map((note) => <ProgramNoteBlock key={note.id} {...{ note, piece, autosave }} />)}
        </ul>
      )}
      <ProgramNoteGenerator
        piece={piece}
        schedule={autosave.enqueue}
        manualOpen={manualOpen}
        renderManual={(language, tone, busy) => {
          const hasNote = notes.some((note) => !note.project && note.language === language);
          if (hasNote && !manualOpen) return null;
          return (
            <RecordAdd
              label={t("archive.piece_card.write_note")}
              disabled={busy}
              onOpenChange={setManualOpen}
              onSubmit={(data) => {
                if (hasNote) return t("archive.piece_card.note_exists");
                const content = formText(data, "content");
                if (!content) return t("archive.review.note_empty");
                return autosave.enqueue(() => create.mutateAsync({ piece: String(piece.id), language, target_tone: tone, content }));
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
