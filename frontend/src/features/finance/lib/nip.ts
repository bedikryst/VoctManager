/**
 * @file nip.ts
 * @description The Polish tax number as the server checks it
 * (`finance/rules.py::is_valid_nip`), so a mistyped NIP is caught on its field
 * in the manager's language instead of coming back as the API's English
 * validation sentence.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/nip
 */

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

/** However it was copied ("676-271-89-92", "PL6762718992"): the digits only. */
export const normalizeNip = (value: string): string => value.replace(/\D/g, "");

/** Weights over the first nine digits, modulo 11, must equal the tenth. */
export const isValidNip = (digits: string): boolean => {
  if (!/^\d{10}$/.test(digits)) return false;
  const checksum =
    NIP_WEIGHTS.reduce((sum, weight, index) => sum + Number(digits[index]) * weight, 0) % 11;
  return checksum !== 10 && checksum === Number(digits[9]);
};
