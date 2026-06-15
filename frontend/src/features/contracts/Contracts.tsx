/**
 * @file Contracts.tsx
 * @description Settlements cockpit ("Centrum Rozliczeń"). A two-column command
 * console: a sticky left rail (scope-aware money summary + project switcher) and a
 * right protagonist that is either the cross-project payables feed (portfolio) or a
 * single project's editable ledger. Fees, payment state and contract PDFs/ZIP are
 * all driven from here.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/Contracts
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Users, Wrench } from "lucide-react";

import { downloadFile } from "@/shared/lib/io/downloadFile";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";

import type { ContractRecordType } from "./api/contracts.service";
import { useBulkUpdateFee, useMarkRecordsPaid } from "./api/contracts.queries";
import { ContractLedger } from "./components/ContractLedger";
import { ContractsEmptyState } from "./components/ContractsEmptyState";
import { LedgerHeader } from "./components/LedgerHeader";
import { PayablesBoard } from "./components/PayablesBoard";
import { ProjectLedgerRail } from "./components/ProjectLedgerRail";
import { SettlementSummary } from "./components/SettlementSummary";
import { useContractsData } from "./hooks/useContractsData";
import { buildSettlementCsv, downloadCsv } from "./lib/contractsCsv";
import {
  getSettlementState,
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
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    scope,
    ledgerFilter,
    setLedgerFilter,
    globalStats,
    projectStats,
    projectRollups,
    payables,
    allEntries,
    projectCast,
    projectCrew,
    visibleCast,
    visibleCrew,
    activeSummary,
  } = useContractsData();

  const [globalFee, setGlobalFee] = useState("");
  const [bulkTarget, setBulkTarget] = useState<ContractRecordType>("CAST");
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const bulkUpdate = useBulkUpdateFee();
  const markPaid = useMarkRecordsPaid();

  useEffect(() => {
    setGlobalFee("");
    setBulkTarget("CAST");
  }, [selectedProjectId]);

  const handleRefresh = async (): Promise<void> => {
    await refresh();
  };

  const handleApplyGlobalFee = async (): Promise<void> => {
    const parsed = parseFeeValue(globalFee);
    if (!selectedProjectId || parsed == null || parsed < 0) {
      return;
    }
    const toastId = toast.loading(
      t("contracts.toast.bulk_applying", "Ustawiam wspólną stawkę…"),
    );
    try {
      const response = await bulkUpdate.mutateAsync({
        projectId: selectedProjectId,
        fee: parsed,
        target: bulkTarget,
      });
      toast.success(
        t("contracts.toast.bulk_success", "Zaktualizowano {{count}} honorariów.", {
          count: response.updated_count,
        }),
        { id: toastId },
      );
      setGlobalFee("");
    } catch {
      toast.error(
        t("contracts.toast.bulk_error", "Nie udało się ustawić zbiorczej stawki."),
        { id: toastId },
      );
    }
  };

  const handleExportCsv = (): void => {
    if (allEntries.length === 0) {
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `Rozliczenia_VoctManager_${today}.csv`,
      buildSettlementCsv(allEntries, t),
    );
    toast.success(t("contracts.csv.done", "Wyeksportowano listę rozliczeń."));
  };

  const handleConfirmMarkAllPaid = async (): Promise<void> => {
    const targets = [
      ...projectCast
        .filter((record) => getSettlementState(record, "CAST") === "unpaid")
        .map((record) => ({ id: String(record.id), type: "CAST" as const })),
      ...projectCrew
        .filter((record) => getSettlementState(record, "CREW") === "unpaid")
        .map((record) => ({ id: String(record.id), type: "CREW" as const })),
    ];
    if (targets.length === 0) {
      setConfirmPaidOpen(false);
      return;
    }
    const toastId = toast.loading(
      t("contracts.mark_all.applying", "Oznaczam honoraria jako zapłacone…"),
    );
    try {
      const result = await markPaid.mutateAsync(targets);
      if (result.failed > 0) {
        toast.warning(
          t(
            "contracts.mark_all.partial",
            "Oznaczono {{ok}} z {{total}} — {{failed}} nie powiodło się.",
            {
              ok: result.total - result.failed,
              total: result.total,
              failed: result.failed,
            },
          ),
          { id: toastId },
        );
      } else {
        toast.success(
          t("contracts.mark_all.done", "Oznaczono {{count}} honorariów jako zapłacone.", {
            count: result.total,
          }),
          { id: toastId },
        );
      }
    } catch {
      toast.error(
        t("contracts.toast.payment_error", "Nie udało się zmienić statusu płatności."),
        { id: toastId },
      );
    } finally {
      setConfirmPaidOpen(false);
    }
  };

  const handleDownloadSingle = async (
    recordId: string,
    personName: string,
    type: ContractRecordType,
  ): Promise<void> => {
    const toastId = toast.loading(
      t("contracts.toast.pdf_generating", "Generuję umowę dla {{name}}…", {
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
        `Umowa_${personName.replace(/\s+/g, "_")}.pdf`,
      );
      toast.success(t("contracts.toast.pdf_success", "Umowa PDF gotowa."), {
        id: toastId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        t("contracts.toast.pdf_error", "Nie udało się wygenerować PDF: {{message}}", {
          message,
        }),
        { id: toastId },
      );
    }
  };

  const headerActions = (
    <div className="flex items-center gap-3">
      {isFetching && !isLoading && (
        <Badge variant="glass">{t("contracts.header.syncing", "Synchronizacja")}</Badge>
      )}
      <Button
        variant="secondary"
        onClick={() => void handleRefresh()}
        isLoading={isFetching}
        leftIcon={<RefreshCw size={14} aria-hidden="true" />}
      >
        {t("contracts.header.refresh", "Odśwież")}
      </Button>
    </div>
  );

  const pageHeader = (
    <PageHeader
      size="standard"
      roleText={t("contracts.header.badge", "Operacje finansowe")}
      title={t("contracts.header.title", "Centrum")}
      titleHighlight={t("contracts.header.title_highlight", "Rozliczeń")}
      rightContent={headerActions}
    />
  );

  // ---- Loading / hard error gates ----------------------------------------
  if (isLoading && !hasAnyLedgerData) {
    return (
      <PageTransition>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pb-24 sm:px-0">
          {pageHeader}
          <EtherealLoader
            message={t("contracts.loader.message", "Wczytuję rejestry rozliczeń…")}
          />
        </div>
      </PageTransition>
    );
  }

  if (isError && !hasAnyLedgerData) {
    return (
      <PageTransition>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pb-24 sm:px-0">
          {pageHeader}
          <StatePanel
            tone="danger"
            icon={<AlertTriangle size={28} strokeWidth={1.5} />}
            eyebrow={t("contracts.error.eyebrow", "Brak danych")}
            title={t("contracts.error.title", "Nie udało się wczytać rozliczeń.")}
            description={t(
              "contracts.error.description",
              "Dane projektów, obsady lub ekipy nie dotarły z serwera. Spróbuj zsynchronizować ponownie.",
            )}
            actions={
              <Button
                variant="destructive"
                onClick={() => void handleRefresh()}
                isLoading={isFetching}
                leftIcon={<RefreshCw size={14} aria-hidden="true" />}
              >
                {t("contracts.error.action", "Ponów synchronizację")}
              </Button>
            }
          />
        </div>
      </PageTransition>
    );
  }

  const scopeLabel = selectedProject
    ? selectedProject.title
    : t("contracts.summary.scope_portfolio", "Całe portfolio");

  const ledgerHasRows = visibleCast.length > 0 || visibleCrew.length > 0;

  return (
    <PageTransition>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pb-24 sm:px-0">
        {pageHeader}

        {isError && hasAnyLedgerData && (
          <GlassCard variant="outline" padding="md" isHoverable={false}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="text-ethereal-gold" aria-hidden="true">
                  <AlertTriangle size={16} />
                </span>
                <div>
                  <Text size="sm" weight="bold">
                    {t("contracts.warning.title", "Część danych jest nieaktualna.")}
                  </Text>
                  <Caption color="muted">
                    {t(
                      "contracts.warning.description",
                      "Pulpit działa, ale jedno ze źródeł nie odświeżyło się. Uruchom ręczną synchronizację.",
                    )}
                  </Caption>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => void handleRefresh()}
                isLoading={isFetching}
                leftIcon={<RefreshCw size={14} aria-hidden="true" />}
              >
                {t("contracts.warning.action", "Ponów")}
              </Button>
            </div>
          </GlassCard>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Command rail */}
          <aside className="flex flex-col gap-4 lg:col-span-4 lg:sticky lg:top-6 lg:self-start xl:col-span-3">
            {activeSummary && (
              <SettlementSummary summary={activeSummary} scopeLabel={scopeLabel} />
            )}
            <ProjectLedgerRail
              rollups={projectRollups}
              selectedProjectId={selectedProjectId}
              onSelect={setSelectedProjectId}
              portfolioOutstanding={globalStats.outstanding}
              projectsWithOutstanding={globalStats.projectsWithOutstanding}
            />
          </aside>

          {/* Protagonist */}
          <main className="min-w-0 lg:col-span-8 xl:col-span-9">
            {scope === "portfolio" && (
              <PayablesBoard
                payables={payables}
                onOpenProject={setSelectedProjectId}
                onExportCsv={handleExportCsv}
                exportDisabled={allEntries.length === 0}
              />
            )}

            {scope === "project" && projectStats && (
              <div className="flex flex-col gap-6">
                <LedgerHeader
                  stats={projectStats}
                  ledgerFilter={ledgerFilter}
                  onFilterChange={setLedgerFilter}
                  globalFee={globalFee}
                  onGlobalFeeChange={setGlobalFee}
                  bulkTarget={bulkTarget}
                  onBulkTargetChange={setBulkTarget}
                  onApplyGlobalFee={() => void handleApplyGlobalFee()}
                  isBulkUpdating={bulkUpdate.isPending}
                  onMarkAllPaid={() => setConfirmPaidOpen(true)}
                  unpaidCount={projectStats.outstandingCount}
                  isMarkingPaid={markPaid.isPending}
                />

                {projectStats.totalRecords === 0 ? (
                  <ContractsEmptyState mode="no-personnel" />
                ) : ledgerHasRows ? (
                  <>
                    {visibleCast.length > 0 && (
                      <ContractLedger
                        title={t("contracts.sections.cast", "Obsada")}
                        icon={<Users size={14} aria-hidden="true" />}
                        type="CAST"
                        records={visibleCast}
                        onDownload={handleDownloadSingle}
                      />
                    )}
                    {visibleCrew.length > 0 && (
                      <ContractLedger
                        title={t("contracts.sections.crew", "Ekipa")}
                        icon={<Wrench size={14} aria-hidden="true" />}
                        type="CREW"
                        records={visibleCrew}
                        onDownload={handleDownloadSingle}
                      />
                    )}
                  </>
                ) : (
                  <GlassCard variant="solid" padding="lg" isHoverable={false}>
                    <Text color="graphite" align="center">
                      {t(
                        "contracts.ledger.empty_filter",
                        "Brak pozycji dla wybranego filtra.",
                      )}
                    </Text>
                  </GlassCard>
                )}
              </div>
            )}
          </main>
        </div>

        <ConfirmModal
          isOpen={confirmPaidOpen}
          isDestructive={false}
          title={t("contracts.mark_all.confirm_title", "Oznaczyć cały projekt jako zapłacony?")}
          description={t(
            "contracts.mark_all.confirm_desc",
            "Zostanie oznaczonych {{count}} wycenionych, niezapłaconych honorariów (obsada i ekipa). Możesz cofnąć każde pojedynczo.",
            { count: projectStats?.outstandingCount ?? 0 },
          )}
          confirmText={t("contracts.mark_all.confirm_cta", "Oznacz zapłacone")}
          onConfirm={() => void handleConfirmMarkAllPaid()}
          onCancel={() => setConfirmPaidOpen(false)}
          isLoading={markPaid.isPending}
        />
      </div>
    </PageTransition>
  );
}
