/**
 * @file QRPanel.tsx
 * @description Bank-QR panel inside the donation vault. The QR image itself is
 * a static asset (qr-bank.png) generated out-of-band — we expose the canonical
 * "open amount" payload for debug/regeneration purposes.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/VaultModal/QRPanel
 */

import { useMemo, useState } from "react";

import { useCopyToClipboard } from "@/features/landing/hooks/useCopyToClipboard";
import { buildPolishQRPayload } from "@/features/landing/lib/polishQR";
import { BrandGlyph } from "@/widgets/landing/BrandGlyph/BrandGlyph";

interface TransferField {
  readonly label: string;
  readonly value: string;
  readonly display: string;
  readonly eventName: string;
}

const TRANSFER_FIELDS: readonly TransferField[] = [
  {
    label: "Numer konta · PLN",
    value: "26160010131724418410000001",
    display: "26 1600 1013 1724 4184 1000 0001",
    eventName: "skarbiec+copy+nrkonta",
  },
  {
    label: "Odbiorca",
    value: "Fundacja VoctFoundation",
    display: "Fundacja VoctFoundation",
    eventName: "skarbiec+copy+fundacja",
  },
  {
    label: "Adres fundacji",
    value: "Św. Filipa 23/3, 31-150 Kraków",
    display: "Św. Filipa 23/3, 31-150 Kraków",
    eventName: "skarbiec+copy+adres",
  },
  {
    label: "Tytuł przelewu",
    value: "Darowizna na cele statutowe VoctFoundation",
    display: "Darowizna na cele statutowe VoctFoundation",
    eventName: "skarbiec+copy+tytul",
  },
];

function TransferFieldButton({ field }: { readonly field: TransferField }): React.JSX.Element {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className="transfer-field">
      <span className="transfer-field-label">{field.label}</span>
      <button
        type="button"
        className={`transfer-field-copy plausible-event-name=${field.eventName}`}
        onClick={() => void copy(field.value)}
      >
        <span className="transfer-field-val">{field.display}</span>
        <span className="transfer-field-copy-action">{copied ? "Skopiowano" : "Kopiuj"}</span>
      </button>
    </div>
  );
}

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
        <button
          type="button"
          className="qr-debug-copy"
          onClick={() => void debugCopy(debugPayload)}
        >
          {debugCopied ? "Skopiowano" : "Kopiuj dane QR"}
        </button>
      </details>

      <div className="method-transfer-fields">
        {TRANSFER_FIELDS.map((field) => (
          <TransferFieldButton key={field.label} field={field} />
        ))}
      </div>
    </article>
  );
}
