/**
 * @file polishQR.ts
 * @description Polish Standard 2D (KIR) bank-transfer QR payload builder.
 * Format: NIP|Country|NRB|amount_in_grosze|recipient_short(≤20)|title(≤32)|||
 * Field length limits are enforced strictly — banking apps reject overflows.
 * Supported by mBank, PKO BP, ING, Santander, Pekao, BNP.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/lib/polishQR
 */

import { VAULT_CONFIG } from "../constants/vaultConfig";
import { asciiSafe } from "./asciiSafe";

export function buildPolishQRPayload(amount: number): string {
  const grosze = Math.max(0, Math.round(Number(amount) * 100));
  const { nip, nrb, nameShort, title } = VAULT_CONFIG.recipient;
  const name = asciiSafe(nameShort).slice(0, 20);
  const baseTitle = asciiSafe(title);
  const amountSuffix = ` ${Math.round(Number(amount))}zl`;
  const titleRoom = 32 - amountSuffix.length;
  const safeTitle = asciiSafe(baseTitle.slice(0, Math.max(0, titleRoom)) + amountSuffix).slice(0, 32);
  return [nip, "PL", nrb, String(grosze), name, safeTitle, "", "", ""].join("|");
}
