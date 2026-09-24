/**
 * @file ExportsPage.tsx
 * @description Eksporty — everything finance hands to someone outside the
 * panel, in one place. Księga dla biura is the foundation-wide ledger for a date
 * range. Dokumenty projektu are one project's papers — the board's and the
 * patron's reports, the grantor's settlement files, the office's ledger and the
 * contracts — picked by project (`?project=`, so the choice survives a reload
 * and can be linked to) and drawn by the same cards the project's budget uses.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/ExportsPage
 */

import React from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet, FolderKanban } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { useProjectBudget } from "../api/finance.queries";
import { DocumentsCard } from "../budget/components/DocumentsCard";
import { GrantorCard } from "../budget/components/GrantorCard";
import { ReportsCard } from "../budget/components/ReportsCard";
import { BudgetLoadError } from "../components/BudgetLoadError";
import { OfficeExport } from "./components/OfficeExport";
import { useFinanceOutlet } from "./financeOutlet";

const PROJECT_PARAM = "project";

interface ProjectDocumentsProps {
  readonly projectId: string;
}

function ProjectDocuments({ projectId }: ProjectDocumentsProps): React.JSX.Element {
  const query = useProjectBudget(projectId);
  const budget = query.data;

  if (query.isLoading) return <EtherealLoader fullHeight={false} />;
  if (!budget) return <BudgetLoadError onRetry={() => void query.refetch()} />;

  const contractCount = budget.ledger.filter((row) => row.contract !== null).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
      <ReportsCard projectId={projectId} budget={budget} />
      <GrantorCard projectId={projectId} budget={budget} />
      <DocumentsCard projectId={projectId} contractCount={contractCount} />
    </div>
  );
}

export default function ExportsPage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const { overview } = useFinanceOutlet();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get(PROJECT_PARAM) ?? "";

  const projectOptions: SelectOption[] = overview.projects.map(({ project }) => ({
    value: project.id,
    label: `${project.title} · ${formatLocalizedDate(
      project.date_time,
      { day: "numeric", month: "short", year: "numeric" },
      i18n.language,
      project.timezone,
    )}`,
  }));

  const selectProject = (value: string): void => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(PROJECT_PARAM, value);
        else next.delete(PROJECT_PARAM);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <PageTransition>
      <div className="flex flex-col gap-5 pb-24">
        <SectionCard
          as="h2"
          icon={<FileSpreadsheet size={15} aria-hidden="true" />}
          title={t("finance.workspace.exports.office_title", "Księga dla biura")}
        >
          <OfficeExport />
        </SectionCard>

        <SectionCard
          as="h2"
          icon={<FolderKanban size={15} aria-hidden="true" />}
          title={t("finance.workspace.exports.project_title", "Dokumenty projektu")}
        >
          <div className="flex flex-col gap-4">
            <Select
              label={t("finance.workspace.exports.project_label", "Projekt")}
              placeholder={t("finance.workspace.exports.project_placeholder", "Wybierz projekt")}
              options={projectOptions}
              value={projectId}
              onValueChange={selectProject}
              className="max-w-xl"
            />
            {!projectId && (
              <StatePanel
                variant="inline"
                icon={<FolderKanban size={22} strokeWidth={1.5} />}
                title={t(
                  "finance.workspace.exports.project_empty",
                  "Wybierz projekt, żeby pobrać jego raporty, pliki do rozliczenia z grantodawcą i umowy.",
                )}
              />
            )}
          </div>
        </SectionCard>

        {projectId && <ProjectDocuments key={projectId} projectId={projectId} />}
      </div>
    </PageTransition>
  );
}
