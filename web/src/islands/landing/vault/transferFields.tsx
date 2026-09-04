/**
 * @file transferFields.tsx
 * @description Shared copy-to-clipboard transfer-field button + the foundation's canonical bank
 *  details. Reused by the QR transfer panel (one-off) and the Mecenat panel (standing order), so
 *  the account data and the copy interaction live in exactly one place.
 *
 *  A FIELD'S LABEL TURNS WITH THE READER; ITS VALUE NEVER DOES. The label is chrome; the value is
 *  what the visitor pastes into their bank, and the transfer title is the string the foundation's
 *  own statement has to carry, so it stays Polish in every locale. Which is why the two are built
 *  here from a locale's chrome rather than being one translated object.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/transferFields
 */

import type { VaultChrome } from "../../../i18n/content/skarbiecChrome";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { useVaultCopy } from "./copyContext";
import { Typo } from "../lib/Typo";

export interface TransferField {
  readonly label: string;
  readonly value: string;
  readonly display: string;
  readonly eventName: string;
}

const ACCOUNT = "26160010131724418410000001";
const ACCOUNT_DISPLAY = "26 1600 1013 1724 4184 1000 0001";
const RECIPIENT = "Fundacja VoctFoundation";
const ADDRESS = "Św. Filipa 23/3, 31-150 Kraków";

/** The one-off transfer: account, recipient, address, title. */
export function bankTransferFields(t: VaultChrome): readonly TransferField[] {
  return [
    {
      label: t.fieldAccount,
      value: ACCOUNT,
      display: ACCOUNT_DISPLAY,
      eventName: "skarbiec+copy+nrkonta",
    },
    {
      label: t.fieldRecipient,
      value: RECIPIENT,
      display: RECIPIENT,
      eventName: "skarbiec+copy+fundacja",
    },
    { label: t.fieldAddress, value: ADDRESS, display: ADDRESS, eventName: "skarbiec+copy+adres" },
    {
      label: t.fieldTransferTitle,
      value: "Darowizna na cele statutowe VoctFoundation",
      display: "Darowizna na cele statutowe VoctFoundation",
      eventName: "skarbiec+copy+tytul",
    },
  ];
}

/** The standing order. A distinct title so the foundation can recognise incoming patronage. */
export function mecenatTransferFields(t: VaultChrome): readonly TransferField[] {
  return [
    {
      label: t.fieldAccount,
      value: ACCOUNT,
      display: ACCOUNT_DISPLAY,
      eventName: "mecenat+copy+nrkonta",
    },
    {
      label: t.fieldRecipient,
      value: RECIPIENT,
      display: RECIPIENT,
      eventName: "mecenat+copy+fundacja",
    },
    {
      label: t.fieldRecurringTitle,
      value: "Mecenat — darowizna na cele statutowe VoctFoundation",
      display: "Mecenat — darowizna na cele statutowe VoctFoundation",
      eventName: "mecenat+copy+tytul",
    },
  ];
}

export function TransferFieldButton({ field }: { readonly field: TransferField }): React.JSX.Element {
  const { lang, t } = useVaultCopy();
  const { copied, copy } = useCopyToClipboard();
  // `display` is typeset (Typo pins "Św." to "Filipa"); `value` is what lands on the clipboard and
  // is passed as an argument, never as a child — so what the visitor pastes into their bank stays
  // plain ASCII spacing.
  return (
    <Typo locale={lang}>
      <div className="transfer-field">
        <span className="transfer-field-label">{field.label}</span>
        <button
          type="button"
          className={`transfer-field-copy plausible-event-name=${field.eventName}`}
          onClick={() => void copy(field.value)}
        >
          <span className="transfer-field-val">{field.display}</span>
          <span className="transfer-field-copy-action">{copied ? t.copied : t.copy}</span>
        </button>
      </div>
    </Typo>
  );
}
