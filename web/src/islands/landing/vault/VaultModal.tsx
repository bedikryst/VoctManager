/**
 * @file VaultModal.tsx
 * @description The donation "skarbiec" sliding sheet: one-off giving only (Axepta form,
 *  Zrzutka, bank QR, under the campaign progress rail). Recurring support is not a second
 *  intent here — the standing-order relationship has one home, `/fundacja#mecenat`, and the
 *  sheet ends on a link to it.
 *  Manages browser-history integration (back closes), Lenis stop/start while open, the
 *  progress rail, and the `body.vault-open` flag for chrome theming. Web/Astro port.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/VaultModal
 */

import { useCallback, useEffect, useRef } from "react";

import { localizePath } from "../../../i18n/config";
import { UI } from "../../../i18n/ui";
import { dismissOverlayEntry, isOverlayEntry, pushOverlayEntry } from "../../../lib/overlayHistory";
import { BrandGlyph } from "../BrandGlyph";
import { VAULT_CONFIG } from "../constants/vaultConfig";
import { useBodyClass } from "../hooks/useBodyClass";
import { useDonationProgress } from "../hooks/useDonationProgress";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useLenisLock } from "../hooks/useLenisLock";
import { formatMoney } from "../lib/formatMoney";
import { useVault } from "../providers/VaultContext";
import { useVaultCopy } from "./copyContext";
import { GiveForm } from "./GiveForm";
import { QRPanel } from "./QRPanel";
import { leaveVaultOnInternalLink, useLeaveVault } from "./useLeaveVault";
import { ZrzutkaPanel } from "./ZrzutkaPanel";
import { Typo } from "../lib/Typo";

export function VaultModal(): React.JSX.Element {
  const { isOpen, close, openRegulamin } = useVault();
  const { lang, vault, terms, t } = useVaultCopy();
  const sheetRef = useRef<HTMLDivElement>(null);
  const progress = useDonationProgress();

  // Every user-initiated close routes through `dismiss`: if the entry we pushed on open is still
  // on top, pop it (→ popstate → close) so no "swallowed" back press lingers afterwards; otherwise
  // close directly. A genuine mobile back / edge-swipe lands straight in the popstate handler.
  const dismiss = useCallback(() => {
    dismissOverlayEntry("vaultOpen", close);
  }, [close]);

  const hrefMecenat = `${localizePath("/fundacja", lang)}#mecenat`;
  const leaveVault = useLeaveVault();

  useBodyClass(isOpen ? "vault-open" : null);
  useFocusTrap(sheetRef, isOpen, { onEscape: dismiss });
  useLenisLock(isOpen);

  // History integration: open → push a hash-marked entry via ClientRouter's navigate() (see
  // overlayHistory.ts — a raw pushState made the router re-swap the whole document on back,
  // re-running every reveal); popstate → close (the single close path shared by `dismiss`'s
  // history.back() and a genuine back press). #skarbiec matches no element id (#wesprzyj and
  // #vault are real anchors and would scroll), so nothing moves on open.
  useEffect(() => {
    if (!isOpen) return;
    pushOverlayEntry("vaultOpen", "skarbiec");
    const onPop = () => {
      if (!isOverlayEntry("vaultOpen")) close();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen, close]);

  const fillWidth = progress?.visibleWidth ?? 0;

  return (
    <Typo locale={lang}>
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
              <div className="micro vault-kicker">{vault.head.kicker}</div>
              <h2 className="vault-title" id="vault-title">
                {vault.head.title}
              </h2>
            </div>
            <button type="button" className="vault-close" onClick={dismiss} aria-label={t.close}>
              <span />
              <span />
            </button>
          </header>

          <div className="vault-body">
            <section className="vault-progress" aria-label={t.progressAria}>
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
                  {`${vault.progress.open} · ${
                    progress && progress.donors > 0
                      ? t.donors(progress.donors)
                      : vault.progress.awaiting
                  }`}
                </span>
                <span>
                  <strong>
                    {`${t.goalLabel} ${formatMoney(
                      progress?.goal ?? VAULT_CONFIG.goalAmount,
                      "PLN",
                      lang,
                    )}`}
                  </strong>
                </span>
              </div>
            </section>

            <section className="methods" aria-label={t.methodsAria}>
              <div className="methods-label micro">{vault.methods.label}</div>
              <div className="methods-grid">
                <article className="method" data-method="axepta" data-elevated="true">
                  <div className="method-head">
                    <div className="method-tag">
                      <span className="method-tag-dot" aria-hidden="true" />
                      <span className="micro">{vault.online.tag}</span>
                    </div>
                    <span className="method-status" data-status="ready">
                      {t.statusReady}
                    </span>
                  </div>
                  <h3 className="method-title">{vault.online.title}</h3>
                  <p className="method-note">{vault.online.note}</p>
                  <GiveForm />
                </article>

                <ZrzutkaPanel />
                <QRPanel />
              </div>
            </section>

            {/* Regular support is not a method here — it is a relationship, and it has one home.
                A real link (it reads as a page; long-press, middle-click and a modified click
                still get the URL in a new tab), committed through the vault's own exit
                (useLeaveVault) so the back button returns to the page the visitor came from. */}
            <a
              className="vault-recurring plausible-event-name=vault+mecenat"
              href={hrefMecenat}
              onClick={(event) => leaveVaultOnInternalLink(event, leaveVault)}
            >
              {t.recurringLink}
            </a>
          </div>

          <footer className="vault-foot">
            {/* The foundation's register: numbers and an address, the same in every language. The
                closing sentence is the chrome's own — /kontakt already owns that fact, and a
                sentence printed twice is read twice, never written twice. */}
            <p className="vault-trust">
              <strong>{VAULT_CONFIG.recipient.name}</strong>
              <br />
              KRS 0001237252 · NIP 6762718992 · REGON 544621525
              <br />
              {`Św. Filipa 23/3, 31-150 Kraków · ${UI[lang].footer.donationNote}`}
            </p>
            <div className="vault-foot-links">
              <button
                type="button"
                className="vault-foot-link plausible-event-name=regulamin+darowizn"
                aria-haspopup="dialog"
                aria-controls="regulamin"
                onClick={openRegulamin}
              >
                {terms.head.title}
              </button>
              <a
                className="vault-foot-link plausible-event-name=polityka+prywatnosci"
                href={localizePath("/polityka-prywatnosci", lang)}
                target="_blank"
                rel="noopener"
              >
                {`${UI[lang].footer.privacy} ↗`}
              </a>
            </div>
          </footer>
        </div>
      </aside>
    </Typo>
  );
}
