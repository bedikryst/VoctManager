/**
 * @file BudgetTab.tsx
 * @description What this concert costs in fees, and how much of it is still
 * owed. A summary rail tops two ledgers (cast | crew), each priced by hand or
 * in one stroke from the standard-rate field in its toolbar.
 * Every edit is a draft committed in one batch through the shared
 * `EditorActionBar`, so a whole repricing can be reviewed before it lands.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/BudgetTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Users, Wallet, Wrench } from "lucide-react";

import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { TabLoadingCard } from "./components/TabLoadingCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Metric, Text, Unit } from "@/shared/ui/primitives/typography";
import { formatAmount } from "../../lib/money";
import {
  useBudgetTab,
  type LedgerSection,
  type UseBudgetTabResult,
} from "../hooks/useBudgetTab";
import { FeeRow } from "./components/FeeRow";
import { StandardRateField } from "./components/StandardRateField";

interface BudgetTabProps {
  projectId: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

type FigureTone = "default" | "gold" | "sage";

interface Figure {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly tone: FigureTone;
}

/**
 * The rail states the split and, when they exist, the two facts that qualify
 * the total: what is missing from it and what has already left the account.
 * Neither appears at rest — "0 braków" on a freshly priced concert would put
 * the least interesting number in the loudest slot on the tab, which is the
 * mistake `TUTTI`, `CZEKA` and `ZAPROSZONY` each taught once already.
 */
