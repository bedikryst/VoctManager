/**
 * @file FundingSourcePage.tsx
 * @description One funding source's page — what its settlement is made of. A
 * grant is settled per agreement, not per concert, so the page reads the
 * source whole: what it may carry and what is charged to it across every
 * project, each rule it states beside what the figures measure (the own
 * share on the plan and on the actuals, the administration share), the
 * projects it funds, and every cost charged to it in the order the report
 * lists them — with the costs that arose outside its eligibility period
 * marked. The formula for describing documents is kept here; the notes are
 * printed from it in Stage 6. It sits under the finance workspace's Źródła
 * section, and both ways out of it lead back there.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/overview/FundingSourcePage
 */

import React, { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, FolderKanban, Pencil, ReceiptText, ScrollText, Trash2 } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import {
  DataTable,
  sortRows,
  useSearchParamSort,
  type DataTableColumn,
} from "@/shared/ui/composites/DataTable";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { useDeleteSource, useFundingSource } from "../api/finance.queries";
import { ActSheet } from "../components/ActSheet";
import { CostSummaryCard, type CostFigure } from "../components/CostSummaryCard";
import { SourceSheet } from "../components/SourceSheet";
import { toastFinanceError } from "../lib/financeErrors";
import { costItemHref } from "../lib/links";
import {
  budgetStatusLabel,
  categoryLabel,
  formatFinanceDate,
  formatPercent,
  fundingKindLabel,
  fundingStatusLabel,
} from "../lib/financePresentation";
import {
  formatAmount,
  formatDifference,
  formatLedgerAmount,
  formatTableAmount,
  isPositiveAmount,
  toGrosze,
} from "../lib/money";
import type { FundingSourceDTO, SourceChargeDTO, SourceDetailDTO } from "../types/finance.dto";

const FINANCE_SOURCES_PATH = "/panel/finance/sources";

interface Fact {
  readonly label: string;
  readonly value: string;
  /** A rule the figures break reads in crimson. */
  readonly broken?: boolean;
}

const useFacts = (source: FundingSourceDTO): Fact[] => {
  const { t, i18n } = useTranslation();
  const date = (value: string | null): string | null =>
    value ? formatFinanceDate(value, i18n.language) : null;
  const { figures } = source;
  const measured = (plan: string | null, actual: string | null): string => {
    const parts = [
      plan !== null
        ? t("finance.source_page.measured_plan", "w kosztorysie {{pct}}", { pct: formatPercent(plan) })
        : null,
      actual !== null
        ? t("finance.source_page.measured_actual", "w kosztach {{pct}}", { pct: formatPercent(actual) })
        : null,
    ].filter(Boolean);
    return parts.length > 0 ? ` (${parts.join(", ")})` : "";
  };

  const facts: (Fact | null)[] = [
    { label: t("finance.source.kind", "Rodzaj"), value: fundingKindLabel(t, source.kind) },
    { label: t("finance.source.status", "Status"), value: fundingStatusLabel(t, source.status) },
    source.grantor ? { label: t("finance.source.grantor", "Grantodawca"), value: source.grantor } : null,
    source.agreement_number || source.agreement_date
      ? {
          label: t("finance.source_page.agreement", "Umowa"),
          value: [source.agreement_number, date(source.agreement_date)].filter(Boolean).join(" · "),
        }
      : null,
    source.eligible_from || source.eligible_to
      ? {
          label: t("finance.source_page.eligibility", "Koszty kwalifikowalne"),
          value: `${date(source.eligible_from) ?? "…"} – ${date(source.eligible_to) ?? "…"}`,
        }
      : null,
    source.report_due_on
      ? { label: t("finance.source.report_due_on", "Termin sprawozdania"), value: date(source.report_due_on) ?? "" }
      : null,
    source.required_own_share_pct !== null
      ? {
          label: t("finance.source_page.own_share", "Wymagany wkład własny"),
          value: `${formatPercent(source.required_own_share_pct) ?? ""}${measured(
            figures.own_share_plan_pct,
            figures.own_share_actual_pct,
          )}`,
          broken: figures.own_share_below,
        }
      : null,
    source.admin_cost_cap_pct !== null
      ? {
          label: t("finance.source_page.admin_cap", "Limit administracji"),
          value: `${formatPercent(source.admin_cost_cap_pct) ?? ""}${measured(
            figures.admin_plan_pct,
            figures.admin_actual_pct,
          )}`,
          broken: figures.admin_cap_exceeded,
        }
      : null,
    source.line_tolerance_pct !== null
      ? {
          label: t("finance.source.tolerance", "Tolerancja pozycji (%)"),
          value: formatPercent(source.line_tolerance_pct) ?? "",
        }
      : null,
  ];
  return facts.filter((fact): fact is Fact => fact !== null);
};

