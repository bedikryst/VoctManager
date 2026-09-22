/**
 * @file NotesEmptyState.tsx
 * @description Empty scratchpad. `inline` variant — the rail/sheet already
 * provides the surface, so this must not draw a second one.
 * @module features/notes/components
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { NotebookPen } from "lucide-react";

import { StatePanel } from "@/shared/ui/composites/StatePanel";

export const NotesEmptyState = (): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <StatePanel
      icon={<NotebookPen size={22} strokeWidth={1.5} aria-hidden="true" />}
      title={t("notes.empty.title", "Pusty notatnik")}
      description={t(
        "notes.empty.description",
        "Zapisz coś, o czym nie chcesz zapomnieć — telefon, wiadomość do napisania.",
      )}
      variant="inline"
      align="left"
    />
  );
};
