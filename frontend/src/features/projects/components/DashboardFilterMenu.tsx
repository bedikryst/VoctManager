/**
 * @file DashboardFilterMenu.tsx
 * @description Navigation pill menu for filtering projects by status.
 * Extracted to prevent UI bloat in the main dashboard controller.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/components/DashboardFilterMenu
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

export type FilterStatus = "ACTIVE" | "DONE" | "ALL";

interface FilterOption {
  id: FilterStatus;
  label: string;
}

interface DashboardFilterMenuProps {
  currentFilter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
}

export const DashboardFilterMenu: React.FC<DashboardFilterMenuProps> = ({
  currentFilter,
  onFilterChange,
}) => {
  const { t } = useTranslation();

  const filterOptions = useMemo<FilterOption[]>(
    () => [
      { id: "ACTIVE", label: t("projects.filters.active", "W przygotowaniu") },
      { id: "DONE", label: t("projects.filters.done", "Archiwum") },
      { id: "ALL", label: t("projects.filters.all", "Wszystkie") },
    ],
    [t],
  );

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div
        className="inline-flex items-center p-1.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-xl overflow-x-auto max-w-full scrollbar-hide"
        role="tablist"
        aria-label={t("projects.filters.aria_label", "Filtry statusu projektów")}
      >
        {filterOptions.map((filter) => {
          const isActive = currentFilter === filter.id;
          return (
            <button
              key={filter.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onFilterChange(filter.id)}
              className={`px-5 py-2 text-[9px] font-bold antialiased uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? "bg-white text-[#002395] shadow-sm border border-stone-100"
                  : "text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
