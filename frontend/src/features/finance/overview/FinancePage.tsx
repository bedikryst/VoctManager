/**
 * @file FinancePage.tsx
 * @description Finanse — the portfolio: each project's money in one row, and
 * what the foundation still owes across all of them. Every figure is the
 * server's rollup; a project's ledger lives in its own hub, and this page only
 * opens it. Cancelled projects stay listed, because a cancellation has costs.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/overview/FinancePage
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { useFinanceOverview } from "../api/finance.queries";
import { PayablesCard } from "./components/PayablesCard";
import { ProjectRollups } from "./components/ProjectRollups";

export default function FinancePage(): React.JSX.Element {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const overview = useFinanceOverview(offset);
  const data = overview.data;

  const header = (
    <PageHeader
      size="standard"
      roleText={t("finance.portfolio.role", "Fundacja")}
      title={t("finance.portfolio.title", "Finanse")}
    />
  );

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 pb-24 pt-6">
        {header}

        {overview.isLoading ? (
          <EtherealLoader
            message={t("finance.portfolio.loading", "Wczytuję rozliczenia…")}
          />
        ) : !data ? (
          <StatePanel
            tone="danger"
            icon={<AlertTriangle size={28} strokeWidth={1.5} />}
            title={t("finance.load_error.title", "Nie udało się wczytać budżetu.")}
            description={t(
              "finance.load_error.description",
              "Serwer nie odpowiedział. Spróbuj ponownie za chwilę.",
            )}
            actions={
              <Button
                variant="secondary"
                onClick={() => void overview.refetch()}
                leftIcon={<RefreshCw size={14} aria-hidden="true" />}
              >
                {t("common.actions.retry", "Ponów")}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start">
            <ProjectRollups rollups={data.projects} />
            <PayablesCard
              page={data.payables}
              isFetching={overview.isFetching}
              onPageChange={setOffset}
            />
          </div>
        )}
      </div>
    </PageTransition>
  );
}
