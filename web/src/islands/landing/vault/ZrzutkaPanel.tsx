/**
 * @file ZrzutkaPanel.tsx
 * @description Companion payment method in the vault: opens the foundation's Zrzutka.pl page in
 *  a new tab (BLIK, card, Apple/Google Pay, recurring). The service's name is a brand and stays
 *  itself in every locale, so it is written here rather than on the desk.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/ZrzutkaPanel
 */

import { VAULT_CONFIG } from "../constants/vaultConfig";
import { useVaultCopy } from "./copyContext";
import { Typo } from "../lib/Typo";

export function ZrzutkaPanel(): React.JSX.Element {
  const { lang, vault, t } = useVaultCopy();

  return (
    <Typo locale={lang}>
      <article className="method" data-method="zrzutka">
        <div className="method-head">
          <div className="method-tag">
            <span className="method-tag-dot" aria-hidden="true" />
            <span className="micro">{vault.zrzutka.tag}</span>
          </div>
          <span className="method-status" data-status="ready">
            {t.statusReady}
          </span>
        </div>
        <h3 className="method-title">Zrzutka.pl</h3>
        <p className="method-note">{vault.zrzutka.note}</p>
        <a
          className="method-cta plausible-event-name=zrzutka+otworz"
          href={VAULT_CONFIG.zrzutka.url}
          target="_blank"
          rel="noopener"
        >
          <span className="method-cta-text">{t.zrzutkaCta}</span>
          <span className="method-cta-arrow" aria-hidden="true">
            ↗
          </span>
        </a>
      </article>
    </Typo>
  );
}
