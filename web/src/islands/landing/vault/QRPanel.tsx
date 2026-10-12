/**
 * @file QRPanel.tsx
 * @description The bank transfer, the second of the vault's other ways of giving. Folded under
 *  its title so the online form above stays the one road; opening it shows the transfer details
 *  as copy buttons and the recurring-support note (one sentence saying the same details work as a
 *  standing order — the road to /fundacja#wsparcie is the sheet's own closing line, VaultModal).
 *
 *  THE QR CODE IS FOR A COMPUTER ONLY. It is a static asset (/qr-bank.png, a Polish 2D/KIR
 *  payload generated out of band) that a banking app scans with the phone's camera — which the
 *  phone showing it cannot do. On a touch screen the stylesheet hides the code and its scanning
 *  note and prints `qr.noteTouch` instead, so the card leads with the copy buttons there.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/QRPanel
 */

import { useMemo, useState } from "react";

import { BrandGlyph } from "../BrandGlyph";
import { bankTransferFields, TransferFieldButton } from "./transferFields";
import { useVaultCopy } from "./copyContext";
import { Typo } from "../lib/Typo";

export function QRPanel(): React.JSX.Element {
  const { lang, vault, t } = useVaultCopy();
  const [imageMissing, setImageMissing] = useState(false);
  const fields = useMemo(() => bankTransferFields(t), [t]);

  return (
    <Typo locale={lang}>
      <article className="method" data-method="transfer">
        <details className="method-fold">
          {/* A summary holds phrasing content and headings only, so the head row is spans. */}
          <summary className="method-fold-summary">
            <span className="method-head">
              <span className="method-tag">
                <span className="method-tag-dot" aria-hidden="true" />
                <span className="micro">{vault.qr.tag}</span>
              </span>
              <span className="method-fold-icon" aria-hidden="true" />
            </span>
            <h3 className="method-title">{vault.qr.title}</h3>
          </summary>

          <div className="method-fold-body">
            <p className="method-note method-note--scan">{vault.qr.note}</p>
            <p className="method-note method-note--touch">{vault.qr.noteTouch}</p>

            <div className="method-qr-stage">
              <div className={`qr-canvas${imageMissing ? " is-missing" : ""}`}>
                {!imageMissing ? (
                  <img
                    src="/qr-bank.png"
                    alt={t.qrAlt}
                    loading="lazy"
                    onError={() => setImageMissing(true)}
                  />
                ) : null}
                <div className="qr-canvas-placeholder" aria-hidden="true">
                  <BrandGlyph strokeWidth={1.6} />
                  <span className="qr-canvas-placeholder-text">
                    {t.qrPending1}
                    <br />
                    {t.qrPending2}
                  </span>
                </div>
              </div>
              <div className="qr-hint">
                {/* An `HTML` copy field: it is injected, so `Typo` cannot reach into it and the
                    typographic pass was run on it at build (`lib/vaultCopy`). */}
                <span dangerouslySetInnerHTML={{ __html: vault.qr.hintHtml }} />
                <span className="qr-hint-banks">mBank · PKO · ING · Santander · Pekao · BNP</span>
              </div>
            </div>

            <div className="method-transfer-fields">
              {fields.map((field) => (
                <TransferFieldButton key={field.label} field={field} />
              ))}
            </div>

            <div className="transfer-recurring">
              <span className="transfer-recurring-label">
                <span className="transfer-recurring-dot" aria-hidden="true" />
                {vault.qr.recurringLabel}
              </span>
              <p
                className="transfer-recurring-note"
                dangerouslySetInnerHTML={{ __html: vault.qr.recurringNoteHtml }}
              />
            </div>
          </div>
        </details>
      </article>
    </Typo>
  );
}
