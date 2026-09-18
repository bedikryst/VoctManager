/**
 * @file transferFields.tsx
 * @description Shared copy-to-clipboard transfer-field button, and the one-off transfer form
 *  built from it for the QR panel. The standing order's fields are not here: recurring support
 *  has one home, /fundacja#mecenat, which prints its own transfer block.
 *
 *  THE ACCOUNT DATA ITSELF IS `src/data/foundation.ts`. It was declared here too, in local
 *  constants under a header claiming this was its only home — while `constants/vaultConfig.ts`
 *  claimed the same thing about its own copy. Two files, one number, two claims of exclusivity.
 *
 *  A FIELD'S LABEL TURNS WITH THE READER; ITS VALUE NEVER DOES. The label is chrome; the value is
 *  what the visitor pastes into their bank, and the transfer title is the string the foundation's
 *  own statement has to carry, so it stays Polish in every locale. Which is why the two are built
 *  here from a locale's chrome rather than being one translated object.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/transferFields
 */

import { FOUNDATION } from "../../../data/foundation";
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

const ACCOUNT = FOUNDATION.accounts.pln.nrb;
/* The domestic grouping a Polish bank form shows: the NRB in pairs and fours, with no country
   prefix. `FOUNDATION.accounts.pln.display` is the IBAN form, which is what an international
   transfer wants and what /press prints — the two are the same number, written for two readers. */
const ACCOUNT_DISPLAY = FOUNDATION.accounts.pln.display.replace(/^PL/, "").trim();
const RECIPIENT = FOUNDATION.name;
/* Without "ul." — the vault's field is narrow and the label beside it already says "Adres". */
const ADDRESS = FOUNDATION.addressLine.replace(/^ul\.\s*/, "");

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
