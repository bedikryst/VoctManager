/**
 * @file NoteRow.tsx
 * @description One scratchpad entry: ONE surface that passes through three
 * states, never a stack of boxes. Collapsed is a two-line clamp on no surface
 * at all. Expanded is the whole body in a recessed well, with the day it was
 * written and the edit and delete actions on a bar beneath it. Editing turns
 * that same well into a field — the row itself takes the field shell and the
 * body becomes an editable textarea with no box of its own — so the text is
 * edited exactly where it was read, at the same size and the same offset, and
 * the bar underneath swaps its actions for cancel and save without changing
 * height.
 *
 * The two steps are the point: a click on a collapsed row opens it, and only a
 * click on a body that is already whole opens the editor, with the caret where
 * the click landed.
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
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { parseApiError, resolveErrorCopy } from "@/shared/api/errors";
import { Button } from "@/shared/ui/primitives/Button";
import {
  FIELD_SHELL_FOCUS_WITHIN,
  fieldShellVariants,
} from "@/shared/ui/primitives/fieldShell";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useDeleteNote, useSaveNoteBody, useToggleNoteDone } from "../api/notes.queries";
import type { Note } from "../types/notes.dto";
import { NOTE_TEXT, NOTE_WRAP, NoteField } from "./NoteField";

export interface NoteRowProps {
  readonly note: Note;
  readonly isExpanded: boolean;
  readonly onToggle: (id: string) => void;
}

const TRACK_CLASS = "grid transition-[grid-template-rows] duration-300 ease-out";

/**
 * Everything the three states share. The border is always there, transparent
 * when it has nothing to say, so no state moves the text by a pixel. The
 * horizontal geometry is deliberate: 1px border + 10px inset + the 20px tick
 * centres the tick under the composer's pen, and the 10px gap after it starts
 * the text on the composer's own text line.
 */
const ROW_BASE =
  "flex w-full min-w-0 cursor-pointer items-start gap-2.5 rounded-nested border px-2.5 py-2 text-left outline-none transition-[background-color,border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

/**
 * The house hover — a gold hairline, no fill. A grey wash under a hovered row
 * is the generic list-item idiom, and in this rail it read as a second surface
 * appearing under the text rather than the row answering the cursor.
 */
const ROW_COLLAPSED = "border-transparent hover:border-ethereal-gold/25";

/** One rung down the ladder from the rail: the note is opened INTO the page. */
const ROW_EXPANDED =
  "border-hairline-strong bg-ethereal-alabaster/60 hover:border-ethereal-gold/30";

const ICON_BUTTON_CLASS =
  "grid h-8 w-8 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ethereal-gold/50";

