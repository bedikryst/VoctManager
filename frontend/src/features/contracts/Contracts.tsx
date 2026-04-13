/**
 * @file Contracts.tsx
 * @description Master view for the HR & Payroll Module.
 * Integrates contextual state hooks, localized components, and the core UI kit.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/Contracts
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Calculator,
  Wallet,
  FileSignature,
  Users,
  Wrench,
  Sparkles,
  Receipt,
  Loader2,
  ChevronDown,
} from "lucide-react";

import { downloadFile } from "@/shared/lib/io/downloadFile";
import { useContractsData } from "./hooks/useContractsData";
import { useBulkUpdateFee } from "./api/contracts.queries";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Input } from "@/shared/ui/primitives/Input";
import { Button } from "@/shared/ui/primitives/Button";
import { ExportContractButton } from "@/shared/widgets/domain/ExportContractButton";
import { ContractRow } from "./components/ContractRow";

export default function Contracts(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    currentCast,
    currentCrew,
    globalStats,
    projectStats,
  } = useContractsData();

  const [globalFee, setGlobalFee] = useState<string>("");
  const bulkUpdateMutation = useBulkUpdateFee();

  const handleApplyGlobalFee = async (): Promise<void> => {
    if (!globalFee) return;
    const toastId = toast.loading(
      t("contracts.toast.bulk_applying", "Aplikowanie masowych stawek..."),
    );

    try {
      const res = await bulkUpdateMutation.mutateAsync({
        projectId: selectedProjectId,
        fee: parseFloat(globalFee),
      });
      toast.success(
        t(
          "contracts.toast.bulk_success",
          "Pomyślnie zaktualizowano stawki dla {{count}} osób.",
          { count: res.updated_count },
        ),
        { id: toastId },
      );
      setGlobalFee("");
    } catch (e) {
      toast.error(
        t(
          "contracts.toast.bulk_error",
          "Błąd serwera podczas operacji masowej.",
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
      t("contracts.toast.pdf_generating", "Generowanie PDF dla {{name}}...", {
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
        `Contract_${personName.replace(/ /g, "_")}.pdf`,
      );
      toast.success(
        t(
          "contracts.toast.pdf_success",
          "Dokument został pomyślnie wygenerowany.",
        ),
        { id: toastId },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(
        t("contracts.toast.pdf_error", "Błąd generowania: {{message}}", {
          message,
        }),
        { id: toastId },
      );
    }
  };

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 size={32} className="animate-spin text-brand/40" />
        <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-brand/60">
          {t("contracts.dashboard.loading", "Wczytywanie rejestrów...")}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24 max-w-7xl mx-auto cursor-default px-4 sm:px-6 lg:px-8">
      <header className="relative pt-8 mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
            <Wallet size={12} className="text-brand" aria-hidden="true" />
            <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-brand/80">
              {t("contracts.dashboard.subtitle", "Zarządzanie Finansami")}
            </p>
          </div>
          <h1
            className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            {t("contracts.dashboard.title", "Kadry i")}{" "}
            <span className="italic text-brand font-bold">
              {t("contracts.dashboard.title_highlight", "Płace")}
            </span>
            .
          </h1>
          <p className="text-stone-500 mt-3 font-medium tracking-wide text-sm max-w-xl">
            {t(
              "contracts.dashboard.description",
              "Zarządzaj wynagrodzeniami artystów i ekipy, kontroluj budżety produkcyjne oraz generuj umowy PDF.",
            )}
          </p>
        </motion.div>
      </header>

      <GlassCard
        variant="dark"
        className="flex flex-col md:flex-row md:items-center gap-6"
      >
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-brand rounded-full blur-[100px] opacity-40 pointer-events-none group-hover:opacity-60 transition-opacity duration-1000"></div>
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        ></div>

        <div className="relative z-10 w-full flex flex-col sm:flex-row gap-5 items-center">
          <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-blue-300">
            <Receipt size={24} aria-hidden="true" />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400 mb-2 ml-1">
              {t(
                "contracts.dashboard.select_event_label",
                "Wybierz Wydarzenie (Kontekst Rozliczeniowy)",
              )}
            </label>
            <div className="relative">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-5 py-4 text-sm text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold appearance-none cursor-pointer hover:bg-white/10"
              >
                <option value="" className="text-stone-900">
                  {t(
                    "contracts.dashboard.no_event_selected",
                    "— Nie wybrano wydarzenia —",
                  )}
                </option>
                {projects
                  .filter((p) => p.status !== "CANC")
                  .map((p) => (
                    <option key={p.id} value={p.id} className="text-stone-900">
                      {p.title}{" "}
                      {p.status === "DONE"
                        ? t("contracts.dashboard.archived", "(Zarchiwizowane)")
                        : ""}
                    </option>
                  ))}
              </select>
              <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-stone-400">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {!selectedProjectId && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4"
        >
          <GlassCard
            variant="solid"
            className="lg:col-span-2 flex flex-col justify-center items-start"
          >
            <div className="absolute -right-12 -top-12 text-stone-200 opacity-20 pointer-events-none">
              <Receipt size={250} strokeWidth={1} aria-hidden="true" />
            </div>
            <Wallet
              size={40}
              className="text-brand mb-5 relative z-10"
              aria-hidden="true"
            />
            <h2
              className="text-2xl font-bold text-stone-800 tracking-tight mb-2 relative z-10"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              {t(
                "contracts.dashboard.empty_state_title",
                "Gotowe do rozliczeń",
              )}
            </h2>
            <p className="text-sm text-stone-500 max-w-md leading-relaxed relative z-10">
              {t(
                "contracts.dashboard.empty_state_desc",
                "Wybierz wydarzenie z przełącznika kontekstu powyżej, aby zarządzać stawkami i kontrolować budżet produkcji.",
              )}
            </p>
          </GlassCard>

          <GlassCard
            variant="solid"
            className="flex flex-col justify-between bg-gradient-to-b from-stone-50/50 to-white/30"
          >
            <div>
              <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">
                {t(
                  "contracts.dashboard.global_budget",
                  "Globalny Budżet Systemowy",
                )}
              </p>
              <p className="text-3xl font-black text-stone-800 tracking-tight">
                {globalStats.totalBudget.toLocaleString("en-US")} PLN
              </p>
            </div>
            <div className="pt-6 border-t border-stone-200/60 mt-6">
              <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">
                {t("contracts.dashboard.contracts_issued", "Wystawione Umowy")}
              </p>
              <p className="text-xl font-bold text-stone-700">
                {globalStats.totalPriced}{" "}
                <span className="text-sm font-medium text-stone-400">
                  / {globalStats.totalContracts}{" "}
                  {t("contracts.dashboard.valued", "wycenionych")}
                </span>
              </p>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {selectedProjectId && projectStats.totalContracts > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 relative z-10"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <GlassCard
              variant="solid"
              className="flex flex-col justify-center items-center hover:-translate-y-0.5"
            >
              <div className="absolute -right-4 -bottom-4 text-emerald-900 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                <FileSignature size={100} aria-hidden="true" />
              </div>
              <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 relative z-10">
                {t("contracts.dashboard.priced_contracts", "Wycenione Umowy")}
              </p>
              <p className="text-3xl font-black text-stone-800 tracking-tight relative z-10">
                {projectStats.pricedContractsCount}{" "}
                <span className="text-base font-bold text-stone-400">
                  / {projectStats.totalContracts}
                </span>
              </p>
            </GlassCard>

            <GlassCard
              variant={
                projectStats.missingContractsCount > 0 ? "outline" : "solid"
              }
              className="flex flex-col justify-center items-center"
            >
              <div
                className={`absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none ${projectStats.missingContractsCount > 0 ? "text-orange-900" : "text-stone-900"}`}
              >
                <Calculator size={100} aria-hidden="true" />
              </div>
              <p
                className={`text-[9px] font-bold antialiased uppercase tracking-widest mb-2 relative z-10 ${projectStats.missingContractsCount > 0 ? "text-orange-600" : "text-stone-400"}`}
              >
                {t(
                  "contracts.dashboard.missing_appraisals",
                  "Brakujące Wyceny",
                )}
              </p>
              <p
                className={`text-3xl font-black tracking-tight relative z-10 ${projectStats.missingContractsCount > 0 ? "text-orange-600" : "text-stone-800"}`}
              >
                {projectStats.missingContractsCount}
              </p>
            </GlassCard>

            <GlassCard
              variant="dark"
              className="flex flex-col justify-center items-center hover:-translate-y-0.5"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 group-hover:scale-125 transition-transform duration-700"></div>
              <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-300 mb-2 relative z-10 flex items-center gap-1.5">
                <Sparkles size={12} aria-hidden="true" />{" "}
                {t("contracts.dashboard.personnel_budget", "Budżet Osobowy")}
              </p>
              <p className="text-3xl font-bold tracking-tight relative z-10">
                {projectStats.totalBudget.toLocaleString("en-US")} PLN
              </p>
            </GlassCard>
          </div>

          <GlassCard
            variant="solid"
            className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
          >
            <div className="w-full lg:flex-1">
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 ml-1">
                {t(
                  "contracts.dashboard.mass_fee_injection",
                  "Masowe Wprowadzenie Stawek (Tylko Chór)",
                )}
              </label>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full">
                <Input
                  type="number"
                  value={globalFee}
                  onChange={(e) => setGlobalFee(e.target.value)}
                  placeholder={t(
                    "contracts.dashboard.value_placeholder",
                    "Wartość...",
                  )}
                  rightElement="PLN"
                  className="font-mono sm:max-w-[200px]"
                />
                <Button
                  variant="primary"
                  onClick={handleApplyGlobalFee}
                  disabled={bulkUpdateMutation.isPending || !globalFee}
                  isLoading={bulkUpdateMutation.isPending}
                  leftIcon={
                    !bulkUpdateMutation.isPending ? (
                      <Calculator size={14} />
                    ) : undefined
                  }
                  className="w-full sm:w-auto"
                >
                  {t("contracts.dashboard.apply_valuation", "Zastosuj Wycenę")}
                </Button>
              </div>
            </div>
            <div className="w-full lg:w-auto border-t lg:border-t-0 border-stone-200/60 pt-5 lg:pt-0">
              <ExportContractButton projectId={selectedProjectId} />
            </div>
          </GlassCard>

          {currentCast.length > 0 && (
            <GlassCard variant="solid" className="overflow-hidden">
              <div className="p-5 bg-stone-50/50 border-b border-stone-200/60 flex items-center gap-2.5 relative z-10">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                  <Users size={14} className="text-brand" aria-hidden="true" />
                </div>
                <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-700">
                  {t(
                    "contracts.dashboard.vocal_cast",
                    "Obsada Wokalna (Chór / Soliści)",
                  )}
                </h3>
              </div>
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left text-sm text-stone-600">
                  <thead className="bg-stone-50/30 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-widest text-stone-400 border-b border-stone-200/50">
                    <tr>
                      <th className="px-6 py-4">
                        {t("contracts.table.performer", "Wykonawca")}
                      </th>
                      <th className="px-6 py-4 hidden sm:table-cell">
                        {t("contracts.table.voice", "Głos")}
                      </th>
                      <th className="px-6 py-4 hidden md:table-cell">
                        {t("contracts.table.status", "Status")}
                      </th>
                      <th className="px-6 py-4 w-64 text-right">
                        {t("contracts.table.gross_amount", "Kwota Brutto")}
                      </th>
                      <th className="px-6 py-4 text-right w-32">
                        {t("contracts.table.documents", "Dokumenty")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100/50">
                    {currentCast.map((participation) => (
                      <ContractRow
                        key={`cast-${participation.id}`}
                        record={participation}
                        type="CAST"
                        onDownload={handleDownloadSingle}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {currentCrew.length > 0 && (
            <GlassCard variant="solid" className="overflow-hidden">
              <div className="p-5 bg-stone-50/50 border-b border-stone-200/60 flex items-center gap-2.5 relative z-10">
                <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm">
                  <Wrench
                    size={14}
                    className="text-stone-600"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-700">
                  {t(
                    "contracts.dashboard.tech_crew",
                    "Ekipa Techniczna i Logistyka",
                  )}
                </h3>
              </div>
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left text-sm text-stone-600">
                  <thead className="bg-stone-50/30 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-widest text-stone-400 border-b border-stone-200/50">
                    <tr>
                      <th className="px-6 py-4">
                        {t("contracts.table.contractor", "Kontrahent / Firma")}
                      </th>
                      <th className="px-6 py-4 hidden sm:table-cell">
                        {t("contracts.table.role", "Rola")}
                      </th>
                      <th className="px-6 py-4 hidden md:table-cell">
                        {t("contracts.table.status", "Status")}
                      </th>
                      <th className="px-6 py-4 w-64 text-right">
                        {t("contracts.table.gross_amount", "Kwota Brutto")}
                      </th>
                      <th className="px-6 py-4 text-right w-32">
                        {t("contracts.table.documents", "Dokumenty")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100/50">
                    {currentCrew.map((assignment) => (
                      <ContractRow
                        key={`crew-${assignment.id}`}
                        record={assignment}
                        type="CREW"
                        onDownload={handleDownloadSingle}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </motion.div>
      )}

      {selectedProjectId && projectStats.totalContracts === 0 && (
        <GlassCard
          variant="solid"
          className="flex flex-col items-center justify-center text-center mt-8"
        >
          <Users
            size={48}
            className="mx-auto mb-4 text-stone-300 opacity-50"
            aria-hidden="true"
          />
          <p className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">
            {t(
              "contracts.dashboard.no_personnel_title",
              "Brak przypisanego personelu",
            )}
          </p>
          <p className="text-xs text-stone-400 max-w-sm">
            {t(
              "contracts.dashboard.no_personnel_desc",
              'Przejdź do zakładki "Zarządzanie Projektami", aby zatrudnić obsadę lub ekipę na to wydarzenie.',
            )}
          </p>
        </GlassCard>
      )}
    </div>
  );
}
