/**
 * @file CommandPaletteProvider.tsx
 * @description Owns the global command-palette state and the keyboard contract
 * (⌘K / Ctrl+K to toggle, "/" to open from anywhere outside a text field) and
 * renders the palette itself. Any shell control — the sidebar search button,
 * a future quick-action — opens it via `useCommandPalette()`, so the trigger and
 * the surface stay decoupled.
 * @module widgets/panel-shell/command
 * @architecture Enterprise SaaS 2026
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

import type { AuthUser } from "@/shared/auth/auth.types";
import { CommandPalette } from "./CommandPalette";
import { recordProjectVisit } from "./quickAccessStore";

const PROJECT_HUB_PATH = /^\/panel\/projects\/([^/]+)/;

interface CommandPaletteContextValue {
  readonly isOpen: boolean;
  readonly open: () => void;
  readonly close: () => void;
  readonly toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

/**
 * Don't hijack "/" while the conductor is typing — guard text fields, selects
 * and any contenteditable surface (note editors, search inputs).
 */
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

interface CommandPaletteProviderProps {
  readonly user: AuthUser | null;
  readonly children: React.ReactNode;
}

export const CommandPaletteProvider = ({
  user,
  children,
}: CommandPaletteProviderProps): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((previous) => !previous), []);

  // Remember which projects the conductor actually opens, so the palette can
  // offer them as "recent" jumps. Ignore the /new create route.
  useEffect(() => {
    const match = PROJECT_HUB_PATH.exec(location.pathname);
    const projectId = match?.[1];
    if (projectId && projectId !== "new") {
      recordProjectVisit(projectId);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdK =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k";

      if (isCmdK) {
        event.preventDefault();
        toggle();
        return;
      }

      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        open();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, toggle]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette user={user} isOpen={isOpen} onClose={close} />
    </CommandPaletteContext.Provider>
  );
};

CommandPaletteProvider.displayName = "CommandPaletteProvider";

export const useCommandPalette = (): CommandPaletteContextValue => {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within a CommandPaletteProvider",
    );
  }
  return context;
};
