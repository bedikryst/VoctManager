/**
 * @file patronage.ts
 * @description Public patronage (mecenat) interest client. POSTs the volunteered contact details
 * to the Django endpoint, which persists a lead and notifies the foundation. Intentionally public
 * and cookie-less, mirroring the donation client — no card data, no session token required.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/api/patronage
 */

import { VAULT_CONFIG } from "../constants/vaultConfig";

export interface PatronInterestRequest {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly consent: boolean;
}

export class PatronInterestError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "PatronInterestError";
  }
}

export async function submitPatronInterest(payload: PatronInterestRequest): Promise<void> {
  let response: Response;
  try {
    response = await fetch(VAULT_CONFIG.api.patronInterest, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "omit",
      body: JSON.stringify({
        first_name: payload.firstName,
        last_name: payload.lastName,
        email: payload.email,
        consent: payload.consent,
      }),
    });
  } catch (cause) {
    throw new PatronInterestError("Network error contacting patronage endpoint", cause);
  }

  if (!response.ok) {
    throw new PatronInterestError(`Patron interest submit failed: HTTP ${response.status}`);
  }
}
