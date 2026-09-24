/**
 * @file PayablesPage.tsx
 * @description Do zapłaty — every fee and expense the foundation still owes,
 * across projects, and on its second list everything already paid. Which list,
 * the filters, the sort and the page all live in the URL, and all of them go
 * to the server, so the count, the sum and the paging describe the rows the
 * filters actually pick (`lib/payablesQuery.ts` keeps the request one the
 * server accepts).
 *
 * What is owed can be paid from here: rows selected on any page of the same
 * filters are marked paid in one act, all or nothing, on the hub's own pay
 * sheet. When the server refuses, nothing is paid; the rows it named are
 * marked with its reason and taken out of the selection, so the next attempt
 * pays the rest. Reverting a payment stays in the project's hub, where the
 * board states its reason. A row opens that cost in its project's hub.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/PayablesPage
 */

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, ChevronRight, HandCoins, RefreshCw, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import {
  DataTable,
  formatSort,
  parseSort,
  type DataTableColumn,
  type DataTableSelection,
  type DataTableSort,
} from "@/shared/ui/composites/DataTable";
import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { PAYABLES_PAGE_SIZE, usePayables, usePayPayables } from "../api/finance.queries";
import { PayDateSheet, type PayWording } from "../budget/components/ActSheets";
import { SelectionBar } from "../budget/components/SelectionBar";
import {
  paymentRefusals,
  toastFinanceError,
  type PaymentRefusalReason,
} from "../lib/financeErrors";
import { formShortLabel, formatFinanceDate, todayIsoDate } from "../lib/financePresentation";
import { costItemHref } from "../lib/links";
import { formatTableAmount, fromGrosze, toGrosze } from "../lib/money";
import {
  PAYABLES_PARAM,
  payablesRequest,
  readPayablesFilters,
  withParam,
  withStatus,
} from "../lib/payablesQuery";
import { hasCosts } from "../lib/portfolio";
import type { IsoDate, PayableDTO, PayableStatus } from "../types/finance.dto";
import { useFinanceOutlet } from "./financeOutlet";

/**
 * The selection and the last refusal belong to one list under one set of
 * filters; `scope` names it, and a change of filters starts both afresh.
 */
interface Picked {
  readonly scope: string;
  readonly rows: ReadonlyMap<string, PayableDTO>;
  readonly refused: ReadonlyMap<string, PaymentRefusalReason>;
  readonly closedProjects: ReadonlySet<string>;
}

const emptyPick = (scope: string): Picked => ({
  scope,
  rows: new Map(),
  refused: new Map(),
  closedProjects: new Set(),
});

const payeeOf = (row: PayableDTO): string =>
  row.kind === "EXPENSE" ? row.vendor_name : row.payee_name;

const titleOf = (row: PayableDTO): string =>
  row.kind === "EXPENSE" ? row.description : row.payee_role;

const sumOf = (rows: Iterable<PayableDTO>): string => {
  let grosze = 0;
  for (const row of rows) grosze += toGrosze(row.cost_amount) ?? 0;
  return formatTableAmount(fromGrosze(grosze)) ?? "0,00";
};

