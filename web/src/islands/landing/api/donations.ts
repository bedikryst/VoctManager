/**
 * @file donations.ts
 * @description Public donation initiation client. Posts to the Django Axepta BNP Paribas
 * adapter and returns the gateway redirect URL. Endpoint is intentionally public and
 * cookie-less so the SPA session CSRF token is not required.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/api/donations
 */

import type { Locale } from "../../../i18n/config";
import { VAULT_CONFIG } from "../constants/vaultConfig";
import type { GiveCurrency } from "../constants/giveTiers";

export interface DonationRequest {
  readonly email: string;
  readonly amount: number;
  readonly currency: GiveCurrency;
  /**
   * The language the donor was reading a second ago. The gateway's hosted page carries its own
   * language in the URL it hands back, so the backend rewrites that segment from this — otherwise
   * a reader of any locale meets whichever page the gateway happens to default to, which today is
   * English even for a Polish donor.
   */
  readonly locale: Locale;
}

export interface DonationResponse {
  readonly redirectUrl: string;
}

export class DonationInitiateError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "DonationInitiateError";
  }
}

export async function initiateDonation(payload: DonationRequest): Promise<DonationResponse> {
  let response: Response;
  try {
    response = await fetch(VAULT_CONFIG.api.initiateDonation, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "omit",
      body: JSON.stringify(payload),
    });
  } catch (cause) {
    throw new DonationInitiateError("Network error contacting donation endpoint", cause);
  }

  if (!response.ok) {
    throw new DonationInitiateError(`Donation initiate failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as Partial<DonationResponse>;
  if (typeof data.redirectUrl !== "string" || data.redirectUrl.length === 0) {
    throw new DonationInitiateError("Donation initiate response is missing redirectUrl");
  }
  return { redirectUrl: data.redirectUrl };
}
