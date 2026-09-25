/**
 * @file vaultConfig.ts
 * @description The vault's own settings: the goal, the endpoints it posts to, and the transfer
 *  title a donor's statement has to carry.
 *
 *  WHO THE RECIPIENT IS COMES FROM `src/data/foundation.ts`, not from here. This file's header
 *  used to call itself the single source of truth for the recipient, and so did
 *  `vault/transferFields.tsx` — two files, each certain it was the only one, each holding its own
 *  copy of the account number. Neither was lying; both were written before the facts had a home.
 *  They do now, because the press pack needs them under plain Node as well.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/constants/vaultConfig
 */

import { FOUNDATION } from "../../../data/foundation";

export interface VaultRecipient {
  readonly name: string;
  readonly nameShort: string;
  readonly nip: string;
  readonly nrb: string;
  readonly ibanDisplay: string;
  readonly title: string;
  readonly titleDisplay: string;
}

export interface VaultConfig {
  readonly goalAmount: number;
  readonly currency: "PLN";
  readonly recipient: VaultRecipient;
  readonly zrzutka: { readonly url: string };
  readonly api: {
    readonly initiateDonation: string;
    readonly patronInterest: string;
    /** Live aggregate of SETTLED gateway donations (sum + distinct donors). */
    readonly progress: string;
  };
  readonly progress: {
    /** Static offline baseline (zrzutka + manual bank transfers), merged with the API. */
    readonly source: string;
    /**
     * Whether the sheet draws the fill rail. Off while the collection is early and a concert is
     * close: a short fill beside an announced evening reads as doubt that the evening will happen,
     * which the budget (secured) does not warrant. The donor count and the goal still print — the
     * count is the social proof, and neither says how far along the collection is.
     */
    readonly showRail: boolean;
  };
}

export const VAULT_CONFIG: VaultConfig = {
  goalAmount: 28000,
  currency: "PLN",
  recipient: {
    name: FOUNDATION.name,
    nameShort: FOUNDATION.nameShort,
    nip: FOUNDATION.registry.nip,
    // The donation account is the PLN one. The EUR account exists for foreign organisers paying
    // a fee and has never been offered as a donation target.
    nrb: FOUNDATION.accounts.pln.nrb,
    ibanDisplay: FOUNDATION.accounts.pln.display,
    title: "Darowizna na cele statutowe VoctFoundation",
    titleDisplay: "Darowizna na cele statutowe · VoctFoundation · cykl MMXXVI",
  },
  zrzutka: {
    url: "https://zrzutka.pl/7dewdj",
  },
  api: {
    initiateDonation: "/api/payments/donations/initiate/",
    patronInterest: "/api/payments/patronage/interest/",
    progress: "/api/payments/donations/progress/",
  },
  progress: {
    source: "/donation-progress.json",
    showRail: false,
  },
};
