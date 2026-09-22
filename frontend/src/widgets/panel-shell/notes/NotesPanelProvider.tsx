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
 * copy desk), with no extra suppression logic needed there. The one in-shell
 * case a route check cannot see is `ScoreStandModal`, which opens as local
 * component state on an unchanged URL: `isFullscreenSurfaceOpen()` is what
 * answers for it, since `PdfViewerModal` registers itself there.
 * @module widgets/panel-shell/notes
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect } from "react";

import {
  NotesPanelStateProvider,
  useNotesPanel,
} from "@/features/notes/hooks/useNotesPanel";
import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";
import { isFullscreenSurfaceOpen } from "@/shared/lib/dom/fullscreenSurface";
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
  const { openToCompose } = useNotesPanel();
  const isWideShell = useMediaQuery("(min-width: 60rem)");

  // "n" opens and puts the caret in the composer; it never closes. Pressing a
  // letter to capture a thought and finding the panel gone instead is the wrong
  // half of a toggle, and with the rail pinned a toggle is invisible anyway:
  // `isExpanded` is `isOpen || isPinned`, so the keypress would flip a flag
  // nothing reads. Escape and the close button are how it goes away.
  //
  // The autofocus needs no viewport gate — pressing "n" proves a physical
  // keyboard, so the on-screen one that would eat a third of a phone screen is
  // not in play. The mobile dock's button, which can be tapped without one,
  // deliberately calls plain `open()` instead.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target) &&
        !isFullscreenSurfaceOpen()
      ) {
        event.preventDefault();
        openToCompose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openToCompose]);

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
