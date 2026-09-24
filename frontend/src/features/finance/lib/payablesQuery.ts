/**
 * @file payablesQuery.ts
 * @description Do zapłaty keeps its whole state in the URL — which list, the
 * filters, the sort, the page — so a reload or a link from another screen
 * lands on the same rows. This file reads that state and turns it into the
 * request the list sends.
 *
 * The server answers an unexpected parameter with a 400, and a URL can be
 * typed, shared or left over from the other list, so everything is read
 * defensively: a value the server would refuse is treated as absent, and an
 * absent value is never sent. A paid-date bound or the paid-date sort only
 * exists on Zapłacone; a project must be one the overview knows; two bounds
 * that cross stay on screen, to be corrected, but neither is sent.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/payablesQuery
 */

import type {
  IsoDate,
  PayableKind,
  PayablesQuery,
  PayableStatus,
} from "../types/finance.dto";

export const PAYABLES_PARAM = {
  status: "status",
  project: "project",
  kind: "kind",
  paidFrom: "paid_from",
  paidTo: "paid_to",
  ordering: "ordering",
  page: "page",
} as const;

/** The server's `?ordering=` whitelist, per list. */
const ORDERINGS: Record<PayableStatus, ReadonlySet<string>> = {
  unpaid: new Set(["due_on", "amount", "payee", "project"]),
  paid: new Set(["due_on", "amount", "payee", "project", "paid_on"]),
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface PayablesFilters {
  readonly status: PayableStatus;
  readonly project: string | null;
  readonly kind: PayableKind | null;
  readonly paidFrom: IsoDate | null;
  readonly paidTo: IsoDate | null;
  /** Both bounds are set and the start is after the end. */
  readonly rangeInverted: boolean;
  readonly ordering: string | null;
  /** 1-based. */
  readonly page: number;
}

const readDate = (params: URLSearchParams, key: string): IsoDate | null => {
  const value = params.get(key);
  return value && ISO_DATE.test(value) ? value : null;
};

export const readPayablesFilters = (
  params: URLSearchParams,
  knownProjects: ReadonlySet<string>,
): PayablesFilters => {
  const status: PayableStatus = params.get(PAYABLES_PARAM.status) === "paid" ? "paid" : "unpaid";
  const paid = status === "paid";

  const project = params.get(PAYABLES_PARAM.project);
  const kind = params.get(PAYABLES_PARAM.kind);
  const paidFrom = paid ? readDate(params, PAYABLES_PARAM.paidFrom) : null;
  const paidTo = paid ? readDate(params, PAYABLES_PARAM.paidTo) : null;
  const ordering = params.get(PAYABLES_PARAM.ordering);
  const page = Number(params.get(PAYABLES_PARAM.page));

  return {
    status,
    project: project && knownProjects.has(project) ? project : null,
    kind: kind === "FEE" || kind === "EXPENSE" ? kind : null,
    paidFrom,
    paidTo,
    rangeInverted: paidFrom !== null && paidTo !== null && paidFrom > paidTo,
    ordering: ordering && ORDERINGS[status].has(ordering.replace(/^-/, "")) ? ordering : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
};

/** The request for the filters' page; absent filters are left out, not sent blank. */
export const payablesRequest = (filters: PayablesFilters, limit: number): PayablesQuery => ({
  status: filters.status,
  ...(filters.project ? { project: filters.project } : {}),
  ...(filters.kind ? { kind: filters.kind } : {}),
  ...(filters.paidFrom && !filters.rangeInverted ? { paid_from: filters.paidFrom } : {}),
  ...(filters.paidTo && !filters.rangeInverted ? { paid_to: filters.paidTo } : {}),
  ...(filters.ordering ? { ordering: filters.ordering } : {}),
  limit,
  offset: (filters.page - 1) * limit,
});

/**
 * A filter or sort change. Every change but paging returns to the first page:
 * the page the reader was on belongs to a different list.
 */
export const withParam = (
  current: URLSearchParams,
  key: string,
  value: string | null,
): URLSearchParams => {
  const params = new URLSearchParams(current);
  if (value) params.set(key, value);
  else params.delete(key);
  if (key !== PAYABLES_PARAM.page) params.delete(PAYABLES_PARAM.page);
  return params;
};

/**
 * The other list. Leaving Zapłacone drops what only it understands — the
 * paid-date bounds and the paid-date sort — so the URL never carries a key
 * the unpaid list would be refused for.
 */
export const withStatus = (current: URLSearchParams, status: PayableStatus): URLSearchParams => {
  const params = withParam(current, PAYABLES_PARAM.status, status === "paid" ? "paid" : null);
  if (status === "unpaid") {
    params.delete(PAYABLES_PARAM.paidFrom);
    params.delete(PAYABLES_PARAM.paidTo);
    const ordering = params.get(PAYABLES_PARAM.ordering);
    if (ordering && !ORDERINGS.unpaid.has(ordering.replace(/^-/, ""))) {
      params.delete(PAYABLES_PARAM.ordering);
    }
  }
  return params;
};
