/**
 * @file progress.ts
 * @description Donation progress = live backend aggregate + static offline baseline.
 *  - `/api/payments/donations/progress/` — sum + distinct donors of SETTLED gateway
 *    (Axepta) donations, computed by the backend, so every online payment moves the
 *    rail with no manual step.
 *  - `donation-progress.json` — hand-maintained baseline for money the backend never
 *    sees (zrzutka, direct bank transfers).
 *  The two are summed; either source failing degrades gracefully to the other.
 * @architecture Astro islands 2026
 * @module features/landing/api/progress
 */

import { VAULT_CONFIG } from "../constants/vaultConfig";

export interface DonationProgress {
  readonly raised: number;
  readonly goal: number;
  readonly donors: number;
  readonly updatedAt: string | null;
}

interface ProgressSlice {
  readonly raised: number;
  readonly donors: number;
  readonly goal: number | null;
  readonly updatedAt: string | null;
}

const EMPTY_SLICE: ProgressSlice = { raised: 0, donors: 0, goal: null, updatedAt: null };

async function fetchSlice(url: string): Promise<ProgressSlice> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return EMPTY_SLICE;
  const raw = (await response.json()) as {
    raised?: unknown;
    donors?: unknown;
    goal?: unknown;
    updatedAt?: unknown;
  };
  return {
    raised: Number(raw.raised) || 0,
    donors: Number(raw.donors) || 0,
    goal: Number(raw.goal) || null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export async function fetchDonationProgress(): Promise<DonationProgress> {
  const [api, baseline] = await Promise.all([
    fetchSlice(VAULT_CONFIG.api.progress).catch(() => EMPTY_SLICE),
    fetchSlice(VAULT_CONFIG.progress.source).catch(() => EMPTY_SLICE),
  ]);

  return {
    raised: api.raised + baseline.raised,
    donors: api.donors + baseline.donors,
    // The backend's goal is the source of truth (settings-driven); the baseline
    // json and the build-time constant are successive fallbacks.
    goal: api.goal ?? baseline.goal ?? VAULT_CONFIG.goalAmount,
    updatedAt: baseline.updatedAt,
  };
}
