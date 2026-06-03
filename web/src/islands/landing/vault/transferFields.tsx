/**
 * @file transferFields.tsx
 * @description Shared copy-to-clipboard transfer-field button + the foundation's canonical bank
 *  details. Reused by the QR transfer panel (one-off) and the Mecenat panel (standing order), so
 *  the account data and the copy interaction live in exactly one place. Web/Astro port.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/transferFields
 */

import { useCopyToClipboard } from "../hooks/useCopyToClipboard";

export interface TransferField {
  readonly label: string;
  readonly value: string;
  readonly display: string;
  readonly eventName: string;
}

export const BANK_TRANSFER_FIELDS: readonly TransferField[] = [
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

export function TransferFieldButton({ field }: { readonly field: TransferField }): React.JSX.Element {
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