function SummaryFigures({
  figures,
}: {
  figures: readonly Figure[];
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      {figures.map((figure) => (
        <div key={figure.key} className="flex flex-col gap-1.5">
          <Eyebrow size="overline-sm" color="muted">
            {figure.label}
          </Eyebrow>
          <span className="flex items-baseline gap-1.5">
            <Metric as="span" color={figure.tone} className="text-2xl leading-none">
              {figure.value}
            </Metric>
            {figure.unit && (
              <Unit
                color={figure.tone === "default" ? "muted" : figure.tone}
              >
                {figure.unit}
              </Unit>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

interface LedgerCardProps {
  readonly section: LedgerSection;
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly currencyLabel: string;
  readonly controller: UseBudgetTabResult;
}

function LedgerCard({
  section,
  title,
  icon,
  emptyTitle,
  emptyDescription,
  currencyLabel,
  controller,
}: LedgerCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const { side, entries, total, settledCount, missingCount } = section;
  const isEmpty = entries.length === 0;

  return (
    <SectionCard
      as="h2"
      scroll
      className="max-h-[60dvh]"
      bodyClassName="p-0 [scrollbar-gutter:stable]"
      icon={icon}
      title={title}
      action={
        !isEmpty ? (
          <Badge variant="neutral">
            {entries.length} {t("common.people_short", "os.")}
          </Badge>
        ) : undefined
      }
      toolbar={
        !isEmpty && controller.repriceableCount(side) > 0 ? (
          <StandardRateField
            value={controller.standardRateOf(side)}
            affectedCount={controller.repriceableCount(side)}
            currencyLabel={currencyLabel}
            onChange={(value) => controller.handleStandardRate(side, value)}
          />
        ) : undefined
      }
      footer={
        !isEmpty ? (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span className="inline-flex items-baseline gap-1.5">
              <Eyebrow as="span" color="muted">
                {t("projects.budget.footer.subtotal", "Razem")}
              </Eyebrow>
              <Text as="span" size="base" weight="medium" className="tabular-nums">
                {formatAmount(total)}
              </Text>
              <Eyebrow as="span" size="overline-sm" color="muted">
                {currencyLabel}
              </Eyebrow>
            </span>
            {missingCount > 0 && (
              <Eyebrow as="span" color="gold">
                {t("projects.budget.footer.missing", "{{count}} bez stawki", {
                  count: missingCount,
                })}
              </Eyebrow>
            )}
            {settledCount > 0 && (
              <Eyebrow as="span" color="sage">
                {t("projects.budget.footer.settled", "Rozliczonych: {{count}}", {
                  count: settledCount,
                })}
              </Eyebrow>
            )}
          </div>
        ) : undefined
      }
    >
      {isEmpty ? (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {entries.map((entry) => {
            const { value, isPending } = controller.rowState(entry);
            return (
              <FeeRow
                key={entry.id}
                entry={entry}
                value={value}
                isPending={isPending}
                currencyLabel={currencyLabel}
                onChange={(next) => controller.handleFeeChange(entry.id, next)}
              />
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

export const BudgetTab = ({
  projectId,
  onDirtyStateChange,
}: BudgetTabProps): React.JSX.Element => {
  const { t } = useTranslation();
  const controller = useBudgetTab(projectId, onDirtyStateChange);
  const {
    isLoading,
    isSaving,
    isDirty,
    cast,
    crew,
    kpi,
    handleReset,
    handleBulkSave,
  } = controller;

  const currencyLabel = t("common.currency", "PLN");

  const figures: Figure[] = [
    {
      key: "cast",
      label: t("projects.budget.kpi.cast_fees", "Obsada"),
      value: formatAmount(kpi.castTotal),
      unit: currencyLabel,
      tone: "default",
    },
    {
      key: "crew",
      label: t("projects.budget.kpi.crew_fees", "Ekipa"),
      value: formatAmount(kpi.crewTotal),
      unit: currencyLabel,
      tone: "default",
    },
    // Settlement is the dimension this tab used to hide entirely: it offered an
    // editable field on a fee that had already been paid out. Both figures stay
    // off the rail until money has actually moved — before that "0 rozliczone"
    // is the resting case, and the total already answers what is owed.
    ...(kpi.settledTotal > 0
      ? [
          {
            key: "settled",
            label: t("projects.budget.kpi.settled", "Rozliczone"),
            value: formatAmount(kpi.settledTotal),
            unit: currencyLabel,
            tone: "sage" as const,
          },
          {
            key: "outstanding",
            label: t("projects.budget.kpi.outstanding", "Do wypłaty"),
            value: formatAmount(kpi.outstandingTotal),
            unit: currencyLabel,
            tone: "default" as const,
          },
        ]
      : []),
    ...(kpi.missingCount > 0
      ? [
          {
            key: "missing",
            label: t("projects.budget.kpi.missing", "Bez stawki"),
            value: String(kpi.missingCount),
            unit: t("common.people_short", "os."),
            tone: "gold" as const,
          },
        ]
      : []),
  ];

  if (isLoading) {
    return (
      <TabLoadingCard
        icon={<Wallet size={15} aria-hidden="true" />}
        title={t("projects.budget.sections.summary", "Koszty osobowe")}
      />
    );
  }

  return (
    <>
      <div className="w-full space-y-5 pb-24">
        {/* ── What the concert costs ────────────────────────────────────────── */}
        <SectionCard
          as="h2"
          icon={<Wallet size={15} aria-hidden="true" />}
          title={t("projects.budget.sections.summary", "Koszty osobowe")}
          bodyClassName="gap-5"
        >
          {/* The headline never changes meaning under the reader: it is always
              what the concert costs. What qualifies it — how much is already
              paid, how much is still unpriced — rides the rail below, in the
              same grammar the Program footer and the Partytura hero use. */}
          <div className="flex flex-col gap-1">
            <Eyebrow color="muted">
              {t("projects.budget.kpi.total", "Suma kosztów")}
            </Eyebrow>
            <span className="flex items-baseline gap-2">
              <Metric>{formatAmount(kpi.grandTotal)}</Metric>
              <Unit>{currencyLabel}</Unit>
            </span>
          </div>

          <div className="border-t border-hairline pt-4">
            <SummaryFigures figures={figures} />
          </div>
        </SectionCard>

        {/* ── The ledgers ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          <LedgerCard
            section={cast}
            title={t("projects.budget.sections.cast", "Obsada wokalna")}
            icon={<Users size={15} aria-hidden="true" />}
            emptyTitle={t("projects.budget.empty.cast", "Brak obsady")}
            emptyDescription={t(
              "projects.budget.empty.cast_desc",
              "Honoraria pojawią się tutaj, gdy dodasz śpiewaków w zakładce Obsada.",
            )}
            currencyLabel={currencyLabel}
            controller={controller}
          />

          <LedgerCard
            section={crew}
            title={t("projects.budget.sections.crew", "Ekipa techniczna")}
            icon={<Wrench size={15} aria-hidden="true" />}
            emptyTitle={t("projects.budget.empty.crew", "Brak ekipy")}
            emptyDescription={t(
              "projects.budget.empty.crew_desc",
              "Stawki współpracowników pojawią się tutaj, gdy zatrudnisz ich w zakładce Zespół.",
            )}
            currencyLabel={currencyLabel}
            controller={controller}
          />
        </div>
      </div>

      <EditorActionBar
        isOpen={isDirty}
        description={t(
          "projects.budget.fab.description",
          "Zmiany w stawkach honorariów.",
        )}
        onCancel={handleReset}
        onConfirm={() => void handleBulkSave()}
        isLoading={isSaving}
      />
    </>
  );
};