/** Day, month and time; the year only once it is no longer this one. */
const formatWrittenAt = (iso: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (new Date(iso).getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return formatLocalizedDateTime(iso, options);
};

/**
 * Where in the note a click landed, as an offset into its text. The body is
 * one text node, so the node's offset IS the textarea's. `null` where the
 * browser cannot say (Safari before `caretPositionFromPoint`) — the caret then
 * goes to the end, which is where an edit that adds a line wants it anyway.
 */
const caretOffsetAt = (event: React.MouseEvent, within: Node): number | null => {
  if (typeof document.caretPositionFromPoint !== "function") return null;
  const position = document.caretPositionFromPoint(event.clientX, event.clientY);
  if (!position || !within.contains(position.offsetNode)) return null;
  return position.offset;
};

export const NoteRow = ({ note, isExpanded, onToggle }: NoteRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);
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
    // Never select-all: this editor is opened to change a word or add a line,
    // and a selection means the first keystroke wipes the paragraph.
    const caret = Math.min(caretRef.current ?? field.value.length, field.value.length);
    field.setSelectionRange(caret, caret);
    caretRef.current = null;
  }, [isEditing]);

  const cancel = (): void => {
    setDraft(note.body);
    setError(null);
    setIsEditing(false);
  };

  // Both ways in — the body itself and the pencil on the action bar — and both
  // have to stop the click, or opening the editor folds the row it is in.
  const handleEditIntent = (event: React.MouseEvent, caret: number | null = null): void => {
    event.stopPropagation();
    caretRef.current = caret;
    setIsEditing(true);
  };

  const commit = async (): Promise<void> => {
    // The save button and the blur it would cause are two routes to the same
    // write, and a double tap is a third. The field is deliberately NOT
    // disabled while saving for the same reason: disabling a focused control
    // blurs it, and that blur would land right back here.
    if (isSaving) return;
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

  const surfaceClass = isEditing
    ? cn(
        fieldShellVariants({ variant: "glass", hasError: error !== null }),
        FIELD_SHELL_FOCUS_WITHIN,
        // The shell's corner is a control's; the row keeps its own, or the
        // well changes shape at the moment it becomes a field.
        "cursor-text rounded-nested",
      )
    : isExpanded
      ? ROW_EXPANDED
      : ROW_COLLAPSED;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onMouseDown={(event) => {
        // While editing, the row IS the field: a press on its padding, its
        // tick column or the empty half of its bar must not pull focus out of
        // the textarea, or that blur saves and closes the editor under the
        // cursor. Real controls keep their focus — the tick in particular has
        // to blur the editor, because the save that blur runs is what keeps the
        // draft when ticking moves the note to the other list.
        if (!isEditing) return;
        if ((event.target as HTMLElement).closest("button, textarea")) return;
        event.preventDefault();
      }}
      onClick={(event) => {
        // The click stops here. The panel folds whatever is open on anything
        // that reaches IT, and a row opening its own body is not that.
        event.stopPropagation();
        if (isEditing) {
          editorRef.current?.focus();
          return;
        }
        onToggle(note.id);
      }}
      onKeyDown={onActivate(() => {
        if (!isEditing) onToggle(note.id);
      })}
      className={cn(ROW_BASE, surfaceClass)}
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
            : // The tick previews itself under the cursor, so the circle says
              // what it does before it is pressed.
              "border-ethereal-graphite/30 text-transparent hover:border-ethereal-gold hover:text-ethereal-gold/60",
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
              className={cn("line-clamp-2", NOTE_WRAP, NOTE_TEXT, doneTextClass)}
            >
              {note.body}
            </Text>
          </div>
        </div>

        <div className={TRACK_CLASS} style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
          <div className="overflow-hidden" inert={!isExpanded}>
            {isEditing ? (
              <NoteField
                ref={editorRef}
                surface="bare"
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
              />
            ) : (
              /* Text, not a control. A button here would take its accessible
                 name from the body and announce the note as "edit note", which
                 is the one reading that loses the note. So the pointer gets the
                 whole paragraph as a target and the keyboard gets the pencil on
                 the bar — one action, named once. */
              <Text
                as="p"
                size={null}
                onClick={(event) =>
                  handleEditIntent(event, caretOffsetAt(event, event.currentTarget))
                }
                className={cn("cursor-text", NOTE_WRAP, NOTE_TEXT, doneTextClass)}
              >
                {note.body}
              </Text>
            )}

            {error && (
              <Caption as="p" role="alert" color="crimson" className="mt-1.5 font-medium">
                {error}
              </Caption>
            )}

            {/* One height in both modes, so swapping the actions never nudges
                the row. The date is the one fact about a note its body cannot
                say, and it keeps the bar from being two icons adrift. */}
            <div className="mt-2 flex h-8 items-center justify-between gap-2">
              <Caption>{formatWrittenAt(note.created_at)}</Caption>

              {isEditing ? (
                <div className="flex items-center gap-1">
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
                    onClick={(event) => {
                      event.stopPropagation();
                      cancel();
                    }}
                    disabled={isSaving}
                  >
                    {t("common.actions.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    data-note-edit-action="save"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void commit();
                    }}
                    isLoading={isSaving}
                  >
                    {t("common.actions.save")}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(event) => handleEditIntent(event)}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
