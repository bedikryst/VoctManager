/**
 * @file BudgetTab.tsx
 * @description Financial estimation and fee assignment. Fees edit a local draft and commit
 * in one batch via the shared EditorActionBar (deferred — already lag-free). A full-width
 * KPI strip tops two side-by-side ledgers (cast | crew on desktop), each height-capped with
 * internal scroll; unpriced positions sort to the top of each ledger.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/BudgetTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Users, Wrench, Sparkles, AlertCircle } from "lucide-react";

import { useBudgetTab } from "../hooks/useBudgetTab";
import { cn } from "@/shared/lib/utils";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Input } from "@/shared/ui/primitives/Input";
import { Badge } from "@/shared/ui/primitives/Badge";
import {
  Eyebrow,
  Text,
  Metric,
  Unit,
} from "@/shared/ui/primitives/typography";

interface BudgetTabProps {
  projectId: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

interface FeeRowProps {
  name: string;
  subtitle: string;
  value: string;
  isDirty: boolean;
  placeholder: string;
  currencyLabel: string;
  missingLabel: string;
  onChange: (value: string) => void;
}

const FeeRow = ({
  name,
  subtitle,
  value,
  isDirty,
  placeholder,
  currencyLabel,
  missingLabel,
  onChange,
}: FeeRowProps): React.JSX.Element => (
  <div
    className={cn(
      "flex flex-col justify-between gap-3 px-5 py-3.5 transition-colors sm:flex-row sm:items-center",
      isDirty ? "bg-ethereal-gold/5" : "hover:bg-ethereal-gold/15",
    )}
  >
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-col">
        <Text size="sm" weight="bold" truncate>
          {name}
        </Text>
        <Eyebrow color="muted" className="mt-0.5 truncate">
          {subtitle}
        </Eyebrow>
      </div>
      {value === "" && (
        <Badge variant="warning" className="shrink-0">
          {missingLabel}
        </Badge>
      )}
    </div>
    <div className="relative w-full shrink-0 sm:w-44">
      <Input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "text-left font-bold [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden",
          isDirty && "border-ethereal-gold! bg-white/50!",
        )}
      />
      <Text className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-ethereal-graphite/40">
        {currencyLabel}
      </Text>
    </div>
  </div>
);

export const BudgetTab = ({
  projectId,
  onDirtyStateChange,
}: BudgetTabProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const {
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

  const currencyLabel = t("common.currency", "PLN");
  const placeholder = t("projects.budget.input_placeholder", "Wpisz kwotę...");
  const missingLabel = t("projects.budget.missing_fee", "Brak stawki");
  const twoColumn = enrichedCast.length > 0 && enrichedCrew.length > 0;

  return (
    <>
      <div className="w-full space-y-6 pb-24">
        {/* ── KPI strip ─────────────────────────────────────────────────── */}
        <GlassCard variant="solid" padding="lg" isHoverable={false}>
          <div className="mb-6 flex items-center gap-2">
            <Sparkles size={14} className="text-ethereal-gold" aria-hidden="true" />
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
                <Unit>{currencyLabel}</Unit>
              </div>
            </div>

            <div className="flex flex-col border-l border-ethereal-ink/8 pl-6">
              <Eyebrow color="muted" className="mb-1">
                {t("projects.budget.kpi.crew_fees", "Stawki (Ekipa)")}
              </Eyebrow>
              <div className="flex items-baseline gap-1.5">
                <Metric>{kpi.crewTotal.toLocaleString("pl-PL")}</Metric>
                <Unit>{currencyLabel}</Unit>
              </div>
            </div>

            <div className="flex flex-col border-l border-ethereal-ink/8 pl-6">
              <div className="mb-1 flex items-center gap-1.5">
                <Eyebrow color="muted">
                  {t("projects.budget.kpi.missing", "Braki")}
                </Eyebrow>
                {kpi.missingCount > 0 && (
                  <AlertCircle
                    size={12}
                    className="text-ethereal-gold"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <Metric
                  className={
                    kpi.missingCount > 0
                      ? "text-ethereal-gold"
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

            <div className="flex flex-col rounded-2xl border border-ethereal-sage/20 bg-ethereal-sage/5 px-5 py-3">
              <Eyebrow color="sage" className="mb-1">
                {t("projects.budget.kpi.total", "Suma Kosztów")}
              </Eyebrow>
              <div className="flex items-baseline gap-1.5">
                <Metric className="text-ethereal-sage">
                  {kpi.grandTotal.toLocaleString("pl-PL")}
                </Metric>
                <Unit className="text-ethereal-sage/70">{currencyLabel}</Unit>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ── Ledgers: cast | crew ──────────────────────────────────────── */}
        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            twoColumn && "lg:grid-cols-2 lg:items-start",
          )}
        >
          {enrichedCast.length > 0 ? (
            <GlassCard
              variant="solid"
              padding="none"
              isHoverable={false}
              className="flex max-h-[55dvh] flex-col"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ethereal-ink/6 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Users
                    size={15}
                    className="text-ethereal-gold/70"
                    aria-hidden="true"
                  />
                  <Eyebrow as="h2" color="graphite">
                    {t("projects.budget.sections.cast", "Obsada Wykonawcza")}
                  </Eyebrow>
                </div>
                <Badge variant="neutral">
                  {enrichedCast.length} {t("common.people_short", "os.")}
                </Badge>
              </header>

              <div className="min-h-0 flex-1 divide-y divide-ethereal-ink/6 overflow-y-auto">
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
                    <FeeRow
                      key={participation.id}
                      name={`${participation.artistData.first_name} ${participation.artistData.last_name}`}
                      subtitle={participation.artistData.voice_type}
                      value={currentValue}
                      isDirty={isItemDirty}
                      placeholder={placeholder}
                      currencyLabel={currencyLabel}
                      missingLabel={missingLabel}
                      onChange={(value) => handleFeeChange(safeId, value, "cast")}
                    />
                  );
                })}
              </div>
            </GlassCard>
          ) : (
            <GlassCard
              variant="solid"
              padding="lg"
              isHoverable={false}
              className="flex flex-col items-center gap-2 text-center"
            >
              <Users size={28} className="text-ethereal-incense/30" aria-hidden="true" />
              <Eyebrow color="muted">
                {t(
                  "projects.budget.empty.cast",
                  "Brak obsady przypisanej do projektu.",
                )}
              </Eyebrow>
            </GlassCard>
          )}

          {enrichedCrew.length > 0 && (
            <GlassCard
              variant="solid"
              padding="none"
              isHoverable={false}
              className="flex max-h-[55dvh] flex-col"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ethereal-ink/6 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Wrench
                    size={15}
                    className="text-ethereal-gold/70"
                    aria-hidden="true"
                  />
                  <Eyebrow as="h2" color="graphite">
                    {t("projects.budget.sections.crew", "Ekipa Realizacyjna")}
                  </Eyebrow>
                </div>
                <Badge variant="neutral">
                  {enrichedCrew.length} {t("common.people_short", "os.")}
                </Badge>
              </header>

              <div className="min-h-0 flex-1 divide-y divide-ethereal-ink/6 overflow-y-auto">
                {enrichedCrew.map((assignment) => {
                  const safeId = String(assignment.id);
                  const isItemDirty = !!dirtyFees[safeId];
                  const currentValue = dirtyFees[safeId]
                    ? dirtyFees[safeId].value
                    : assignment.fee !== null && assignment.fee !== undefined
                      ? String(assignment.fee)
                      : "";

                  return (
                    <FeeRow
                      key={assignment.id}
                      name={`${assignment.crewData.first_name} ${assignment.crewData.last_name}`}
                      subtitle={
                        assignment.role_description ||
                        assignment.crewData.specialty
                      }
                      value={currentValue}
                      isDirty={isItemDirty}
                      placeholder={placeholder}
                      currencyLabel={currencyLabel}
                      missingLabel={missingLabel}
                      onChange={(value) => handleFeeChange(safeId, value, "crew")}
                    />
                  );
                })}
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      <EditorActionBar
        isOpen={isDirty}
        description={t(
          "projects.budget.fab.description",
          "Wprowadziłeś zmiany w stawkach.",
        )}
        onCancel={handleReset}
        onConfirm={handleBulkSave}
        isLoading={isSaving}
      />
    </>
  );
};
