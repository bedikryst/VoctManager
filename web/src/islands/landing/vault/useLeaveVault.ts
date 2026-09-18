/**
 * @file useLeaveVault.ts
 * @description The one road OUT of the open vault to another page. The sheet pushes a history
 *  entry on open (VaultModal, overlayHistory.ts), so a bare `<a>` would strand that entry under
 *  the destination and eat the visitor's first back press; `navigateFromOverlay` consumes it.
 *  `close()` runs first because on /fundacja itself the destination is a same-page hash — the
 *  router scrolls without a swap, nothing unmounts, and the sheet would stay open over the
 *  anchor. Used by the sheet's own closing link (VaultModal); `leaveVaultOnInternalLink` also
 *  serves as a delegate should desk-written copy inside the sheet ever carry an internal link.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/useLeaveVault
 */

import { useCallback, type MouseEvent } from "react";

import { navigateFromOverlay } from "../../../lib/overlayHistory";
import { useVault } from "../providers/VaultContext";

export function useLeaveVault(): (href: string) => void {
  const { close } = useVault();
  return useCallback(
    (href: string) => {
      close();
      void navigateFromOverlay("vaultOpen", href);
    },
    [close],
  );
}

/**
 * Click handler for an internal link — on the anchor itself, or delegated from a block of
 * desk-written HTML that contains one: the link leaves through the vault's exit; external links,
 * mailto and modified clicks (new tab) keep the browser's default.
 */
export function leaveVaultOnInternalLink(
  event: MouseEvent<HTMLElement>,
  leave: (href: string) => void,
): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor || !event.currentTarget.contains(anchor)) return;
  const href = anchor.getAttribute("href");
  if (!href || !href.startsWith("/") || anchor.target === "_blank") return;
  event.preventDefault();
  leave(href);
}
