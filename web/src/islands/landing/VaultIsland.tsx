/**
 * @file VaultIsland.tsx
 * @description Self-contained donation vault island — the single React root that owns the
 *  VaultProvider plus every donation surface (sheet, regulamin, gratitude / failure result
 *  modals). Mounted on the landing AND every subpage so a "Wesprzyj" button opens the vault in
 *  place (via the `voct:open-vault` window event) instead of deep-linking to the homepage.
 *  Also auto-opens on a `?donate` URL (legacy deep-link parity). Result modals self-trigger from
 *  `?donated=success|failure` on return from the gateway.
 *
 *  IT IS NEVER MOUNTED DIRECTLY. `components/VaultMount.astro` is the one caller: it resolves the
 *  prose for the page's locale at build and hands it in, because `lib/vaultCopy` reads YAML through
 *  Vite and cannot run in a browser. Mounting this component by hand would compile and would then
 *  need a locale nobody supplied.
 *
 *  Styles: the landing gets them from landing.css; subpages must import styles/vault.css.
 * @architecture Astro islands 2026
 * @module islands/landing/VaultIsland
 */

import { useEffect } from "react";

import type { Locale } from "../../i18n/config";
import { VaultProvider, useVault } from "./providers/VaultContext";
import { VaultCopyProvider, type VaultCopyBundle } from "./vault/copyContext";
import { FailureModal } from "./vault/FailureModal";
import { GratitudeModal } from "./vault/GratitudeModal";
import { RegulaminModal } from "./vault/RegulaminModal";
import { VaultModal } from "./vault/VaultModal";

interface VaultBufferWindow {
  __voctVaultBuffer?: Array<{ amount?: number }>;
  __voctVaultBufferRelease?: () => void;
}

function VaultBridge(): null {
  const { open } = useVault();

  useEffect(() => {
    const onOpen = (event: Event): void => {
      const detail = (event as CustomEvent<{ amount?: number }>).detail;
      open(detail?.amount);
    };
    window.addEventListener("voct:open-vault", onOpen);

    // Drain the pre-hydration buffer (see components/landing/VaultBuffer.astro). A donation
    // CTA clicked before client:idle fires lands here as a buffered entry; we replay the
    // LAST one (last-write-wins) and release the inline-script listener.
    const w = window as Window & VaultBufferWindow;
    const buffered = w.__voctVaultBuffer;
    if (buffered && buffered.length > 0) {
      open(buffered[buffered.length - 1].amount);
      buffered.length = 0;
    }
    w.__voctVaultBufferRelease?.();

    // Deep-link parity: `?donate` opens the vault straight away (e.g. shared links).
    if (new URLSearchParams(window.location.search).has("donate")) {
      open(100);
    }
    return () => window.removeEventListener("voct:open-vault", onOpen);
  }, [open]);

  return null;
}

export function VaultIsland({
  lang,
  copy,
}: {
  readonly lang: Locale;
  readonly copy: VaultCopyBundle;
}): React.JSX.Element {
  return (
    <VaultCopyProvider lang={lang} copy={copy}>
      <VaultProvider>
        <VaultBridge />
        <VaultModal />
        <RegulaminModal />
        <GratitudeModal />
        <FailureModal />
      </VaultProvider>
    </VaultCopyProvider>
  );
}
