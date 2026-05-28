/**
 * @file useDonationProgress.ts
 * @description Fetches the static donation progress JSON exactly once and computes
 * derived display values (percent, min-visible width with a 3% floor when raised > 0).
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useDonationProgress
 */

import { useEffect, useState } from "react";

import { fetchDonationProgress, type DonationProgress } from "../api/progress";

export interface DonationProgressView {
  readonly raised: number;
  readonly goal: number;
  readonly donors: number;
  readonly percent: number;
  readonly visibleWidth: number;
  readonly updatedAt: string | null;
}

function project(data: DonationProgress): DonationProgressView {
  const percent =
    data.goal > 0 ? Math.min(100, Math.max(0, (data.raised / data.goal) * 100)) : 0;
  const visibleWidth = data.raised > 0 ? Math.max(percent, 3) : 0;
  return { ...data, percent, visibleWidth };
}

export function useDonationProgress(): DonationProgressView | null {
  const [view, setView] = useState<DonationProgressView | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchDonationProgress().then((data) => {
      if (!cancelled) setView(project(data));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return view;
}
