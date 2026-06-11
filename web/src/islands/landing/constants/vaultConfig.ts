/**
 * @file vaultConfig.ts
 * @description Single source of truth for donation recipient + payment endpoints.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/constants/vaultConfig
 */

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
  /** Static offline baseline (zrzutka + manual bank transfers), merged with the API. */
  readonly progress: { readonly source: string };
}

export const VAULT_CONFIG: VaultConfig = {
  goalAmount: 20000,
  currency: "PLN",
  recipient: {
    name: "Fundacja VoctFoundation",
    nameShort: "VoctFoundation",
    nip: "6762718992",
    nrb: "26160010131724418410000001",
    ibanDisplay: "PL26 1600 1013 1724 4184 1000 0001",
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
  },
};
