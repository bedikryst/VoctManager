/**
 * @file NoteRow.tsx
 * @description One scratchpad entry. Collapsed shows a clamped preview;
 * expanded swaps it for `InlineEditable` in its multiline mode (full body,
 * click-to-edit, line breaks preserved) plus the delete action — delete is
 * reachable only from the expanded state, since four live targets in a 44px row
 * is one too many on a phone.
 *
 * The row is the expand toggle, which makes it a `role="button"` carrying its
 * own controls. `onActivate` is what keeps that honest: it acts only on a
 * keystroke aimed at the row ITSELF, so Enter on the checkbox and the space bar
 * of whoever is typing in the editor do not also fold the row. No
 * `stopPropagation` wrapper around the body — `InlineEditable` already swallows
 * the click on its own control, and a wrapper would swallow the whole line,
 * which is the largest target the row offers for collapsing it.
 *
 * Preview and editor are TWO `grid-template-rows: 0fr ↔ 1fr` tracks animating
 * in opposite directions at once, not one track plus a conditional render: the
 * row's height then moves continuously, instead of the preview snapping away
 * before the editor has grown (and both showing at once on the way back). The
 * track that is closing carries `inert`, which is what keeps a collapsed row
 * from leaving its editor and its delete button in the tab order and in the
 * accessibility tree — `overflow-hidden` hides them from the eye only.
 * @module features/notes/components
 * @architecture Enterprise SaaS 2026
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Trash2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { onActivate } from "@/shared/lib/dom/a11y";
import { Text } from "@/shared/ui/primitives/typography";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { useDeleteNote, useSaveNoteBody, useToggleNoteDone } from "../api/notes.queries";
import type { Note } from "../types/notes.dto";

export interface NoteRowProps {
  readonly note: Note;
}

const TRACK_CLASS = "grid transition-[grid-template-rows] duration-300 ease-out";

export const NoteRow = ({ note }: NoteRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const saveBody = useSaveNoteBody();
  const toggleDone = useToggleNoteDone();
  const deleteNote = useDeleteNote();

  const toggleExpanded = (): void => setIsExpanded((previous) => !previous);

  const doneTextClass = note.is_done && "text-ethereal-graphite/50 line-through";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={toggleExpanded}
      onKeyDown={onActivate(toggleExpanded)}
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
          {/* Inert once the editor owns the body: the preview is then a
              duplicate reading of the same text for a screen reader. */}
          <div className="overflow-hidden" inert={isExpanded}>
            <Text
              as="p"
              className={cn(
                "line-clamp-2 whitespace-pre-wrap leading-snug",
                doneTextClass,
              )}
            >
              {note.body}
            </Text>
          </div>
        </div>

        <div className={TRACK_CLASS} style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
          <div className="overflow-hidden" inert={!isExpanded}>
            <div className="flex items-start justify-between gap-2 pt-0.5">
              <InlineEditable
                value={note.body}
                onSave={(next) => saveBody(note.id, next)}
                validate={(next) =>
                  next.trim()
                    ? null
                    : t("notes.errors.empty", "Notatka nie może być pusta.")
                }
                ariaLabel={t("notes.row.edit_body", "Treść notatki")}
                multiline
                className={cn("flex-1 leading-snug", doneTextClass)}
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteNote.mutate({ id: note.id, body: note.body });
                }}
                aria-label={t("common.actions.delete", "Usuń")}
                className="mt-0.5 shrink-0 rounded-chip p-1.5 text-ethereal-graphite/50 transition-colors hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
