/**
 * @file giveTiers.ts
 * @description Donation tier configuration per currency, with translated payment method notes.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/constants/giveTiers
 */

export type GiveCurrency = "PLN" | "EUR";

export const GIVE_TIERS: Readonly<Record<GiveCurrency, readonly number[]>> = {
  PLN: [50, 100, 200],
  EUR: [20, 50, 100],
};

export const GIVE_METHODS_NOTE: Readonly<Record<GiveCurrency, string>> = {
  PLN: "Płatności w PLN obsługują BLIK, karty płatnicze, Apple/Google Pay oraz szybkie przelewy.",
  EUR: "Płatności w EUR obsługiwane są wyłącznie za pomocą kart płatniczych oraz Apple/Google Pay.",
};

export const CURRENCY_SUFFIX: Readonly<Record<GiveCurrency, string>> = {
  PLN: "zł",
  EUR: "€",
};

export const GIVE_MIN = 1;
export const GIVE_MAX = 100000;
export const GIVE_DEFAULT_TIER = 1;
