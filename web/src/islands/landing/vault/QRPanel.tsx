/**
 * @file QRPanel.tsx
 * @description Bank-QR panel inside the donation vault. The QR image is a static asset
 *  (/qr-bank.png) generated out-of-band; we also expose the canonical Polish 2D (KIR) payload
 *  for debug/regeneration. Also carries the recurring-support copy: the same account details
 *  set up as a standing order (zlecenie stałe) — donor-controlled, no card stored. Web/Astro port.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/QRPanel
 */

import { useMemo, useState } from "react";

import { BrandGlyph } from "../BrandGlyph";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { buildPolishQRPayload } from "../lib/polishQR";
import { BANK_TRANSFER_FIELDS, TransferFieldButton } from "./transferFields";

export function QRPanel(): React.JSX.Element {
  const [imageMissing, setImageMissing] = useState(false);
  const debugPayload = useMemo(() => buildPolishQRPayload(0), []);
  const { copied: debugCopied, copy: debugCopy } = useCopyToClipboard();

  return (
    <article className="method" data-method="transfer">
      <div className="method-head">
        <div className="method-tag">
          <span className="method-tag-dot" aria-hidden="true" />
          <span className="micro">zero prowizji</span>
        </div>
        <span className="method-status" data-status="ready">
          dostępne
        </span>
      </div>
      <h3 className="method-title">Przelew z aplikacji bankowej</h3>
      <p className="method-note">
        Zeskanuj kod aparatem w aplikacji bankowej — wszystkie pola wypełnią się
        automatycznie. Bez prowizji.
      </p>

      <div className="method-qr-stage">
        <div className={`qr-canvas${imageMissing ? " is-missing" : ""}`}>
          {!imageMissing ? (
            <img
              src="/qr-bank.png"
              alt="Kod QR przelewu — Fundacja VoctFoundation"
              loading="lazy"
              onError={() => setImageMissing(true)}
            />
          ) : null}
          <div className="qr-canvas-placeholder" aria-hidden="true">
            <BrandGlyph strokeWidth={1.6} />
            <span className="qr-canvas-placeholder-text">
              QR<br />w przygotowaniu
            </span>
          </div>
        </div>
        <div className="qr-hint">
          <span>
            Otwórz aplikację banku, wybierz <strong>&quot;Przelew QR&quot;</strong> i zeskanuj.
            Kwotę wpiszesz w aplikacji.
          </span>
          <span className="qr-hint-banks">mBank · PKO · ING · Santander · Pekao · BNP</span>
        </div>
      </div>

      <details className="qr-debug">
        <summary>
          <span className="micro">pokaż dane QR</span>
          <span className="qr-debug-icon" aria-hidden="true" />
        </summary>
        <pre className="qr-debug-payload">{debugPayload}</pre>
        <button type="button" className="qr-debug-copy" onClick={() => void debugCopy(debugPayload)}>
          {debugCopied ? "Skopiowano" : "Kopiuj dane QR"}
        </button>
      </details>

      <div className="method-transfer-fields">
        {BANK_TRANSFER_FIELDS.map((field) => (
          <TransferFieldButton key={field.label} field={field} />
        ))}
      </div>

      <div className="transfer-recurring">
        <span className="transfer-recurring-label">
          <span className="transfer-recurring-dot" aria-hidden="true" />
          Wsparcie co miesiąc · zlecenie stałe
        </span>
        <p className="transfer-recurring-note">
          Chcesz wspierać cykl regularnie? Skopiuj powyższe dane i w swojej aplikacji bankowej
          ustaw je jako <strong>zlecenie stałe</strong> (zakładka „zlecenia stałe" /
          „płatności cykliczne") — np. 25, 50 lub 100&nbsp;zł miesięcznie. Kod QR powyżej tworzy
          przelew jednorazowy; zlecenie cykliczne wpisuje się ręcznie. Pozostaje ono w pełni pod
          Twoją kontrolą — zmienisz je lub odwołasz w każdej chwili w bankowości, bez kontaktu
          z nami. Bez prowizji i bez przekazywania danych karty.
        </p>
      </div>
    </article>
  );
}
