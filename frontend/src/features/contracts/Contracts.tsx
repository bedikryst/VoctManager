/**
 * @file Contracts.tsx
 * @description Contracts and payroll dashboard for project settlements.
 * Uses a modular page shell with responsive ledger sections and shared Ethereal UI primitives.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/Contracts
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Users, Wrench } from "lucide-react";

import { downloadFile } from "@/shared/lib/io/downloadFile";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { useBulkUpdateFee } from "./api/contracts.queries";
import { ContractsActionPanel } from "./components/ContractsActionPanel";
import { ContractsEmptyState } from "./components/ContractsEmptyState";
import { ContractsHeroPanel } from "./components/ContractsHeroPanel";
import { ContractsLedgerSection } from "./components/ContractsLedgerSection";
import { ContractsMetricsGrid } from "./components/ContractsMetricsGrid";
import { useContractsData } from "./hooks/useContractsData";
import {
  formatContractCurrency,
  parseFeeValue,
} from "./lib/contractsPresentation";

export default function Contracts(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    isFetching,
    isError,
    refresh,
    hasAnyLedgerData,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    currentCast,
    currentCrew,
    globalStats,
    projectStats,
  } = useContractsData();

  const [globalFee, setGlobalFee] = useState<string>("");
  const bulkUpdateMutation = useBulkUpdateFee();

  useEffect(() => {
    setGlobalFee("");
  }, [selectedProjectId]);

  const handleApplyGlobalFee = async (): Promise<void> => {
    const parsedFee = parseFeeValue(globalFee);

    if (!selectedProjectId || parsedFee == null) {
      return;
    }

    const toastId = toast.loading(
      t("contracts.toast.bulk_applying", "Applying bulk remuneration..."),
    );

    try {
      const response = await bulkUpdateMutation.mutateAsync({
        projectId: selectedProjectId,
        fee: parsedFee,
      });

      toast.success(
        t(
          "contracts.toast.bulk_success",
          "Updated remuneration values for {{count}} records.",
          { count: response.updated_count },
        ),
        { id: toastId },
      );

      setGlobalFee("");
    } catch {
      toast.error(
        t(
          "contracts.toast.bulk_error",
          "The bulk valuation request could not be completed.",
        ),
        { id: toastId },
      );
    }
  };

  const handleDownloadSingle = async (
    recordId: string | number,
    personName: string,
    type: "CAST" | "CREW",
  ): Promise<void> => {
    const toastId = toast.loading(
      t("contracts.toast.pdf_generating", "Generating PDF for {{name}}...", {
        name: personName,
      }),
    );

    try {
      const endpoint =
        type === "CAST"
          ? `/api/participations/${recordId}/contract/`
          : `/api/crew-assignments/${recordId}/contract/`;

      await downloadFile(
        endpoint,
        `Contract_${personName.replace(/\s+/g, "_")}.pdf`,
      );

      toast.success(
        t(
          "contracts.toast.pdf_success",
          "The contract PDF is ready for download.",
        ),
        { id: toastId },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      toast.error(
        t("contracts.toast.pdf_error", "PDF generation failed: {{message}}", {
          message,
        }),
        { id: toastId },
      );
    }
  };

  const handleRefresh = async (): Promise<void> => {
    await refresh();
  };

  const headerActions = (
    <div className="flex items-center gap-3">
      {isFetching && !isLoading && (
        <Badge variant="glass">
          {t("contracts.header.syncing", "Synchronizing")}
        </Badge>
      )}
      <Button
        variant="secondary"
        onClick={() => void handleRefresh()}
        isLoading={isFetching}
        leftIcon={<RefreshCw size={14} aria-hidden="true" />}
      >
        {t("contracts.header.refresh", "Refresh data")}
      </Button>
    </div>
  );

  const warningBanner =
    isError && hasAnyLedgerData ? (
      <GlassCard variant="outline" padding="md" isHoverable={false}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="rounded-full border border-ethereal-gold/30 bg-ethereal-gold/10 p-2 text-ethereal-gold"
              aria-hidden="true"
            >
              <AlertTriangle size={16} />
            </div>
            <div className="space-y-1">
              <Text size="sm" weight="bold">
                {t("contracts.warning.title", "Some ledger data is out of sync.")}
              </Text>
              <Text size="xs" color="graphite">
                {t(
                  "contracts.warning.description",
                  "The dashboard is still usable, but one or more data sources failed to refresh. Run a manual sync to reconcile the latest project, cast, and crew records.",
                )}
              </Text>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => void handleRefresh()}
            isLoading={isFetching}
            leftIcon={<RefreshCw size={14} aria-hidden="true" />}
          >
            {t("contracts.warning.action", "Retry sync")}
          </Button>
        </div>
      </GlassCard>
    ) : null;

  if (isLoading && !hasAnyLedgerData) {
    return (
      <PageTransition>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 sm:px-0">
          <PageHeader
            size="standard"
            roleText={t("contracts.header.badge", "Finance operations")}
            title={t("contracts.header.title", "Contracts and")}
            titleHighlight={t("contracts.header.title_highlight", "Payroll")}
          />
          <EtherealLoader
            message={t(
              "contracts.loader.message",
              "Loading settlement ledgers...",
            )}
          />
        </div>
      </PageTransition>
    );
  }

  if (isError && !hasAnyLedgerData) {
    return (
      <PageTransition>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 sm:px-0">
          <PageHeader
            size="standard"
            roleText={t("contracts.header.badge", "Finance operations")}
            title={t("contracts.header.title", "Contracts and")}
            titleHighlight={t("contracts.header.title_highlight", "Payroll")}
            rightContent={headerActions}
          />

          <div className="md:hidden">{headerActions}</div>

          <StatePanel
            tone="danger"
            icon={<AlertTriangle size={28} strokeWidth={1.5} />}
            eyebrow={t("contracts.error.eyebrow", "Ledger unavailable")}
            title={t(
              "contracts.error.title",
              "The settlement workspace could not be loaded.",
            )}
            description={t(
              "contracts.error.description",
              "Project, cast, or crew data did not arrive from the API. Retry synchronization to restore the contracts dashboard.",
            )}
            actions={
              <Button
                variant="destructive"
                onClick={() => void handleRefresh()}
                isLoading={isFetching}
                leftIcon={<RefreshCw size={14} aria-hidden="true" />}
              >
                {t("contracts.error.action", "Retry synchronization")}
              </Button>
            }
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 sm:px-0">
        <PageHeader
          size="standard"
          roleText={t("contracts.header.badge", "Finance operations")}
          title={t("contracts.header.title", "Contracts and")}
          titleHighlight={t("contracts.header.title_highlight", "Payroll")}
          rightContent={headerActions}
        />

        <div className="md:hidden">{headerActions}</div>

        {warningBanner}

        <ContractsHeroPanel
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedProject={selectedProject}
          totalProjects={globalStats.totalProjects}
          globalCompletionRate={globalStats.completionRate}
          globalBudget={globalStats.totalBudget}
          activeProjectsCount={globalStats.activeProjectsCount}
          draftProjectsCount={globalStats.draftProjectsCount}
          projectBudget={projectStats.totalBudget}
          projectContractCount={projectStats.totalContracts}
          projectCompletionRate={projectStats.completionRate}
          castCount={projectStats.castCount}
          crewCount={projectStats.crewCount}
          onProjectChange={setSelectedProjectId}
        />

        <ContractsMetricsGrid
          isProjectSelected={Boolean(selectedProjectId)}
          globalBudget={formatContractCurrency(globalStats.totalBudget)}
          globalCompletionRate={globalStats.completionRate}
          liveProjectsCount={
            globalStats.activeProjectsCount + globalStats.draftProjectsCount
          }
          archivedProjectsCount={globalStats.archivedProjectsCount}
          projectBudget={formatContractCurrency(projectStats.totalBudget)}
          projectPricedContracts={projectStats.pricedContractsCount}
          projectTotalContracts={projectStats.totalContracts}
          projectMissingContracts={projectStats.missingContractsCount}
          castCount={projectStats.castCount}
          crewCount={projectStats.crewCount}
        />

        {!selectedProjectId && <ContractsEmptyState mode="idle" />}

        {selectedProjectId && projectStats.totalContracts > 0 && (
          <>
            <ContractsActionPanel
              projectId={selectedProjectId}
              globalFee={globalFee}
              currentCastCount={currentCast.length}
              missingContractsCount={projectStats.missingContractsCount}
              isBulkUpdating={bulkUpdateMutation.isPending}
              onGlobalFeeChange={setGlobalFee}
              onApplyGlobalFee={handleApplyGlobalFee}
            />

            {currentCast.length > 0 && (
              <ContractsLedgerSection
                title={t("contracts.sections.cast_title", "Cast ledger")}
                description={t(
                  "contracts.sections.cast_description",
                  "Manage vocal remuneration, track valuation coverage, and generate individual contract PDFs for the artistic roster.",
                )}
                icon={<Users size={14} aria-hidden="true" />}
                type="CAST"
                records={currentCast}
                onDownload={handleDownloadSingle}
              />
            )}

            {currentCrew.length > 0 && (
              <ContractsLedgerSection
                title={t("contracts.sections.crew_title", "Crew ledger")}
                description={t(
                  "contracts.sections.crew_description",
                  "Keep technical and logistics contracts aligned with the same remuneration and export workflow.",
                )}
                icon={<Wrench size={14} aria-hidden="true" />}
                type="CREW"
                records={currentCrew}
                onDownload={handleDownloadSingle}
              />
            )}
          </>
        )}

        {selectedProjectId && projectStats.totalContracts === 0 && (
          <ContractsEmptyState mode="no-personnel" />
        )}
      </div>
    </PageTransition>
  );
}
