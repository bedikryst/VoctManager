/**
 * @file NotesSheet.tsx
 * @description Bottom sheet anchoring for the scratchpad below `wide-shell`
 * (phone, tablet portrait). Thin composition over the existing `BottomSheet`
 * primitive — used as-is, per spec: portal to `document.body`,
 * drag-to-dismiss, safe-area padding, `z-focus-trap`, centred modal from `sm:`.
 * @module widgets/panel-shell/notes
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { NotesPanel } from "@/features/notes/components/NotesPanel";
import { useNotesPanel } from "@/features/notes/hooks/useNotesPanel";

export const NotesSheet = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { isOpen, close } = useNotesPanel();

  return (
    <BottomSheet isOpen={isOpen} onClose={close} title={t("notes.panel.title", "Notatki")}>
      <NotesPanel />
    </BottomSheet>
  );
};

NotesSheet.displayName = "NotesSheet";
