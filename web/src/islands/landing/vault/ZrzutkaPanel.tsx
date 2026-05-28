/**
 * @file ZrzutkaPanel.tsx
 * @description Companion payment method in the vault: opens the foundation's Zrzutka.pl page in
 *  a new tab (BLIK, card, Apple/Google Pay, recurring). Web/Astro port of the SPA widget.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/ZrzutkaPanel
 */

import { VAULT_CONFIG } from "../constants/vaultConfig";

export function ZrzutkaPanel(): React.JSX.Element {
  return (
    <article className="method" data-method="zrzutka">
      <div className="method-head">
        <div className="method-tag">
          <span className="method-tag-dot" aria-hidden="true" />
          <span className="micro">społeczność · instant</span>
        </div>
        <span className="method-status" data-status="ready">
          dostępne
        </span>
      </div>
      <h3 className="method-title">Zrzutka.pl</h3>
      <p className="method-note">
        BLIK, karta, Apple Pay, Google Pay. Wpłaty regularne dostępne. Dołącz do
        społeczności słuchaczy.
      </p>
      <a
        className="method-cta plausible-event-name=zrzutka+otworz"
        href={VAULT_CONFIG.zrzutka.url}
        target="_blank"
        rel="noopener"
      >
        <span className="method-cta-text">Otwórz Zrzutkę</span>
        <span className="method-cta-arrow" aria-hidden="true">
          ↗
        </span>
      </a>
    </article>
  );
}