/**
 * Every cost charged to the source, in the order the report lists them until a
 * header says otherwise (`?ordering=`). A row opens the cost in its project's
 * ledger.
 */
function ChargesTable({ charges }: { readonly charges: readonly SourceChargeDTO[] }): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const { pathname, search } = useLocation();
  const [sort, setSort] = useSearchParamSort();
  const date = (value: string): string => formatFinanceDate(value, i18n.language);
  const payee = (charge: SourceChargeDTO): string =>
    charge.kind === "FEE" ? charge.payee_name : charge.vendor_name;
  const facts = (charge: SourceChargeDTO): string =>
    [charge.plan_line || categoryLabel(t, charge.category), charge.document_number || null]
      .filter(Boolean)
      .join(" · ");
  const ineligible = (charge: SourceChargeDTO): React.ReactNode =>
    charge.eligible ? null : (
      <Caption as="span" color="crimson">
        {t("finance.source_page.ineligible", "poza okresem kwalifikowalności")}
      </Caption>
    );
  const amount = (charge: SourceChargeDTO): React.ReactNode => (
    <>
      <Text as="span" size="sm">
        {formatTableAmount(charge.amount) ?? "0"}
      </Text>
      {charge.amount !== charge.cost_amount && (
        <Caption as="span" color="muted" className="block">
          {t("finance.source_page.of_cost", "z {{amount}}", {
            amount: formatTableAmount(charge.cost_amount) ?? "0",
          })}
        </Caption>
      )}
    </>
  );

  const columns: DataTableColumn<SourceChargeDTO>[] = [
    {
      id: "payee",
      header: t("finance.workspace.charges.cost", "Koszt"),
      sortValue: payee,
      cell: (charge) => (
        <span className="flex flex-col gap-0.5">
          <Text as="span" size="base" weight="medium">
            {payee(charge)}
          </Text>
          <Caption as="span" color="muted">
            {facts(charge)}
          </Caption>
          {ineligible(charge)}
        </span>
      ),
    },
    {
      id: "project",
      header: t("finance.workspace.projects.project", "Projekt"),
      sortValue: (charge) => charge.project_title,
      className: "w-48",
      cell: (charge) => (
        <Text as="span" size="sm">
          {charge.project_title}
        </Text>
      ),
    },
    {
      id: "incurred",
      header: t("finance.workspace.charges.incurred_on", "Data kosztu"),
      numeric: true,
      sortValue: (charge) => charge.incurred_on,
      className: "w-32",
      cell: (charge) => (
        <Text as="span" size="sm">
          {date(charge.incurred_on)}
        </Text>
      ),
    },
    {
      id: "paid",
      header: t("finance.workspace.charges.paid_on", "Zapłacono"),
      numeric: true,
      sortValue: (charge) => charge.paid_on,
      firstDirection: "desc",
      className: "w-32",
      cell: (charge) => (
        <Text as="span" size="sm" color={charge.paid_on ? "sage" : "muted"}>
          {charge.paid_on ? date(charge.paid_on) : "–"}
        </Text>
      ),
    },
    {
      id: "amount",
      header: t("finance.workspace.charges.amount", "Kwota"),
      numeric: true,
      sortValue: (charge) => toGrosze(charge.amount),
      firstDirection: "desc",
      className: "w-36",
      cell: amount,
    },
  ];

  return (
    <DataTable
      label={t("finance.source_page.charges", "Obciążone koszty")}
      rows={sortRows(charges, columns, sort)}
      columns={columns}
      rowKey={(charge) => charge.cost_item_id}
      rowLink={(charge) => ({
        to: costItemHref(charge),
        state: { financeReturn: pathname + search },
      })}
      sort={sort}
      onSortChange={setSort}
      empty={{
        icon: <ReceiptText size={22} strokeWidth={1.5} />,
        title: t("finance.source_page.charges_empty", "Tego źródła nie obciąża jeszcze żaden koszt."),
        description: t(
          "finance.source_page.charges_empty_desc",
          "Źródło obciąża się kosztami w projekcie: w zakładce Finansowanie albo w menu honorarium i wydatku.",
        ),
      }}
      mobile={{
        primary: (charge) => (
          <Text as="span" size="sm" weight="medium">
            {payee(charge)}
          </Text>
        ),
        secondary: (charge) => (
          <>
            <Caption as="span" color="muted">
              {[charge.project_title, facts(charge), date(charge.incurred_on)].filter(Boolean).join(" · ")}
            </Caption>
            {ineligible(charge)}
          </>
        ),
        trailing: amount,
      }}
    />
  );
}

