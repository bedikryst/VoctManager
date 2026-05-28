/**
 * @file VaultIsland.tsx
 * @description Self-contained donation vault island — the single React root that owns the
 *  VaultProvider plus every donation surface (sheet, regulamin, gratitude / failure result
 *  modals). Mounted on the landing AND every subpage so a "Wesprzyj" button opens the vault in
 *  place (via the `voct:open-vault` window event) instead of deep-linking to the homepage.
 *  Also auto-opens on a `?donate` URL (legacy deep-link parity). Result modals self-trigger from
 *  `?donated=success|failure` on return from the gateway.
 *
 *  Styles: the landing gets them from landing.css; subpages must import styles/vault.css.
 * @architecture Astro islands 2026
 * @module islands/landing/VaultIsland
 */

import { useEffect } from "react";

import { VaultProvider, useVault } from "./providers/VaultContext";
import { FailureModal } from "./vault/FailureModal";
import { GratitudeModal } from "./vault/GratitudeModal";
import { RegulaminModal } from "./vault/RegulaminModal";
import { VaultModal } from "./vault/VaultModal";

function VaultBridge(): null {
  const { open } = useVault();

  useEffect(() => {
    const onOpen = (event: Event): void => {
      const detail = (event as CustomEvent<{ amount?: number }>).detail;
      open(detail?.amount);
    };
    window.addEventListener("voct:open-vault", onOpen);

    // Deep-link parity: `?donate` opens the vault straight away (e.g. shared links).
    if (new URLSearchParams(window.location.search).has("donate")) {
      open(100);
    }
    return () => window.removeEventListener("voct:open-vault", onOpen);
  }, [open]);

  return null;
}

export function VaultIsland(): React.JSX.Element {
  return (
    <VaultProvider>
      <VaultBridge />
      <VaultModal />
      <RegulaminModal />
      <GratitudeModal />
      <FailureModal />
    </VaultProvider>
  );
}
