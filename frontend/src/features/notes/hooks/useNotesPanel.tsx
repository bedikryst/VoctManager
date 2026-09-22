/**
 * @file useNotesPanel.ts
 * @description Open/close state for the private scratchpad panel — the pure
 * feature-level half. Shell chrome (which surface to render, the global
 * hotkey, the pin) lives in `widgets/panel-shell/notes/NotesPanelProvider`,
 * which wraps `NotesPanelStateProvider` from here; the feature itself never
 * imports the shell.
 * @module features/notes/hooks
 * @architecture Enterprise SaaS 2026
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface NotesPanelContextValue {
  readonly isOpen: boolean;
  /**
   * Raised only by the explicit "new note" action, never by a plain open, and
   * cleared by whoever acts on it. A latch rather than a counter the composer
   * compares against its own first render: below `wide-shell` the panel lives
   * in a `BottomSheet`, which unmounts its children when closed, so the
   * composer mounts FRESH on that open — a counter it has never seen before
   * looks identical to one it has already consumed, and the field never takes
   * focus on a phone.
   */
  readonly pendingCompose: boolean;
  readonly consumePendingCompose: () => void;
  /** Opens without touching the caret — the mobile dock's tap. */
  readonly open: () => void;
  /** Opens and raises the latch: the panel arrives ready to be typed into. */
  readonly openToCompose: () => void;
  readonly close: () => void;
}

const NotesPanelContext = createContext<NotesPanelContextValue | null>(null);

interface NotesPanelStateProviderProps {
  readonly children: React.ReactNode;
}

export const NotesPanelStateProvider = ({
  children,
}: NotesPanelStateProviderProps): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCompose, setPendingCompose] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const openToCompose = useCallback(() => {
    setIsOpen(true);
    setPendingCompose(true);
  }, []);
  const consumePendingCompose = useCallback(() => setPendingCompose(false), []);
  // A latch left raised would steal focus on the NEXT open, which may well be a
  // plain one. Closing drops it whether or not the composer got there first.
  const close = useCallback(() => {
    setIsOpen(false);
    setPendingCompose(false);
  }, []);
  const value = useMemo<NotesPanelContextValue>(
    () => ({
      isOpen,
      pendingCompose,
      consumePendingCompose,
      open,
      openToCompose,
      close,
    }),
    [isOpen, pendingCompose, consumePendingCompose, open, openToCompose, close],
  );

  return (
    <NotesPanelContext.Provider value={value}>
      {children}
    </NotesPanelContext.Provider>
  );
};

NotesPanelStateProvider.displayName = "NotesPanelStateProvider";

export const useNotesPanel = (): NotesPanelContextValue => {
  const context = useContext(NotesPanelContext);
  if (!context) {
    throw new Error("useNotesPanel must be used within a NotesPanelStateProvider");
  }
  return context;
};
