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
  Banknote,
  Users,
  Wrench,
  Sparkles,
  Save,
  AlertCircle,
} from "lucide-react";

import { useBudgetTab } from "../hooks/useBudgetTab";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Badge } from "@/shared/ui/primitives/Badge";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import {
  Eyebrow,
  Heading,
  Text,
  Metric,
  Unit,
} from "@/shared/ui/primitives/typography";

interface BudgetTabProps {
  projectId: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

export const BudgetTab = ({
  projectId,
  onDirtyStateChange,
}: BudgetTabProps): React.JSX.Element | null => {
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
        <EtherealLoader />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-4xl space-y-8 pb-24">
      {/* FLOATING ACTION BAR (FAB) */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            key="fab-menu"
            initial={{ y: 100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 100, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 z-(--z-toast) w-[90%] max-w-md md:bottom-10"
          >
            <GlassCard
              variant="solid"
              padding="sm"
              isHoverable={false}
              className="flex items-center justify-between gap-4 rounded-2xl"
            >
              <div className="ml-2 flex flex-col">
                <Eyebrow color="gold">
                  {t("projects.budget.fab.unsaved", "Niezapisane Zmiany")}
                </Eyebrow>
                <Text size="xs" color="muted">
                  {t(
                    "projects.budget.fab.description",
                    "Wprowadziłeś zmiany w stawkach.",
                  )}
                </Text>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  {t("common.actions.cancel", "Anuluj")}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBulkSave}
                  disabled={isSaving}
                  isLoading={isSaving}
                  leftIcon={
                    !isSaving ? (
                      <Save size={16} aria-hidden="true" />
                    ) : undefined
                  }
                >
                  {t("common.actions.save", "Zapisz")}
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 border-b border-ethereal-incense/20 pb-6">
        <GlassCard
          variant="light"
          padding="none"
          isHoverable={false}
          className="flex h-10 w-10 shrink-0 items-center justify-center border-ethereal-sage/30 bg-ethereal-sage/10 text-ethereal-sage"
        >
          <Banknote size={20} aria-hidden="true" />
        </GlassCard>
        <div>
          <Heading as="h2" size="xl" weight="medium">
            {t("projects.budget.sections.estimated", "Szacowany Budżet")}
          </Heading>
          <Text size="sm" color="muted">
            {t(
              "projects.budget.sections.description",
              "Zarządzaj kosztami osobowymi",
            )}
          </Text>
        </div>
      </div>

      {/* KPI DASHBOARD */}
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <div className="mb-6 flex items-center gap-2">
          <Sparkles
            size={14}
            className="text-ethereal-gold"
            aria-hidden="true"
          />
          <Eyebrow color="muted">
            {t("projects.budget.kpi.calculation", "Kalkulacja")}
          </Eyebrow>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="flex flex-col">
            <Eyebrow color="muted" className="mb-1">
              {t("projects.budget.kpi.cast_fees", "Stawki (Obsada)")}
            </Eyebrow>
            <div className="flex items-baseline gap-1.5">
              <Metric>{kpi.castTotal.toLocaleString("pl-PL")}</Metric>
              <Unit>{t("common.currency", "PLN")}</Unit>
            </div>
          </div>
          <div className="flex flex-col border-l border-ethereal-incense/10 pl-6">
            <Eyebrow color="muted" className="mb-1">
              {t("projects.budget.kpi.crew_fees", "Stawki (Ekipa)")}
            </Eyebrow>
            <div className="flex items-baseline gap-1.5">
              <Metric>{kpi.crewTotal.toLocaleString("pl-PL")}</Metric>
              <Unit>{t("common.currency", "PLN")}</Unit>
            </div>
          </div>
          <div className="flex flex-col border-l border-ethereal-incense/10 pl-6">
            <div className="mb-1 flex items-center gap-1.5">
              <Eyebrow color="muted">
                {t("projects.budget.kpi.missing", "Braki")}
              </Eyebrow>
              {kpi.missingCount > 0 && (
                <AlertCircle
                  size={12}
                  className="text-ethereal-crimson"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <Metric
                className={
                  kpi.missingCount > 0
                    ? "text-ethereal-crimson"
                    : "text-ethereal-graphite"
                }
              >
                {kpi.missingCount}
              </Metric>
              <Unit>
                {t("projects.budget.kpi.missing_desc", "poz. bez stawki")}
              </Unit>
            </div>
          </div>
          <div className="flex flex-col rounded-r-2xl border-l border-ethereal-incense/10 bg-ethereal-sage/5 -my-4 -mr-4 py-4 pl-6 pr-4">
            <Eyebrow color="sage" className="mb-1">
              {t("projects.budget.kpi.total", "Suma Kosztów")}
            </Eyebrow>
            <div className="flex items-baseline gap-1.5">
              <Metric className="text-ethereal-sage">
                {kpi.grandTotal.toLocaleString("pl-PL")}
              </Metric>
              <Unit className="text-ethereal-sage/70">
                {t("common.currency", "PLN")}
              </Unit>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* CAST SECTION */}
      {enrichedCast.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Users
              size={16}
              className="text-ethereal-gold"
              aria-hidden="true"
            />
            <Text weight="bold">
              {t("projects.budget.sections.cast", "Obsada Wykonawcza")}
            </Text>
            <Badge variant="neutral" className="ml-2">
              {enrichedCast.length} {t("common.people_short", "os.")}
            </Badge>
          </div>
          <GlassCard
            variant="light"
            padding="none"
            isHoverable={false}
            className="overflow-hidden"
          >
            <div className="divide-y divide-ethereal-incense/10">
              {enrichedCast.map((participation) => {
                const safeId = String(participation.id);
                const isItemDirty = !!dirtyFees[safeId];
                const currentValue = dirtyFees[safeId]
                  ? dirtyFees[safeId].value
                  : participation.fee !== null &&
                      participation.fee !== undefined
                    ? String(participation.fee)
                    : "";

                return (
                  <div
                    key={participation.id}
                    className={cn(
                      "flex flex-col justify-between gap-4 p-4 transition-colors sm:flex-row sm:items-center",
                      isItemDirty
                        ? "bg-ethereal-gold/5"
                        : "hover:bg-ethereal-marble/50",
                    )}
                  >
                    <div className="flex flex-col">
                      <Text size="sm" weight="bold">
                        {participation.artistData.first_name}{" "}
                        {participation.artistData.last_name}
                      </Text>
                      <Eyebrow color="muted" className="mt-0.5">
                        {participation.artistData.voice_type}
                      </Eyebrow>
                    </div>
                    <div className="relative w-full shrink-0 sm:w-48">
                      <Input
                        type="number"
                        placeholder={t(
                          "projects.budget.input_placeholder",
                          "Wpisz kwotę...",
                        )}
                        value={currentValue}
                        onChange={(e) =>
                          handleFeeChange(safeId, e.target.value, "cast")
                        }
                        className={cn(
                          "pr-12 text-right font-bold",
                          isItemDirty &&
                            "!border-ethereal-gold/40 !bg-white/90",
                        )}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite/40">
                        {t("common.currency", "PLN")}
                      </span>
                      {currentValue === "" && (
                        <div className="absolute -left-3 top-1/2 hidden -translate-x-full -translate-y-1/2 sm:block">
                          <Badge variant="danger">
                            {t("projects.budget.missing_fee", "Brak stawki")}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      ) : (
        <GlassCard
          variant="light"
          padding="lg"
          isHoverable={false}
          className="flex flex-col items-center border-dashed text-center"
        >
          <Users
            size={24}
            className="mb-2 text-ethereal-graphite/40"
            aria-hidden="true"
          />
          <Eyebrow color="muted">
            {t(
              "projects.budget.empty.cast",
              "Brak obsady przypisanej do projektu.",
            )}
          </Eyebrow>
        </GlassCard>
      )}

      {/* CREW SECTION */}
      {enrichedCrew.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Wrench
              size={16}
              className="text-ethereal-gold"
              aria-hidden="true"
            />
            <Text weight="bold">
              {t("projects.budget.sections.crew", "Ekipa Realizacyjna")}
            </Text>
            <Badge variant="neutral" className="ml-2">
              {enrichedCrew.length} {t("common.people_short", "os.")}
            </Badge>
          </div>
          <GlassCard
            variant="light"
            padding="none"
            isHoverable={false}
            className="overflow-hidden"
          >
            <div className="divide-y divide-ethereal-incense/10">
              {enrichedCrew.map((assignment) => {
                const safeId = String(assignment.id);
                const isItemDirty = !!dirtyFees[safeId];
                const currentValue = dirtyFees[safeId]
                  ? dirtyFees[safeId].value
                  : assignment.fee !== null && assignment.fee !== undefined
                    ? String(assignment.fee)
                    : "";

                return (
                  <div
                    key={assignment.id}
                    className={cn(
                      "flex flex-col justify-between gap-4 p-4 transition-colors sm:flex-row sm:items-center",
                      isItemDirty
                        ? "bg-ethereal-gold/5"
                        : "hover:bg-ethereal-marble/50",
                    )}
                  >
                    <div className="flex flex-col">
                      <Text size="sm" weight="bold">
                        {assignment.crewData.first_name}{" "}
                        {assignment.crewData.last_name}
                      </Text>
                      <Eyebrow color="muted" className="mt-0.5">
                        {assignment.role_description ||
                          assignment.crewData.specialty}
                      </Eyebrow>
                    </div>
                    <div className="relative w-full shrink-0 sm:w-48">
                      <Input
                        type="number"
                        placeholder={t(
                          "projects.budget.input_placeholder",
                          "Wpisz kwotę...",
                        )}
                        value={currentValue}
                        onChange={(e) =>
                          handleFeeChange(safeId, e.target.value, "crew")
                        }
                        className={cn(
                          "pr-12 text-right font-bold",
                          isItemDirty &&
                            "!border-ethereal-gold/40 !bg-white/90",
                        )}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite/40">
                        {t("common.currency", "PLN")}
                      </span>
                      {currentValue === "" && (
                        <div className="absolute -left-3 top-1/2 hidden -translate-x-full -translate-y-1/2 sm:block">
                          <Badge variant="danger">
                            {t("projects.budget.missing_fee", "Brak stawki")}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
