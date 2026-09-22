/**
 * @file NotesPanelProvider.tsx
 * @description Owns the scratchpad's shell wiring: which surface renders
 * (`NotesRail` on `wide-shell`, `NotesSheet` below it — the JS mirror of the
 * CSS breakpoint, via `useMediaQuery`) and the global "n" hotkey, guarded
 * against firing while the conductor is typing. Mirrors
 * `command/CommandPaletteProvider.tsx`: the feature owns the pure open/close
 * state (`NotesPanelStateProvider`), this widget composes it with chrome.
 *
 * Mounted once, inside `DashboardLayout` — so it is naturally absent from
 * every route outside the panel shell (the standalone document viewer, the
 * copy desk), with no extra suppression logic needed there. It does NOT
 * detect the one in-shell case that still matters: `ScoreStandModal` opens as
 * local component state on an unchanged URL, so a route check cannot see it,
 * and no shared "a fullscreen modal is open" signal exists in this codebase
 * to check instead. The rail's own z-60 already sits well under the modal's
 * z-90, so it cannot show through — the reachable gap is narrow (pressing "n"
 * while the score stand is open) and is left for a follow-up rather than
 * inventing new cross-cutting modal-tracking infrastructure for it here.
 * @module widgets/panel-shell/notes
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect } from "react";

import {
  NotesPanelStateProvider,
  useNotesPanel,
} from "@/features/notes/hooks/useNotesPanel";
import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";
import { NotesRail } from "./NotesRail";
import { NotesSheet } from "./NotesSheet";

/** Guards the "n" hotkey the same way the command palette guards "/". */
const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
};

const NotesPanelChrome = (): React.JSX.Element => {
  const { toggle } = useNotesPanel();
  const isWideShell = useMediaQuery("(min-width: 60rem)");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return isWideShell ? <NotesRail /> : <NotesSheet />;
};

interface NotesPanelProviderProps {
  readonly children: React.ReactNode;
}

export const NotesPanelProvider = ({
  children,
}: NotesPanelProviderProps): React.JSX.Element => (
  <NotesPanelStateProvider>
    {children}
    <NotesPanelChrome />
  </NotesPanelStateProvider>
);

NotesPanelProvider.displayName = "NotesPanelProvider";