function SourceBody({ detail }: { readonly detail: SourceDetailDTO }): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isOnline = useIsOnline();
  const remove = useDeleteSource();
  const [sheet, setSheet] = useState<"edit" | "delete" | null>(null);
  const { source, projects, charges } = detail;
  const { figures } = source;
  const facts = useFacts(source);
  const currency = t("common.currency", "PLN");

  const rail: CostFigure[] = [
    ...(source.awarded_amount !== null
      ? [
          {
            key: "awarded",
            label: t("finance.source_page.awarded", "Przyznano"),
            value: formatAmount(source.awarded_amount) ?? "0",
            unit: currency,
            tone: "default" as const,
          },
        ]
      : []),
    {
      key: "planned",
      label: t("finance.source_page.planned", "Oczekują projekty"),
      value: formatAmount(figures.planned) ?? "0",
      unit: currency,
      tone: "default",
    },
    ...(isPositiveAmount(figures.received)
      ? [
          {
            key: "received",
            label: t("finance.funding.received", "Wpłynęło"),
            value: formatAmount(figures.received) ?? "0",
            unit: currency,
            tone: "sage" as const,
          },
        ]
      : []),
    ...(figures.remaining !== null
      ? [
          {
            key: "remaining",
            label: t("finance.portfolio.remaining", "Zostało"),
            value: formatDifference(figures.remaining) ?? "0",
            unit: currency,
            tone: figures.over_awarded ? ("gold" as const) : ("default" as const),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        size="standard"
        roleText={t("finance.source_page.role", "Źródło finansowania")}
        title={source.name}
        rightContent={
          <span className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(FINANCE_SOURCES_PATH)}
              leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
            >
              {t("finance.workspace.nav.sources", "Źródła")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSheet("edit")}
              disabled={!isOnline}
              leftIcon={<Pencil size={14} aria-hidden="true" />}
            >
              {t("finance.source_page.edit", "Edytuj")}
            </Button>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <CostSummaryCard
            title={t("finance.source_page.money", "Pieniądze")}
            headlineLabel={t("finance.portfolio.charged", "Obciążono")}
            headline={formatAmount(figures.charged) ?? "0"}
            figures={rail}
            note={
              figures.over_awarded
                ? t(
                    "finance.source_page.over_awarded",
                    "Projekty oczekują albo obciążyły więcej, niż źródło przyznało. Zmniejsz oczekiwane kwoty w projektach albo zdejmij część kosztów.",
                  )
                : undefined
            }
          />

          <SectionCard
            as="h2"
            icon={<ReceiptText size={15} aria-hidden="true" />}
            title={t("finance.source_page.charges", "Obciążone koszty")}
            bodyClassName="p-0"
          >
            <ChargesTable charges={charges} />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard
            as="h2"
            icon={<ScrollText size={15} aria-hidden="true" />}
            title={t("finance.source_page.rules", "Zasady")}
          >
            <div className="flex flex-col gap-3">
              {facts.map((fact) => (
                <div key={fact.label} className="flex flex-col gap-0.5">
                  <Eyebrow size="overline-sm" color="muted">
                    {fact.label}
                  </Eyebrow>
                  <Text as="span" size="sm" color={fact.broken ? "crimson" : "default"}>
                    {fact.value}
                  </Text>
                </div>
              ))}
            </div>
            {source.note && (
              <Text size="sm" color="graphite" className="border-t border-hairline pt-3">
                {source.note}
              </Text>
            )}
          </SectionCard>

          <SectionCard
            as="h2"
            icon={<FolderKanban size={15} aria-hidden="true" />}
            title={t("finance.source_page.projects", "Projekty")}
            bodyClassName="p-0"
          >
            {projects.length === 0 ? (
              <StatePanel
                variant="inline"
                className="px-5 py-8"
                icon={<FolderKanban size={22} strokeWidth={1.5} />}
                title={t("finance.source_page.projects_empty", "Źródło nie finansuje jeszcze żadnego projektu.")}
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {projects.map((project) => {
                  const status = budgetStatusLabel(t, project.budget_status);
                  return (
                    <li key={project.funding_id}>
                      <Link
                        to={`/panel/projects/${project.project_id}/budget/funding?focus=${project.funding_id}`}
                        className="flex flex-col gap-0.5 px-5 py-3 transition-colors hover:bg-ethereal-ink/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40"
                      >
                        <Heading as="span" size="lg" weight="medium" className="truncate">
                          {project.project_title}
                        </Heading>
                        <Caption as="span" color="muted" className="tabular-nums">
                          {[
                            formatLocalizedDate(
                              project.project_date_time,
                              { day: "numeric", month: "short", year: "numeric" },
                              i18n.language,
                            ),
                            status,
                            t("finance.source_page.project_figures", "oczekuje {{planned}} · obciążono {{charged}}", {
                              planned: formatLedgerAmount(project.planned_amount) ?? "0",
                              charged: formatLedgerAmount(project.charged) ?? "0",
                            }),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Caption>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            as="h2"
            icon={<ScrollText size={15} aria-hidden="true" />}
            title={t("finance.source.template_section", "Opis dokumentów księgowych")}
          >
            <Text size="sm" color="graphite" className="whitespace-pre-line">
              {source.document_note_template}
            </Text>
            <Caption color="muted">
              {t(
                "finance.source_page.template_hint",
                "Na tej podstawie panel przygotuje opisy na odwrocie faktur i rachunków obciążonych tym źródłem.",
              )}
            </Caption>
          </SectionCard>

          {figures.project_count === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSheet("delete")}
              disabled={!isOnline}
              leftIcon={<Trash2 size={14} aria-hidden="true" />}
              className="self-start"
            >
              {t("finance.source_page.delete", "Usuń źródło")}
            </Button>
          )}
        </div>
      </div>

      {sheet === "edit" && <SourceSheet source={source} onClose={() => setSheet(null)} />}
      {sheet === "delete" && (
        <ActSheet
          isOpen
          destructive
          onClose={() => setSheet(null)}
          title={t("finance.source_page.delete_title", "Usuń źródło")}
          subtitle={source.name}
          confirmLabel={t("finance.source_page.delete_confirm", "Usuń")}
          isPending={remove.isPending}
          onConfirm={() =>
            remove.mutate(source.id, {
              onSuccess: () => {
                toast.success(t("finance.source_page.deleted", "Usunięto źródło."));
                navigate(FINANCE_SOURCES_PATH);
              },
              onError: (error) =>
                toastFinanceError(error, t, t("finance.source.error", "Nie udało się zapisać źródła.")),
            })
          }
        >
          <Text size="sm" color="graphite">
            {t(
              "finance.source_page.delete_body",
              "Źródło nie finansuje żadnego projektu, więc zniknie z listy. W historii zostaje ślad, że istniało.",
            )}
          </Text>
        </ActSheet>
      )}
    </>
  );
}

export default function FundingSourcePage(): React.JSX.Element {
  const { t } = useTranslation();
  const { sourceId = "" } = useParams<{ sourceId: string }>();
  const query = useFundingSource(sourceId);

  return (
    <PageTransition>
      <div className="relative flex flex-col gap-5 pb-24">
        {query.isLoading ? (
          <EtherealLoader message={t("finance.source_page.loading", "Wczytuję źródło…")} />
        ) : !query.data ? (
          <StatePanel
            tone="danger"
            icon={<AlertTriangle size={28} strokeWidth={1.5} />}
            title={t("finance.source_page.missing", "Nie ma takiego źródła.")}
            description={t(
              "finance.source_page.missing_desc",
              "Mogło zostać usunięte albo serwer nie odpowiedział.",
            )}
            actions={
              <Button variant="secondary" onClick={() => void query.refetch()}>
                {t("common.actions.retry", "Ponów")}
              </Button>
            }
          />
        ) : (
          <SourceBody detail={query.data} />
        )}
      </div>
    </PageTransition>
  );
}
