/**
 * @file QRPanel.tsx
 * @description Bank-QR panel inside the donation vault. The QR image is a static asset
 *  (/qr-bank.png) generated out-of-band; we also expose the canonical Polish 2D (KIR) payload
 *  for debug/regeneration. Also carries the recurring-support copy: the same account details
 *  set up as a standing order (zlecenie stałe) — donor-controlled, no card stored.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/QRPanel
 */

import { useMemo, useState } from "react";

import { BrandGlyph } from "../BrandGlyph";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { buildPolishQRPayload } from "../lib/polishQR";
import { bankTransferFields, TransferFieldButton } from "./transferFields";
import { useVaultCopy } from "./copyContext";
import { Typo } from "../lib/Typo";

export function QRPanel(): React.JSX.Element {
  const { lang, vault, t } = useVaultCopy();
  const [imageMissing, setImageMissing] = useState(false);
  const debugPayload = useMemo(() => buildPolishQRPayload(0), []);
  const { copied: debugCopied, copy: debugCopy } = useCopyToClipboard();
  const fields = useMemo(() => bankTransferFields(t), [t]);

  return (
    <Typo locale={lang}>
      <article className="method" data-method="transfer">
        <div className="method-head">
          <div className="method-tag">
            <span className="method-tag-dot" aria-hidden="true" />
            <span className="micro">{vault.qr.tag}</span>
          </div>
          <span className="method-status" data-status="ready">
            {t.statusReady}
          </span>
        </div>
        <h3 className="method-title">{vault.qr.title}</h3>
        <p className="method-note">{vault.qr.note}</p>

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

        <details className="qr-debug">
          <summary>
            <span className="micro">{t.qrDebugSummary}</span>
            <span className="qr-debug-icon" aria-hidden="true" />
          </summary>
          <pre className="qr-debug-payload">{debugPayload}</pre>
          <button type="button" className="qr-debug-copy" onClick={() => void debugCopy(debugPayload)}>
            {debugCopied ? t.copied : t.qrDebugCopy}
          </button>
        </details>

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
      </article>
    </Typo>
  );
}
