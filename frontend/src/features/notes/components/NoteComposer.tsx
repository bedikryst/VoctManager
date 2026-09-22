/**
 * @file NoteComposer.tsx
 * @description Always at the top of the panel, never the bottom — a
 * bottom-anchored composer collides with the iOS keyboard inset. Single-line;
 * Enter submits. There is no newline in quick capture on purpose: it forces a
 * front-loaded first line, which is what makes `line-clamp-2` on the
 * collapsed row readable. Multi-line detail is added later, in the expanded
 * row's own editor (`NoteRow`).
 * @module features/notes/components
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NotebookPen } from "lucide-react";

import { Input } from "@/shared/ui/primitives/Input";
import { useCreateNote } from "../api/notes.queries";
import { useNotesPanel } from "../hooks/useNotesPanel";

export const NoteComposer = (): React.JSX.Element => {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createNote = useCreateNote();
  const { pendingCompose, consumePendingCompose } = useNotesPanel();

  // Reads the latch rather than a render-count, so this fires whether the
  // composer was already mounted (the desktop rail is permanent) or mounts with
  // the panel (the bottom sheet unmounts its children when closed).
  useEffect(() => {
    if (!pendingCompose) return;
    inputRef.current?.focus();
    consumePendingCompose();
  }, [pendingCompose, consumePendingCompose]);

  const submit = (): void => {
    const body = value.trim();
    if (!body) return;
    createNote.mutate({ id: crypto.randomUUID(), body });
    setValue("");
  };

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      }}
      leftIcon={<NotebookPen aria-hidden="true" />}
      placeholder={t("notes.composer.placeholder", "Nowa notatka…")}
      aria-label={t("notes.composer.aria_label", "Nowa notatka")}
    />
  );
};