export default function PayablesPage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const { overview } = useFinanceOutlet();
  const { pathname, search } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isOnline = useIsOnline();

  const knownProjects = useMemo(
    () => new Set(overview.projects.map((rollup) => rollup.project.id)),
    [overview.projects],
  );
  const filters = useMemo(
    () => readPayablesFilters(searchParams, knownProjects),
    [searchParams, knownProjects],
  );
  const request = useMemo(() => payablesRequest(filters, PAYABLES_PAGE_SIZE), [filters]);
  const query = usePayables(request);
  const pay = usePayPayables();
  const page = query.data;
  const unpaid = filters.status === "unpaid";

  const scope = [filters.status, filters.project ?? "", filters.kind ?? ""].join("|");
  const [picked, setPicked] = useState<Picked>(() => emptyPick(scope));
  const current = picked.scope === scope ? picked : emptyPick(scope);
  const [isPaying, setIsPaying] = useState(false);

  const update = (next: (params: URLSearchParams) => URLSearchParams): void =>
    setSearchParams((params) => next(params), { replace: true });

  // Paying the last rows of the last page leaves the reader past the end.
  const lastPage = page ? Math.max(1, Math.ceil(page.count / PAYABLES_PAGE_SIZE)) : 1;
  const pastTheEnd = page !== undefined && !query.isPlaceholderData && filters.page > lastPage;
  useEffect(() => {
    if (!pastTheEnd) return;
    setSearchParams(
      (params) => withParam(params, PAYABLES_PARAM.page, lastPage > 1 ? String(lastPage) : null),
      { replace: true },
    );
  }, [pastTheEnd, lastPage, setSearchParams]);

  const date = (value: IsoDate): string => formatFinanceDate(value, i18n.language);
  const today = todayIsoDate();
  const overdue = (row: PayableDTO): boolean =>
    unpaid && row.due_on !== null && row.due_on < today;

  const refusalOf = (row: PayableDTO): PaymentRefusalReason | null =>
    current.refused.get(row.cost_item_id) ??
    (current.closedProjects.has(row.project_id) ? "budget_locked" : null);

  const refusalCopy: Record<PaymentRefusalReason, string> = {
    unknown: t("finance.workspace.payables.refused.unknown", "Odrzucone — tej pozycji już nie ma w projekcie"),
    unpriced: t("finance.workspace.payables.refused.unpriced", "Odrzucone — pozycja nie ma stawki"),
    volunteer: t("finance.workspace.payables.refused.volunteer", "Odrzucone — wolontariatu się nie wypłaca"),
    already_paid: t("finance.workspace.payables.refused.already_paid", "Odrzucone — pozycja jest już zapłacona"),
    budget_locked: t("finance.workspace.payables.refused.budget_locked", "Odrzucone — budżet projektu jest zamknięty"),
  };

  const refusal = (row: PayableDTO): React.ReactNode => {
    const reason = refusalOf(row);
    return reason ? (
      <Caption as="span" color="crimson" className="block">
        {refusalCopy[reason]}
      </Caption>
    ) : null;
  };

  const due = (row: PayableDTO): React.ReactNode => {
    if (!row.due_on) {
      return (
        <Text as="span" size="sm" color="muted">
          –
        </Text>
      );
    }
    return (
      <span className="flex flex-col">
        <Text as="span" size="sm" color={overdue(row) ? "gold" : "default"}>
          {date(row.due_on)}
        </Text>
        {overdue(row) && (
          <Caption as="span" color="gold">
            {t("finance.workspace.payables.overdue", "po terminie")}
          </Caption>
        )}
      </span>
    );
  };

  const form = (row: PayableDTO): string =>
    row.kind === "EXPENSE"
      ? t("finance.workspace.payables.expense", "wydatek")
      : row.form
        ? formShortLabel(t, row.form)
        : "–";

  const amount = (row: PayableDTO): React.ReactNode => (
    <Text as="span" size="sm" weight="medium">
      {formatTableAmount(row.cost_amount) ?? "–"}
    </Text>
  );

  const columns: DataTableColumn<PayableDTO>[] = [
    {
      id: "due_on",
      header: t("finance.workspace.payables.due_on", "Termin"),
      sortable: true,
      className: "w-32",
      cell: due,
    },
    {
      id: "payee",
      header: t("finance.workspace.payables.payee", "Odbiorca"),
      sortable: true,
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <Text as="span" size="sm" weight="medium">
            {payeeOf(row)}
          </Text>
          {refusal(row)}
        </span>
      ),
    },
    {
      id: "title",
      header: t("finance.workspace.payables.title_column", "Tytuł"),
      cell: (row) => (
        <Text as="span" size="sm" color="graphite">
          {titleOf(row) || "–"}
        </Text>
      ),
    },
    {
      id: "project",
      header: t("finance.workspace.projects.project", "Projekt"),
      sortable: true,
      className: "w-48",
      cell: (row) => (
        <Text as="span" size="sm">
          {row.project_title}
        </Text>
      ),
    },
    {
      id: "form",
      header: t("finance.workspace.payables.form", "Forma"),
      className: "w-28",
      cell: (row) => (
        <Caption as="span" color="muted">
          {form(row)}
        </Caption>
      ),
    },
    ...(unpaid
      ? []
      : [
          {
            id: "paid_on",
            header: t("finance.workspace.charges.paid_on", "Zapłacono"),
            numeric: true,
            sortable: true,
            firstDirection: "desc",
            className: "w-32",
            cell: (row) => (
              <Text as="span" size="sm" color="sage">
                {row.paid_on ? date(row.paid_on) : "–"}
              </Text>
            ),
          } satisfies DataTableColumn<PayableDTO>,
        ]),
    {
      id: "amount",
      header: t("finance.workspace.charges.amount", "Kwota"),
      numeric: true,
      sortable: true,
      firstDirection: "desc",
      className: "w-36",
      cell: amount,
    },
  ];

  // Without `?ordering=` the header shows the order the server applies.
  const sort = parseSort(filters.ordering ?? (unpaid ? "due_on" : "-paid_on"));
  const setSort = (next: DataTableSort): void =>
    update((params) => withParam(params, PAYABLES_PARAM.ordering, formatSort(next)));

  const setFilter = (key: string, value: string | null): void =>
    update((params) => withParam(params, key, value));

  const hasFilters = Boolean(filters.project || filters.kind || filters.paidFrom || filters.paidTo);
  const clearFilters = (): void =>
    update((params) => {
      let next = params;
      for (const key of [PAYABLES_PARAM.project, PAYABLES_PARAM.kind, PAYABLES_PARAM.paidFrom, PAYABLES_PARAM.paidTo]) {
        next = withParam(next, key, null);
      }
      return next;
    });

  const projectOptions: SelectOption[] = overview.projects
    .filter((rollup) => hasCosts(rollup) || rollup.project.id === filters.project)
    .map(({ project }) => ({
      value: project.id,
      label: `${project.title} · ${formatLocalizedDate(
        project.date_time,
        { day: "numeric", month: "short", year: "numeric" },
        i18n.language,
        project.timezone,
      )}`,
    }));

  const kindOptions: SelectOption[] = [
    { value: "FEE", label: t("finance.workspace.payables.kind_fee", "Honoraria") },
    { value: "EXPENSE", label: t("finance.workspace.payables.kind_expense", "Wydatki") },
  ];

  const statusItems: { id: PayableStatus; label: string }[] = [
    { id: "unpaid", label: t("finance.workspace.nav.payables", "Do zapłaty") },
    { id: "paid", label: t("finance.workspace.payables.paid", "Zapłacone") },
  ];

  // ── Selection ───────────────────────────────────────────────────────────

  const edit = (change: (rows: Map<string, PayableDTO>) => void): void =>
    setPicked((previous) => {
      const base = previous.scope === scope ? previous : emptyPick(scope);
      const rows = new Map(base.rows);
      change(rows);
      return { ...base, rows };
    });

  const selection: DataTableSelection<PayableDTO> | undefined = unpaid
    ? {
        isSelected: (row) => current.rows.has(row.cost_item_id),
        onToggle: (row) =>
          edit((rows) => {
            if (rows.has(row.cost_item_id)) rows.delete(row.cost_item_id);
            else rows.set(row.cost_item_id, row);
          }),
        onToggleRows: (rowsOnScreen, select) =>
          edit((rows) => {
            for (const row of rowsOnScreen) {
              if (select) rows.set(row.cost_item_id, row);
              else rows.delete(row.cost_item_id);
            }
          }),
        rowLabel: (row) =>
          t("finance.row.select_aria", "Zaznacz — {{name}}", { name: payeeOf(row) }),
        allLabel: t("finance.workspace.payables.select_page", "Zaznacz wszystkie na tej stronie"),
      }
    : undefined;

  const selected = [...current.rows.values()];
  const kinds = new Set(selected.map((row) => row.kind));
  const wording: PayWording =
    kinds.size > 1 ? "mixed" : kinds.has("EXPENSE") ? "expense" : "fee";
  const manyProjects = new Set(selected.map((row) => row.project_id)).size > 1;
  const targets = selected.map((row) => ({
    id: row.cost_item_id,
    label: manyProjects ? `${payeeOf(row)} (${row.project_title})` : payeeOf(row),
  }));

  const handlePay = (paidOn: IsoDate): void => {
    const ids = targets.map((target) => target.id);
    pay.mutate(
      { ids, paid_on: paidOn },
      {
        onSuccess: (result) => {
          toast.success(
            t("finance.pay.done_expense", "Oznaczono jako zapłacone: {{count}} poz.", {
              count: result.count,
            }),
          );
          setPicked(emptyPick(scope));
          setIsPaying(false);
        },
        onError: (failure) => {
          const refusals = paymentRefusals(failure);
          if (refusals) {
            setPicked((previous) => {
              const base = previous.scope === scope ? previous : emptyPick(scope);
              const rows = new Map(base.rows);
              for (const [id, row] of base.rows) {
                if (refusals.items.has(id) || refusals.closedProjects.has(row.project_id)) {
                  rows.delete(id);
                }
              }
              return { scope, rows, refused: refusals.items, closedProjects: refusals.closedProjects };
            });
            setIsPaying(false);
          }
          toastFinanceError(failure, t, t("finance.pay.error", "Nie udało się oznaczyć wypłaty."));
        },
      },
    );
  };

  // ── Body ────────────────────────────────────────────────────────────────

  const financeReturn = pathname + search;
  const first = page && page.count > 0 ? page.offset + 1 : 0;
  const last = page ? page.offset + page.results.length : 0;
  const paged = page !== undefined && page.count > page.limit;

  const footer = page && page.count > 0 ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Caption color="muted" className="tabular-nums">
        {t("finance.workspace.payables.visible", "{{visible}} z {{total}}", {
          visible: paged ? `${first}–${last}` : page.results.length,
          total: page.count,
        })}
        {" · "}
        {t("finance.workspace.payables.total", "razem {{amount}} PLN", {
          amount: formatTableAmount(page.total_amount) ?? "0,00",
        })}
      </Caption>
      {paged && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={filters.page <= 1 || query.isPlaceholderData}
            onClick={() =>
              setFilter(PAYABLES_PARAM.page, filters.page > 2 ? String(filters.page - 1) : null)
            }
            leftIcon={<ChevronLeft size={14} aria-hidden="true" />}
          >
            {t("finance.workspace.payables.previous", "Wcześniejsze")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={last >= page.count || query.isPlaceholderData}
            onClick={() => setFilter(PAYABLES_PARAM.page, String(filters.page + 1))}
            rightIcon={<ChevronRight size={14} aria-hidden="true" />}
          >
            {t("finance.workspace.payables.next", "Dalsze")}
          </Button>
        </div>
      )}
    </div>
  ) : undefined;

  const emptyTitle = hasFilters
    ? t("finance.workspace.payables.empty_filtered", "Żadna pozycja nie pasuje do filtrów.")
    : unpaid
      ? t("finance.workspace.payables.empty", "Fundacja nie zalega z żadną płatnością.")
      : t("finance.workspace.payables.empty_paid", "Nic jeszcze nie oznaczono jako zapłacone.");

  const body = page ? (
    <DataTable
      label={unpaid ? statusItems[0].label : statusItems[1].label}
      rows={page.results}
      columns={columns}
      rowKey={(row) => row.cost_item_id}
      rowLink={(row) => ({ to: costItemHref(row), state: { financeReturn } })}
      sort={sort}
      onSortChange={setSort}
      selection={selection}
      footer={footer}
      className={cn("transition-opacity", query.isPlaceholderData && "opacity-60")}
      empty={{ icon: <HandCoins size={22} strokeWidth={1.5} />, title: emptyTitle }}
      mobile={{
        primary: (row) => (
          <Text as="span" size="sm" weight="medium">
            {payeeOf(row)}
          </Text>
        ),
        secondary: (row) => (
          <>
            <Caption as="span" color="muted">
              {[titleOf(row), row.project_title, form(row)].filter(Boolean).join(" · ")}
            </Caption>
            {refusal(row)}
          </>
        ),
        trailing: (row) => (
          <>
            {amount(row)}
            {unpaid ? (
              row.due_on && (
                <Caption as="span" color={overdue(row) ? "gold" : "muted"}>
                  {overdue(row)
                    ? t("finance.workspace.payables.overdue_on", "po terminie {{date}}", {
                        date: date(row.due_on),
                      })
                    : t("finance.workspace.payables.due_on_short", "termin {{date}}", {
                        date: date(row.due_on),
                      })}
                </Caption>
              )
            ) : (
              row.paid_on && (
                <Caption as="span" color="sage">
                  {date(row.paid_on)}
                </Caption>
              )
            )}
          </>
        ),
      }}
    />
  ) : query.isError ? (
    <StatePanel
      variant="inline"
      tone="danger"
      className="px-5 py-10"
      icon={<AlertTriangle size={22} strokeWidth={1.5} />}
      title={t("finance.workspace.payables.load_error", "Nie udało się wczytać płatności.")}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void query.refetch()}
          leftIcon={<RefreshCw size={14} aria-hidden="true" />}
        >
          {t("common.actions.retry", "Ponów")}
        </Button>
      }
    />
  ) : (
    <EtherealLoader fullHeight={false} />
  );

  return (
    <PageTransition>
      <div className="flex flex-col gap-5 pb-24">
        <SegmentedTabs
          items={statusItems}
          value={filters.status}
          onChange={(status) => update((params) => withStatus(params, status))}
          ariaLabel={t("finance.workspace.payables.status_aria", "Które płatności")}
        />

        <SectionCard
          as="h2"
          icon={<HandCoins size={15} aria-hidden="true" />}
          title={unpaid ? statusItems[0].label : statusItems[1].label}
          bodyClassName="p-0"
          action={
            hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                leftIcon={<X size={14} aria-hidden="true" />}
              >
                {t("finance.workspace.payables.clear_filters", "Wyczyść filtry")}
              </Button>
            ) : undefined
          }
        >
          <div
            className={cn(
              "grid grid-cols-1 items-end gap-3 border-b border-hairline px-5 py-4 sm:grid-cols-2",
              unpaid ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "xl:grid-cols-4",
            )}
          >
            <Select
              size="sm"
              label={t("finance.workspace.projects.project", "Projekt")}
              placeholder={t("finance.workspace.payables.all_projects", "Wszystkie projekty")}
              clearLabel={t("finance.workspace.payables.all_projects", "Wszystkie projekty")}
              options={projectOptions}
              value={filters.project ?? ""}
              onValueChange={(value) => setFilter(PAYABLES_PARAM.project, value || null)}
            />
            <Select
              size="sm"
              label={t("finance.workspace.payables.kind", "Rodzaj")}
              placeholder={t("finance.workspace.payables.kind_all", "Honoraria i wydatki")}
              clearLabel={t("finance.workspace.payables.kind_all", "Honoraria i wydatki")}
              options={kindOptions}
              value={filters.kind ?? ""}
              onValueChange={(value) => setFilter(PAYABLES_PARAM.kind, value || null)}
            />
            {!unpaid && (
              <>
                <DateTimeField
                  granularity="date"
                  clearable
                  label={t("finance.workspace.payables.paid_from", "Zapłacono od")}
                  value={filters.paidFrom ?? ""}
                  onChange={(value) => setFilter(PAYABLES_PARAM.paidFrom, value || null)}
                />
                <DateTimeField
                  granularity="date"
                  clearable
                  label={t("finance.workspace.payables.paid_to", "Zapłacono do")}
                  value={filters.paidTo ?? ""}
                  onChange={(value) => setFilter(PAYABLES_PARAM.paidTo, value || null)}
                  error={
                    filters.rangeInverted
                      ? t("finance.export.range_order", "Data początkowa jest późniejsza niż końcowa.")
                      : undefined
                  }
                />
              </>
            )}
          </div>
          {body}
        </SectionCard>
      </div>

      <SelectionBar
        isOpen={unpaid && current.rows.size > 0 && !isPaying}
        selectedCount={current.rows.size}
        summary={t("finance.workspace.payables.total", "razem {{amount}} PLN", {
          amount: sumOf(current.rows.values()),
        })}
        payableCount={current.rows.size}
        payLabel={t("finance.workspace.payables.pay", "Oznacz zapłacone ({{count}})", {
          count: current.rows.size,
        })}
        blockedReason={
          isOnline
            ? null
            : t("finance.offline.short", "Brak połączenia — rozliczeń nie zapisuje się offline.")
        }
        isWorking={pay.isPending}
        onPay={() => setIsPaying(true)}
        onClear={() => setPicked(emptyPick(scope))}
      />

      {isPaying && targets.length > 0 && (
        <PayDateSheet
          targets={targets}
          wording={wording}
          isPending={pay.isPending}
          onConfirm={handlePay}
          onClose={() => setIsPaying(false)}
        />
      )}
    </PageTransition>
  );
}
