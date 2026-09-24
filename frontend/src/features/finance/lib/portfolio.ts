/**
 * @file portfolio.ts
 * @description Derivations over the foundation's finance overview that more
 * than one surface of the workspace must agree on.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/portfolio
 */

import type { ProjectRollupDTO } from "../types/finance.dto";
import { isPositiveAmount } from "./money";

/**
 * Whether a project has anything on its books: a fee row (priced or not — an
 * unpriced one is work still to do) or a counted cost. Projekty lists these by
 * default, and the workspace nav counts exactly these, so the number beside
 * the section is the number of rows it opens on.
 */
export const hasCosts = (rollup: ProjectRollupDTO): boolean =>
  rollup.summary.rows > 0 || isPositiveAmount(rollup.summary.committed);
