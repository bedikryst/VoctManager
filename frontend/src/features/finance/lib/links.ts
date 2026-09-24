/**
 * @file links.ts
 * @description Where a finance surface sends the reader to work on a cost:
 * its own row in the project's hub budget — Honoraria for a fee, Wydatki for
 * an expense — focused by `?focus=`, which scrolls to and marks the row.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/links
 */

import type { PayableKind } from "../types/finance.dto";

export interface CostItemRef {
  readonly project_id: string;
  readonly kind: PayableKind;
  readonly cost_item_id: string;
}

export const costItemHref = ({ project_id, kind, cost_item_id }: CostItemRef): string =>
  `/panel/projects/${project_id}/budget/${kind === "EXPENSE" ? "costs" : "people"}?focus=${cost_item_id}`;
