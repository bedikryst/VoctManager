/**
 * @file progress.ts
 * @description Reads the static `donation-progress.json` artifact (refreshed
 * out-of-band by an admin cron). Falls back gracefully to zeros when missing.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/api/progress
 */

import { VAULT_CONFIG } from "../constants/vaultConfig";

export interface DonationProgress {
  readonly raised: number;
  readonly goal: number;
  readonly donors: number;
  readonly updatedAt: string | null;
}

export async function fetchDonationProgress(): Promise<DonationProgress> {
  const fallback: DonationProgress = {
    raised: 0,
    goal: VAULT_CONFIG.goalAmount,
    donors: 0,
    updatedAt: null,
  };

  try {
    const response = await fetch(VAULT_CONFIG.progress.source, { cache: "no-store" });
    if (!response.ok) return fallback;
    const raw = (await response.json()) as Partial<DonationProgress>;
    return {
      raised: Number(raw.raised) || 0,
      goal: Number(raw.goal) || VAULT_CONFIG.goalAmount,
      donors: Number(raw.donors) || 0,
      updatedAt: raw.updatedAt ?? null,
    };
  } catch {
    return fallback;
  }
}
