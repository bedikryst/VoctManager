/**
 * @file BudgetTab.tsx
 * @description Financial estimation and fee assignment widget.
 * Features Unified Floating Action Bar (FAB) for state commits and instant rollbacks.
 * Delegates caching and dirty-state mutation to useBudgetTab hook.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/BudgetTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Banknote,
  Users,
  Wrench,
  Sparkles,
  Save,
  AlertCircle,
} from "lucide-react";

import { useBudgetTab } from "../hooks/useBudgetTab";
import { GlassCard } from "../../../../shared/ui/GlassCard";
import { Button } from "../../../../shared/ui/Button";

interface BudgetTabProps {
  projectId: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

export default function BudgetTab({
  projectId,
  onDirtyStateChange,
}: BudgetTabProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const {
    isLoading,
    isSaving,
    isDirty,
    enrichedCast,
    enrichedCrew,
    dirtyFees,
    kpi,
    handleFeeChange,
    handleReset,
    handleBulkSave,
  } = useBudgetTab(projectId, onDirtyStateChange);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-stone-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-24 relative space-y-8">
      {/* FLOATING ACTION BAR (FAB) */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ y: 100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 100, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 md:bottom-10 left-1/2 z-[200] w-[90%] max-w-md bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_20px_40px_rgb(0,0,0,0.12)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="flex flex-col ml-2">
              <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">
                {t("projects.budget.fab.unsaved", "Niezapisane Zmiany")}
              </span>
              <span className="text-xs text-stone-500">
                {t(
                  "projects.budget.fab.description",
                  "Wprowadziłeś zmiany w stawkach.",
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isSaving}
                className="!border-transparent hover:!bg-stone-100 !text-stone-500 hover:!text-stone-800"
              >
                {t("common.actions.cancel", "Anuluj")}
              </Button>
              <Button
                variant="primary"
                onClick={handleBulkSave}
                disabled={isSaving}
                isLoading={isSaving}
                leftIcon={
                  !isSaving ? <Save size={16} aria-hidden="true" /> : undefined
                }
              >
                {t("common.actions.save", "Zapisz")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 border-b border-stone-200/60 pb-6">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm flex-shrink-0">
          <Banknote size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            {t("projects.budget.sections.estimated", "Szacowany Budżet")}
          </h2>
          <p className="text-sm text-stone-500">
            {t(
              "projects.budget.sections.description",
              "Zarządzaj kosztami osobowymi",
            )}
          </p>
        </div>
      </div>

      {/* KPI DASHBOARD */}
      <GlassCard className="p-6 md:p-8">
        <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-6 flex items-center gap-2">
          <Sparkles size={14} className="text-[#002395]" aria-hidden="true" />
          {t("projects.budget.kpi.calculation", "Kalkulacja")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
              {t("projects.budget.kpi.cast_fees", "Stawki (Obsada)")}
            </span>
            <span className="text-2xl font-bold text-stone-800 tracking-tight">
              {kpi.castTotal.toLocaleString("pl-PL")}{" "}
              <span className="text-sm text-stone-400 font-medium">
                {t("common.currency", "PLN")}
              </span>
            </span>
          </div>
          <div className="flex flex-col border-l border-stone-100 pl-6">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
              {t("projects.budget.kpi.crew_fees", "Stawki (Ekipa)")}
            </span>
            <span className="text-2xl font-bold text-stone-800 tracking-tight">
              {kpi.crewTotal.toLocaleString("pl-PL")}{" "}
              <span className="text-sm text-stone-400 font-medium">
                {t("common.currency", "PLN")}
              </span>
            </span>
          </div>
          <div className="flex flex-col border-l border-stone-100 pl-6">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 flex items-center gap-1.5">
              {t("projects.budget.kpi.missing", "Braki")}{" "}
              {kpi.missingCount > 0 && (
                <AlertCircle
                  size={12}
                  className="text-orange-500"
                  aria-hidden="true"
                />
              )}
            </span>
            <span
              className={`text-2xl font-bold tracking-tight ${kpi.missingCount > 0 ? "text-orange-600" : "text-stone-800"}`}
            >
              {kpi.missingCount}{" "}
              <span className="text-[10px] uppercase text-stone-400 font-bold tracking-widest">
                {t("projects.budget.kpi.missing_desc", "poz. bez stawki")}
              </span>
            </span>
          </div>
          <div className="flex flex-col border-l border-stone-100 pl-6 bg-emerald-50/50 -my-4 -mr-4 py-4 pr-4 rounded-r-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">
              {t("projects.budget.kpi.total", "Suma Kosztów")}
            </span>
            <span className="text-3xl font-bold text-emerald-700 tracking-tight">
              {kpi.grandTotal.toLocaleString("pl-PL")}{" "}
              <span className="text-sm text-emerald-600/70 font-medium">
                {t("common.currency", "PLN")}
              </span>
            </span>
          </div>
        </div>
      </GlassCard>

      {/* CAST SECTION */}
      {enrichedCast.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2 px-1">
            <Users size={16} className="text-[#002395]" aria-hidden="true" />
            {t("projects.budget.sections.cast", "Obsada Wykonawcza")}
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md ml-2">
              {enrichedCast.length} {t("common.people_short", "os.")}
            </span>
          </h3>
          <div className="bg-white/60 border border-stone-200/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y divide-stone-100">
              {enrichedCast.map((participation) => {
                const isItemDirty = !!dirtyFees[participation.id];
                const currentValue = dirtyFees[participation.id]
                  ? dirtyFees[participation.id].value
                  : participation.fee !== null &&
                      participation.fee !== undefined
                    ? String(participation.fee)
                    : "";

                return (
                  <div
                    key={participation.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 transition-colors ${
                      isItemDirty ? "bg-blue-50/30" : "hover:bg-stone-50/50"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-800">
                        {participation.artistData?.first_name}{" "}
                        {participation.artistData?.last_name}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-0.5">
                        {participation.artistData?.voice_type}
                      </span>
                    </div>
                    <div className="relative w-full sm:w-48 flex-shrink-0">
                      <input
                        type="number"
                        placeholder={t(
                          "projects.budget.input_placeholder",
                          "Wpisz kwotę...",
                        )}
                        value={currentValue}
                        onChange={(e) =>
                          handleFeeChange(
                            participation.id,
                            e.target.value,
                            "cast",
                          )
                        }
                        className={`w-full px-4 py-2.5 text-sm font-bold text-right text-stone-800 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all !pr-10 ${
                          isItemDirty ? "!bg-white !border-[#002395]/30" : ""
                        }`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest text-stone-400 pointer-events-none">
                        {t("common.currency", "PLN")}
                      </span>
                      {currentValue === "" && (
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full hidden sm:block">
                          <span className="bg-orange-100 text-orange-600 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                            {t("projects.budget.missing_fee", "Brak stawki")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 flex flex-col items-center">
          <Users size={24} className="text-stone-300 mb-2" aria-hidden="true" />
          <p className="text-[11px] uppercase tracking-widest font-bold antialiased text-stone-500">
            {t(
              "projects.budget.empty.cast",
              "Brak obsady przypisanej do projektu.",
            )}
          </p>
        </div>
      )}

      {/* CREW SECTION */}
      {enrichedCrew.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2 px-1">
            <Wrench size={16} className="text-[#002395]" aria-hidden="true" />
            {t("projects.budget.sections.crew", "Ekipa Realizacyjna")}
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md ml-2">
              {enrichedCrew.length} {t("common.people_short", "os.")}
            </span>
          </h3>
          <div className="bg-white/60 border border-stone-200/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y divide-stone-100">
              {enrichedCrew.map((assignment) => {
                const isItemDirty = !!dirtyFees[assignment.id];
                const currentValue = dirtyFees[assignment.id]
                  ? dirtyFees[assignment.id].value
                  : assignment.fee !== null && assignment.fee !== undefined
                    ? String(assignment.fee)
                    : "";

                return (
                  <div
                    key={assignment.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 transition-colors ${
                      isItemDirty ? "bg-blue-50/30" : "hover:bg-stone-50/50"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-800">
                        {assignment.crewData?.first_name}{" "}
                        {assignment.crewData?.last_name}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-0.5">
                        {assignment.role_description ||
                          assignment.crewData?.specialty}
                      </span>
                    </div>
                    <div className="relative w-full sm:w-48 flex-shrink-0">
                      <input
                        type="number"
                        placeholder={t(
                          "projects.budget.input_placeholder",
                          "Wpisz kwotę...",
                        )}
                        value={currentValue}
                        onChange={(e) =>
                          handleFeeChange(assignment.id, e.target.value, "crew")
                        }
                        className={`w-full px-4 py-2.5 text-sm font-bold text-right text-stone-800 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all !pr-10 ${
                          isItemDirty ? "!bg-white !border-[#002395]/30" : ""
                        }`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest text-stone-400 pointer-events-none">
                        {t("common.currency", "PLN")}
                      </span>
                      {currentValue === "" && (
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full hidden sm:block">
                          <span className="bg-orange-100 text-orange-600 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                            {t("projects.budget.missing_fee", "Brak stawki")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
