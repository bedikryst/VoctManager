/**
 * @file financeOutlet.ts
 * @description What the finance workspace's shell hands every section: the
 * foundation's overview, already loaded and gated. The shell owns the one
 * request; a section reads this instead of asking again.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/financeOutlet
 */

import { useOutletContext } from "react-router-dom";

import type { FinanceOverviewDTO } from "../types/finance.dto";

export interface FinanceOutletContext {
  readonly overview: FinanceOverviewDTO;
}

export const useFinanceOutlet = (): FinanceOutletContext =>
  useOutletContext<FinanceOutletContext>();
