/**
 * @file progress.ts
 * @description Donation progress from its one source, `/api/payments/donations/progress/`:
 *  SETTLED gateway (Axepta) donations plus the offline tallies (Zrzutka, bank transfers, other)
 *  that editors keep live at `/redakcja/zbiorka`, the goal, and whether the sheet draws the fill
 *  rail. The backend sums both halves, so the site never adds anything itself.
 *  A failed request degrades to an empty figure with the rail off: the sheet then prints the
 *  "awaiting" line and the build-time goal, and never draws a rail it has no figure for.
 * @module features/landing/api/progress
 */

import { VAULT_CONFIG } from "../constants/vaultConfig";

export interface DonationProgress {
  readonly raised: number;
  readonly goal: number;
  readonly donors: number;
  readonly showRail: boolean;
  readonly updatedAt: string | null;
}

const UNAVAILABLE: DonationProgress = {
  raised: 0,
  goal: VAULT_CONFIG.goalAmount,
  donors: 0,
  showRail: false,
  updatedAt: null,
};

export async function fetchDonationProgress(): Promise<DonationProgress> {
  try {
    const response = await fetch(VAULT_CONFIG.api.progress, { cache: "no-store" });
    if (!response.ok) return UNAVAILABLE;
    const raw = (await response.json()) as {
      raised?: unknown;
      donors?: unknown;
      goal?: unknown;
      showRail?: unknown;
      updatedAt?: unknown;
    };
    return {
      raised: Number(raw.raised) || 0,
      donors: Number(raw.donors) || 0,
      goal: Number(raw.goal) || VAULT_CONFIG.goalAmount,
      showRail: raw.showRail === true,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    };
  } catch {
    return UNAVAILABLE;
  }
}
