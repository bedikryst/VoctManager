/**
 * @file NoteRow.tsx
 * @description One scratchpad entry, in three states rather than two.
 * Collapsed is a two-line clamp. Expanded is the whole body, plain, with the
 * edit and delete actions on a bar beneath it. Editing replaces the body with
 * the same field the composer uses, full width, and puts save and cancel on
 * that same bar — a note is read and rewritten at one size, in one column.
 *
 * The two steps are the point: a click on a collapsed row opens it, and only a
 * click on a body that is already whole opens the editor. Nothing about the
 * text hover-highlights on its own — the row is the only lit surface, or a
 * three-line note reads as three stacked fields.
 *
 * Which row is open is the PANEL's state, not the row's: one at a time, and any
 * click that reaches the panel folds it back. That is why the row's own click
 * stops there.
 *
 * The row is the expand toggle, which makes it a `role="button"` carrying its
 * own controls. `onActivate` is what keeps that honest: it acts only on a
 * keystroke aimed at the row ITSELF, so Enter on the checkbox and the space bar
 * of whoever is typing in the editor do not also fold the row.
 *
 * Preview and expanded body are TWO `grid-template-rows: 0fr ↔ 1fr` tracks
 * animating in opposite directions at once, not one track plus a conditional
 * render: the row's height then moves continuously, instead of the preview
 * snapping away before the body has grown (and both showing at once on the way
 * back). The track that is closing carries `inert`, which is what keeps a
 * collapsed row from leaving its actions in the tab order and in the
 * accessibility tree — `overflow-hidden` hides them from the eye only.
 * @module features/notes/components
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Pencil, Trash2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { onActivate } from "@/shared/lib/dom/a11y";
import { parseApiError, resolveErrorCopy } from "@/shared/api/errors";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useDeleteNote, useSaveNoteBody, useToggleNoteDone } from "../api/notes.queries";
import type { Note } from "../types/notes.dto";
import { NOTE_TEXT, NoteField } from "./NoteField";

export interface NoteRowProps {
  readonly note: Note;
  readonly isExpanded: boolean;
  readonly onToggle: (id: string) => void;
}

const TRACK_CLASS = "grid transition-[grid-template-rows] duration-300 ease-out";

const ICON_BUTTON_CLASS =
  "grid h-8 w-8 shrink-0 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ethereal-gold/50";

export const NoteRow = ({ note, isExpanded, onToggle }: NoteRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const saveBody = useSaveNoteBody();
  const toggleDone = useToggleNoteDone();
  const deleteNote = useDeleteNote();

  // A row folded from the outside — another row opening, a click on the panel —
  // leaves the editor behind it. The blur that came with that click has already
  // committed whatever was typed.
  useEffect(() => {
    if (isExpanded) return;
    setIsEditing(false);
    setError(null);
  }, [isExpanded]);

  useEffect(() => {
    if (isEditing) return;
    setDraft(note.body);
  }, [note.body, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const field = editorRef.current;
    if (!field) return;
    field.focus();
    // The caret lands at the end rather than selecting everything: this editor
    // is opened to add a line to a note, and select-all means the first
    // keystroke wipes the paragraph its author came to extend.
    field.setSelectionRange(field.value.length, field.value.length);
  }, [isEditing]);

  const cancel = (): void => {
    setDraft(note.body);
    setError(null);
    setIsEditing(false);
  };

  // Both ways in — the body itself and the pencil on the action bar — and both
  // have to stop the click, or opening the editor folds the row it is in.
  const handleEditIntent = (event: React.MouseEvent): void => {
    event.stopPropagation();
    setIsEditing(true);
  };

  const commit = async (): Promise<void> => {
    const next = draft.trim();
    if (next === note.body) {
      setError(null);
      setIsEditing(false);
      return;
    }
    if (!next) {
      setError(t("notes.errors.empty", "Notatka nie może być pusta."));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      // Resolves rather than rejects when the write went to the offline queue —
      // see `useSaveNoteBody`. Only a real rejection reaches the catch.
      await saveBody(note.id, next);
      setIsEditing(false);
    } catch (caught) {
      setError(resolveErrorCopy(parseApiError(caught), t).detail);
    } finally {
      setIsSaving(false);
    }
  };

  const doneTextClass = note.is_done && "text-ethereal-graphite/50 line-through";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={(event) => {
        // The click stops here. The panel folds whatever is open on anything
        // that reaches IT, and a row opening its own body is not that.
        event.stopPropagation();
        onToggle(note.id);
      }}
      onKeyDown={onActivate(() => onToggle(note.id))}
      className="group flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-nested px-2 py-2 text-left outline-none transition-colors hover:bg-ethereal-ink/[0.03] focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toggleDone.mutate({ id: note.id, is_done: !note.is_done, body: note.body });
        }}
        aria-pressed={note.is_done}
        aria-label={
          note.is_done
            ? t("notes.row.mark_open", "Cofnij ukończenie")
            : t("notes.row.mark_done", "Odhacz")
        }
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          note.is_done
            ? "border-ethereal-sage bg-ethereal-sage/20 text-ethereal-sage"
            : "border-ethereal-graphite/30 text-transparent hover:border-ethereal-gold",
        )}
      >
        <Check size={12} strokeWidth={3} aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <div className={TRACK_CLASS} style={{ gridTemplateRows: isExpanded ? "0fr" : "1fr" }}>
          {/* Inert once the body below owns the text: the preview is then a
              duplicate reading of the same note for a screen reader. */}
          <div className="overflow-hidden" inert={isExpanded}>
            <Text
              as="p"
              size={null}
              className={cn("line-clamp-2 whitespace-pre-wrap", NOTE_TEXT, doneTextClass)}
            >
              {note.body}
            </Text>
          </div>
        </div>

        <div className={TRACK_CLASS} style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
          <div className="overflow-hidden" inert={!isExpanded}>
            {isEditing ? (
              /* A click inside the field would otherwise bubble to the row and
                 fold it shut mid-word. Only the two expanded states stop it:
                 the COLLAPSED body carries no handler at all, because there the
                 click has to reach the row — the row is what opens it. */
              <div onClick={(event) => event.stopPropagation()}>
                <NoteField
                  ref={editorRef}
                  value={draft}
                  onValueChange={setDraft}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      // Marks the keystroke handled, which is what stops the
                      // rail and the sheet — both listening on window — from
                      // reading a cancelled edit as "close the panel".
                      event.preventDefault();
                      cancel();
                      return;
                    }
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void commit();
                    }
                  }}
                  onBlur={(event) => {
                    const next = event.relatedTarget as HTMLElement | null;
                    if (next?.dataset.noteEditAction) return;
                    void commit();
                  }}
                  ariaLabel={t("notes.row.edit_body", "Treść notatki")}
                  hasError={error !== null}
                  disabled={isSaving}
                />

                {error && (
                  <Caption as="p" role="alert" color="crimson" className="mt-1 px-1 font-medium">
                    {error}
                  </Caption>
                )}

                <div className="mt-2 flex items-center justify-end gap-2">
                  {/* `onMouseDown` keeps the caret in the field, so the button's
                      own click is what runs — without it the blur fires first
                      and cancel arrives after the save it was meant to replace.
                      The data attribute is the second half, for a browser that
                      moves focus anyway. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-note-edit-action="cancel"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={cancel}
                    disabled={isSaving}
                  >
                    {t("common.actions.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-note-edit-action="save"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void commit()}
                    isLoading={isSaving}
                  >
                    {t("common.actions.save")}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {/* Text, not a control. A button here would take its
                    accessible name from the body and announce the note as
                    "edit note", which is the one reading that loses the note.
                    So the pointer gets the whole paragraph as a target and the
                    keyboard gets the pencil beside it — one action, named once.
                    No hover fill either: the row underneath is already lit, and
                    a second surface inside it turns one note into a stack of
                    fields. */}
                <div onClick={handleEditIntent} className="cursor-text">
                  <Text
                    as="p"
                    size={null}
                    className={cn("whitespace-pre-wrap", NOTE_TEXT, doneTextClass)}
                  >
                    {note.body}
                  </Text>
                </div>

                <div className="mt-1.5 flex items-center justify-end gap-0.5">
                  <button
                    type="button"
                    onClick={handleEditIntent}
                    aria-label={t("notes.row.edit", "Edytuj notatkę")}
                    className={cn(
                      ICON_BUTTON_CLASS,
                      "text-ethereal-graphite/50 hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink",
                    )}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteNote.mutate({ id: note.id, body: note.body });
                    }}
                    aria-label={t("common.actions.delete")}
                    className={cn(
                      ICON_BUTTON_CLASS,
                      "text-ethereal-graphite/50 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson",
                    )}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
