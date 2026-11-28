/**
 * @file SidePanel.tsx
 * @description The shell of a long record or an editor opened from a list: a
 * panel on the right edge, full height, the phone's whole screen below its
 * width cap. A modal Radix Dialog: focus stays inside, Escape closes, and focus
 * goes back to whatever opened it (a list row, an "add" button).
 *
 * Every way out (the scrim, Escape, the close button) goes through
 * `onCloseRequest`, so an editor with unsaved changes can ask first and close
 * only once the manager agrees.
 *
 * The dialog's element is a layer over the whole viewport holding the scrim,
 * the panel and whatever the panel opens. Overlays opened from inside portal
 * into that layer (`portalContainer.ts`), and it is never transformed, so
 * their `fixed` positioning still measures from the viewport; only the panel
 * inside it slides.
 * @module shared/ui/composites/SidePanel
 */

import React, { useLayoutEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import {
  passEscapeOn,
  PortalContainerProvider,
} from "@/shared/lib/dom/portalContainer";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

/**
 * The width cap from `sm` up: `md` 28 rem, a short form (a collaborator);
 * `lg` 36 rem, a record or a long form (an artist); `xl` 42 rem, a form
 * holding a map (a venue).
 */
export type SidePanelSize = "md" | "lg" | "xl";

const SIZE_CLASS: Record<SidePanelSize, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-2xl",
};

const ENTER: Transition = { type: "spring", damping: 26, stiffness: 220 };
/** A short ease-in: the entrance spring's settling tail would hold the panel
 *  on screen after it has visibly left. */
const EXIT: Transition = { duration: 0.22, ease: "circIn" };
const SCRIM: Transition = { duration: 0.2 };

export interface SidePanelProps {
  readonly isOpen: boolean;
  /** The scrim, Escape and the close button. The panel closes only when the
   *  caller sets `isOpen` to false. */
  readonly onCloseRequest: () => void;
  /** The record's name or the editor's title; also the dialog's name. */
  readonly title: React.ReactNode;
  /** One muted line under the title. */
  readonly byline?: React.ReactNode;
  /** Before the title: an avatar. */
  readonly leading?: React.ReactNode;
  /** Beside the close button: at most one icon button and one menu, as on a
   *  `RecordRow`. */
  readonly actions?: React.ReactNode;
  /** Pinned under the body: an editor's one submit. A submit here sits outside
   *  the form and names it with `form`. */
  readonly footer?: React.ReactNode;
  readonly size?: SidePanelSize;
  readonly children: React.ReactNode;
}

export const SidePanel = ({
  isOpen,
  onCloseRequest,
  title,
  byline,
  leading,
  actions,
  footer,
  size = "lg",
  children,
}: SidePanelProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // The exit renders the last open frame, whose handlers would still ask to
  // close a panel that is already leaving.
  const isOpenRef = useRef(isOpen);
  useLayoutEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  const requestClose = (): void => {
    if (isOpenRef.current) onCloseRequest();
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Content
              forceMount
              ref={setLayer}
              aria-describedby={undefined}
              onOpenAutoFocus={() => {
                // Focus has not moved yet: this is what opened the panel.
                openerRef.current =
                  document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;
              }}
              onCloseAutoFocus={(event) => {
                // Radix returns focus to a `Dialog.Trigger`, and a list row is
                // not one.
                event.preventDefault();
                const opener = openerRef.current;
                openerRef.current = null;
                if (opener?.isConnected) opener.focus({ preventScroll: true });
              }}
              // The layer covers the viewport, so "outside" is only what floats
              // above it on the body (a toast); the scrim closes the panel.
              onInteractOutside={(event) => event.preventDefault()}
              onEscapeKeyDown={(event) => {
                const target = event.target;
                const inOverlayAbove =
                  target instanceof Node &&
                  target !== layer &&
                  layer?.contains(target) === true &&
                  panelRef.current?.contains(target) !== true;
                if (inOverlayAbove) passEscapeOn(event);
              }}
              className="fixed inset-0 z-focus-trap outline-none"
            >
              <PortalContainerProvider value={layer}>
                <BodyScrollLock />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={SCRIM}
                  onClick={requestClose}
                  className="absolute inset-0 bg-surface-inverse/70"
                  aria-hidden="true"
                />
                <motion.section
                  ref={panelRef}
                  initial={{ transform: "translateX(100%)" }}
                  animate={{ transform: "translateX(0%)" }}
                  exit={{ transform: "translateX(100%)", transition: EXIT }}
                  transition={ENTER}
                  className={cn(
                    "absolute inset-y-0 right-0 flex w-full flex-col bg-ethereal-alabaster shadow-glass-solid sm:border-l sm:border-hairline-strong",
                    SIZE_CLASS[size],
                  )}
                >
                  <header className="flex shrink-0 items-center gap-3 border-b border-hairline px-5 py-3 md:px-6">
                    {leading && <div className="flex shrink-0">{leading}</div>}
                    <div className="min-w-0 flex-1 py-1">
                      <Dialog.Title asChild>
                        <Text
                          as="h2"
                          size="lg"
                          weight="semibold"
                          className="wrap-break-word"
                        >
                          {title}
                        </Text>
                      </Dialog.Title>
                      {byline && (
                        <Text as="div" size="sm" color="muted" className="mt-0.5">
                          {byline}
                        </Text>
                      )}
                    </div>
                    {actions && (
                      <div className="flex shrink-0 items-center gap-1">
                        {actions}
                      </div>
                    )}
                    <Dialog.Close asChild>
                      <Button
                        variant="icon"
                        size="icon"
                        className="-mr-2 shrink-0"
                        aria-label={t("common.actions.close", "Zamknij")}
                      >
                        <X size={18} aria-hidden="true" />
                      </Button>
                    </Dialog.Close>
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 md:p-6">
                    {children}
                  </div>

                  {footer && (
                    <div className="shrink-0 border-t border-hairline px-5 py-4 md:px-6">
                      {footer}
                    </div>
                  )}
                </motion.section>
              </PortalContainerProvider>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};
