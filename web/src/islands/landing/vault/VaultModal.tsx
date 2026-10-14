/**
 * @file VaultModal.tsx
 * @description The donation "skarbiec" sliding sheet: one-off giving only. Under the head, one
 *  sentence on what a gift pays for, then the campaign line (donor count and goal, with a fill
 *  rail the progress response's `showRail` switches). The Axepta form is the one road and
 *  stands alone; Zrzutka and the bank transfer sit under it as the other ways, for a reader who
 *  already knows they would rather pay elsewhere. Three equal cards would ask a visitor to pick a
 *  payment rail before deciding to give at all. Recurring support is not a second intent here — every
 *  other way of giving (a standing order, patronage, a partnership) has one home,
 *  `/fundacja#wsparcie`, and once FOUNDATION_PAGE_LINKED the sheet ends on a link to it.
 *  Manages browser-history integration (back closes), Lenis stop/start while open, the
 *  campaign line, and the `body.vault-open` flag for chrome theming. Web/Astro port.
 * @module islands/landing/vault/VaultModal
 */

import { useCallback, useEffect, useRef } from "react";

import { FOUNDATION_PAGE_LINKED } from "../../../data/foundationSupport";
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

  const hrefSupport = `${localizePath("/fundacja", lang)}#wsparcie`;
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
            <p className="vault-lede">{vault.head.lede}</p>

            <section className="vault-progress" aria-label={t.progressAria}>
              {/* Switched by the editors at `/redakcja/zbiorka`; off whenever the figure is
                  unavailable, so a failed request never draws an empty rail. */}
              {progress?.showRail && (
                <div className="vault-progress-rail">
                  <div
                    className="vault-progress-fill"
                    data-percent={progress ? Math.round(progress.percent) : 0}
                    style={{ width: `${fillWidth}%` }}
                  />
                </div>
              )}
              <div className="vault-progress-meta">
                {/* Donors lead when known — the count is the social proof; an early-stage
                    bar percentage alone reads as emptiness, not momentum. */}
                {/* Each desk value in a span of its own: the comment mode reads a short value
                    composed into one text node with others as a stray word (comment-mode/match.ts). */}
                <span>
                  <span>{vault.progress.open}</span>
                  {" · "}
                  <span>
                    {progress && progress.donors > 0 ? t.donors(progress.donors) : vault.progress.awaiting}
                  </span>
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
              <article className="method" data-method="axepta" data-elevated="true">
                <div className="method-head">
                  <div className="method-tag">
                    <span className="method-tag-dot" aria-hidden="true" />
                    <span className="micro">{vault.online.tag}</span>
                  </div>
                </div>
                <h3 className="method-title">{vault.online.title}</h3>
                <p className="method-note">{vault.online.note}</p>
                <GiveForm />
              </article>

              <div className="methods-alt">
                <div className="methods-label micro">{vault.methods.label}</div>
                <ZrzutkaPanel />
                <QRPanel />
              </div>
            </section>

            {/* The other ways of giving are not methods here — they are relationships, with one home.
                A real link (it reads as a page; long-press, middle-click and a modified click
                still get the URL in a new tab), committed through the vault's own exit
                (useLeaveVault) so the back button returns to the page the visitor came from.
                Drawn only once FOUNDATION_PAGE_LINKED (data/foundationSupport). */}
            {FOUNDATION_PAGE_LINKED && (
              <a
                className="vault-recurring"
                href={hrefSupport}
                onClick={(event) => leaveVaultOnInternalLink(event, leaveVault)}
              >
                {t.recurringLink}
              </a>
            )}
          </div>

          <footer className="vault-foot">
            {/* The foundation's register: numbers and an address, the same in every language. The
                closing sentence is the chrome's own — /kontakt already owns that fact, and a
                sentence printed twice is read twice, never written twice. Chrome and registry
                data, no desk field: `data-desk="none"` here and on the privacy link below keeps the
                comment mode from reading their words as a desk field (comment-mode/match.ts). */}
            <p className="vault-trust" data-desk="none">
              <strong>{VAULT_CONFIG.recipient.name}</strong>
              <br />
              KRS 0001237252 · NIP 6762718992 · REGON 544621525
              <br />
              {`Św. Filipa 23/3, 31-150 Kraków · ${UI[lang].footer.donationNote}`}
            </p>
            <div className="vault-foot-links">
              <button
                type="button"
                className="vault-foot-link"
                aria-haspopup="dialog"
                aria-controls="regulamin"
                onClick={openRegulamin}
              >
                {terms.head.title}
              </button>
              <a
                className="vault-foot-link"
                data-desk="none"
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
