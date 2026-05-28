/**
 * @file VaultModal.tsx
 * @description The donation "skarbiec" sliding sheet — three payment methods side by side:
 *  Axepta online form (GiveForm), Zrzutka.pl, bank QR + IBAN. Manages browser-history
 *  integration (back closes), Lenis stop/start while open (via the shared instance), the
 *  progress rail, and the `body.vault-open` flag for chrome theming. Web/Astro port.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/VaultModal
 */

import { useEffect, useRef } from "react";

import { BrandGlyph } from "../BrandGlyph";
import { VAULT_CONFIG } from "../constants/vaultConfig";
import { useBodyClass } from "../hooks/useBodyClass";
import { useDonationProgress } from "../hooks/useDonationProgress";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useLenisLock } from "../hooks/useLenisLock";
import { formatMoney } from "../lib/formatMoney";
import { useVault } from "../providers/VaultContext";
import { GiveForm } from "./GiveForm";
import { QRPanel } from "./QRPanel";
import { ZrzutkaPanel } from "./ZrzutkaPanel";

export function VaultModal(): React.JSX.Element {
  const { isOpen, close, openRegulamin } = useVault();
  const sheetRef = useRef<HTMLDivElement>(null);
  const progress = useDonationProgress();

  useBodyClass(isOpen ? "vault-open" : null);
  useFocusTrap(sheetRef, isOpen, { onEscape: close });
  useLenisLock(isOpen);

  // History integration: open → push, back → close.
  useEffect(() => {
    if (!isOpen) return;
    if (!history.state?.vaultOpen) {
      history.pushState({ vaultOpen: true }, "");
    }
    const onPop = () => close();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen, close]);

  const fillWidth = progress?.visibleWidth ?? 0;

  return (
    <aside
      className={`vault${isOpen ? " is-open" : ""}`}
      id="vault"
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-labelledby="vault-title"
    >
      <div className="vault-backdrop" onClick={close} aria-hidden="true" />
      <div className="vault-sheet" tabIndex={-1} data-lenis-prevent ref={sheetRef}>
        <header className="vault-head">
          <div className="vault-mark" aria-hidden="true">
            <span className="vault-mark-halo" />
            <BrandGlyph />
          </div>
          <div className="vault-head-text">
            <div className="micro vault-kicker">Skarbiec muzyki · cykl MMXXVI</div>
            <h2 className="vault-title" id="vault-title">
              Wesprzyj cykl
            </h2>
          </div>
          <button type="button" className="vault-close" onClick={close} aria-label="Zamknij">
            <span />
            <span />
          </button>
        </header>

        <section className="vault-progress" aria-label="Postęp zbiórki">
          <div className="vault-progress-rail">
            <div
              className="vault-progress-fill"
              data-percent={progress ? Math.round(progress.percent) : 0}
              style={{ width: `${fillWidth}%` }}
            />
          </div>
          <div className="vault-progress-meta">
            <span>Zbiórka otwarta · cykl Concerts Spirituels</span>
            <span>
              <strong>cel {formatMoney(VAULT_CONFIG.goalAmount, "PLN")}</strong>
            </span>
          </div>
        </section>

        <section className="methods" aria-label="Wybierz drogę wsparcia">
          <div className="methods-label micro">Wybierz drogę</div>
          <div className="methods-grid">
            <article className="method" data-method="axepta" data-elevated="true">
              <div className="method-head">
                <div className="method-tag">
                  <span className="method-tag-dot" aria-hidden="true" />
                  <span className="micro">natychmiast · bezpiecznie</span>
                </div>
                <span className="method-status" data-status="ready">
                  dostępne
                </span>
              </div>
              <h3 className="method-title">Wpłać online</h3>
              <p className="method-note">
                Bezpośrednio na konto Fundacji — przez bramkę Axepta BNP Paribas. Bez
                pośredników, bez zakładania konta.
              </p>
              <GiveForm />
            </article>

            <ZrzutkaPanel />
            <QRPanel />
          </div>
        </section>

        <footer className="vault-foot">
          <p className="vault-trust">
            <strong>Fundacja VoctFoundation</strong>
            <br />
            KRS 0001237252 · NIP 6762718992 · REGON 544621525
            <br />
            Św. Filipa 23/3, 31-150 Kraków · Darowizna na cele statutowe.
          </p>
          <div className="vault-foot-links">
            <button
              type="button"
              className="vault-foot-link plausible-event-name=regulamin+darowizn"
              aria-haspopup="dialog"
              aria-controls="regulamin"
              onClick={openRegulamin}
            >
              Regulamin darowizn
            </button>
            <a
              className="vault-foot-link plausible-event-name=polityka+prywatnosci"
              href="/polityka-prywatnosci"
              target="_blank"
              rel="noopener"
            >
              Polityka prywatności ↗
            </a>
          </div>
        </footer>
      </div>
    </aside>
  );
}
