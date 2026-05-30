/**
 * @file ProgramNotesList.tsx
 * @description Audience-facing program notes (one per language/tone variant).
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/repertoire/ProgramNotesList
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { ProgramNote } from "@/shared/types";

interface ProgramNotesListProps {
  readonly notes: readonly ProgramNote[];
}

export const ProgramNotesList = ({
  notes,
}: ProgramNotesListProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (notes.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {notes.map((note) => (
        <article
          key={note.id}
          className="rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/65 p-4"
        >
          <div className="flex items-baseline justify-between">
            <Eyebrow color="muted" size="caption">
              {note.language.toUpperCase()} · {note.target_tone}
            </Eyebrow>
            {note.is_approved && (
              <Caption color="muted">
                {t("repertoire.program_notes.approved", "zatwierdzona")}
              </Caption>
            )}
          </div>
          <Text size="sm" className="mt-2 whitespace-pre-wrap leading-relaxed">
            {note.content}
          </Text>
        </article>
      ))}
    </div>
  );
};
