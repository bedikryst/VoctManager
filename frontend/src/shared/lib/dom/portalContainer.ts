/**
 * @file portalContainer.ts
 * @description Where an overlay portals to, and how Escape reaches it through
 * a side panel.
 *
 * Outside a side panel an overlay portals to `document.body`. Inside one it
 * portals to the panel's own layer. The panel is a modal Radix Dialog, which
 * takes pointer events from the body, keeps focus inside its own DOM and hides
 * its siblings from assistive technology; a confirmation or a sheet opened from
 * the panel but mounted on the body would be shown and unusable. `ConfirmModal`,
 * `BottomSheet` and `Portal` read the container; Radix's own popovers (a
 * select, a menu) need nothing, because Radix stacks its layers itself.
 *
 * Escape reaches the panel first: Radix listens on the document in the capture
 * phase. When an overlay opened from the panel holds the focus, the panel stays
 * and passes the key on. It still has to mark the event handled, which is the
 * only way to keep Radix from closing it, so it also records the event here:
 * an overlay that skips keys already handled by a popover inside it can tell
 * that this one was meant for it.
 * @module shared/lib/dom/portalContainer
 */

import { createContext, useContext } from "react";

const PortalContainerContext = createContext<HTMLElement | null>(null);

/** Provided by `SidePanel` with its layer; `null` until the layer mounts. */
export const PortalContainerProvider = PortalContainerContext.Provider;

export const usePortalContainer = (): HTMLElement =>
  useContext(PortalContainerContext) ?? document.body;

const escapesPassedOn = new WeakSet<Event>();

/** Keeps the panel open on this Escape and leaves it to the overlay above. */
export const passEscapeOn = (event: KeyboardEvent): void => {
  escapesPassedOn.add(event);
  event.preventDefault();
};

/** Whether a handled Escape was handled only to be passed on to an overlay. */
export const wasEscapePassedOn = (event: Event): boolean =>
  escapesPassedOn.has(event);
