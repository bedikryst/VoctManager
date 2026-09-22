/**
 * @file NoteComposer.tsx
 * @description Always at the top of the panel, never the bottom — a
 * bottom-anchored composer collides with the iOS keyboard inset.
 *
 * The field wraps and grows instead of scrolling sideways: a capture you cannot
 * read back is a capture you retype. It still takes no newline — Enter submits,
 * which is what keeps the first line front-loaded and the collapsed row's
 * two-line clamp readable. Multi-line detail is added afterwards, in the
 * expanded row's own editor (`NoteRow`).
 * @module features/notes/components
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NotebookPen } from "lucide-react";

import { useCreateNote } from "../api/notes.queries";
import { useNotesPanel } from "../hooks/useNotesPanel";
import { NoteField } from "./NoteField";

export const NoteComposer = (): React.JSX.Element => {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const createNote = useCreateNote();
  const { pendingCompose, consumePendingCompose } = useNotesPanel();

  // Reads the latch rather than a render-count, so this fires whether the
  // composer was already mounted (the desktop rail is permanent) or mounts with
  // the panel (the bottom sheet unmounts its children when closed).
  useEffect(() => {
    if (!pendingCompose) return;
    fieldRef.current?.focus();
    consumePendingCompose();
  }, [pendingCompose, consumePendingCompose]);

  const submit = (): void => {
    const body = value.trim();
    if (!body) return;
    createNote.mutate({ id: crypto.randomUUID(), body });
    setValue("");
  };

  return (
    <div className="shrink-0">
      <NoteField
        ref={fieldRef}
        value={value}
        onValueChange={setValue}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          // Unconditional: the textarea is here to wrap, not to hold a second
          // line. Shift+Enter would smuggle one in behind the clamp.
          event.preventDefault();
          submit();
        }}
        leftIcon={<NotebookPen size={18} strokeWidth={1.5} aria-hidden="true" />}
        placeholder={t("notes.composer.placeholder", "Nowa notatka…")}
        ariaLabel={t("notes.composer.aria_label", "Nowa notatka")}
      />
    </div>
  );
};
