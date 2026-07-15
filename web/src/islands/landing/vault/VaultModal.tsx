/**
 * @file VaultModal.tsx
 * @description The donation "skarbiec" sliding sheet. A top segmented toggle splits two
 *  intents: "Jednorazowo" (one-off — Axepta form, Zrzutka, bank QR, with the campaign
 *  progress rail) and "Mecenat" (recurring — the standing-order patronage panel, no rail).
 *  Manages browser-history integration (back closes), Lenis stop/start while open, the
 *  progress rail, and the `body.vault-open` flag for chrome theming. Web/Astro port.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/VaultModal
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { BrandGlyph } from "../BrandGlyph";
import { VAULT_CONFIG } from "../constants/vaultConfig";
import { useBodyClass } from "../hooks/useBodyClass";
import { useDonationProgress } from "../hooks/useDonationProgress";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useLenisLock } from "../hooks/useLenisLock";
import { formatMoney } from "../lib/formatMoney";
import { useVault } from "../providers/VaultContext";
import { GiveForm } from "./GiveForm";
import { MecenatPanel } from "./MecenatPanel";
import { QRPanel } from "./QRPanel";
import { ZrzutkaPanel } from "./ZrzutkaPanel";

export function VaultModal(): React.JSX.Element {
  const { isOpen, close, openRegulamin } = useVault();
  const sheetRef = useRef<HTMLDivElement>(null);
  const progress = useDonationProgress();
  const [tab, setTab] = useState<"once" | "mecenat">("once");

  // Every user-initiated close routes through `dismiss`: if the entry we pushed on open is still
  // on top, pop it (→ popstate → close) so no "swallowed" back press lingers afterwards; otherwise
  // close directly. A genuine mobile back / edge-swipe lands straight in the popstate handler.
  const dismiss = useCallback(() => {
    if (history.state?.vaultOpen) history.back();
    else close();
  }, [close]);

  useBodyClass(isOpen ? "vault-open" : null);
  useFocusTrap(sheetRef, isOpen, { onEscape: dismiss });
  useLenisLock(isOpen);

  // History integration: open → push a state entry so the mobile back button dismisses the sheet
  // instead of leaving the page; popstate → close (the single close path shared by `dismiss`'s
  // history.back() and a genuine back press).
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
      <div className="vault-backdrop" onClick={dismiss} aria-hidden="true" />
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
          <button type="button" className="vault-close" onClick={dismiss} aria-label="Zamknij">
            <span />
            <span />
          </button>
        </header>

        <div className="vault-seg-wrap">
          <div className="vault-seg" role="tablist" aria-label="Forma wsparcia">
            <button
              type="button"
              role="tab"
              id="vault-tab-once"
              aria-selected={tab === "once"}
              aria-controls="vault-panel-once"
              className="vault-seg-tab plausible-event-name=vault+tab+jednorazowo"
              onClick={() => setTab("once")}
            >
              Jednorazowo
            </button>
            <button
              type="button"
              role="tab"
              id="vault-tab-mecenat"
              aria-selected={tab === "mecenat"}
              aria-controls="vault-panel-mecenat"
              className="vault-seg-tab plausible-event-name=vault+tab+mecenat"
              onClick={() => setTab("mecenat")}
            >
              Mecenat
            </button>
            <div className="vault-seg-thumb" data-active={tab} aria-hidden="true" />
          </div>
        </div>

        {tab === "once" ? (
          <div id="vault-panel-once" role="tabpanel" aria-labelledby="vault-tab-once">
            <section className="vault-progress" aria-label="Postęp zbiórki">
              <div className="vault-progress-rail">
                <div
                  className="vault-progress-fill"
                  data-percent={progress ? Math.round(progress.percent) : 0}
                  style={{ width: `${fillWidth}%` }}
                />
              </div>
              <div className="vault-progress-meta">
                {/* Donors lead when known — the count is the social proof; an early-stage
                    bar percentage alone reads as emptiness, not momentum. */}
                <span>
                  {progress && progress.donors > 0
                    ? `Zbiórka otwarta · ${progress.donors === 1 ? "1 darczyńca" : `${progress.donors} darczyńców`}`
                    : "Zbiórka otwarta · cykl Concerts Spirituels"}
                </span>
                <span>
                  <strong>cel {formatMoney(progress?.goal ?? VAULT_CONFIG.goalAmount, "PLN")}</strong>
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
          </div>
        ) : (
          <div id="vault-panel-mecenat" role="tabpanel" aria-labelledby="vault-tab-mecenat">
            <MecenatPanel />
          </div>
        )}

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
