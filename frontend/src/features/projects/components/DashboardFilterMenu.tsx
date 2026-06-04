/**
 * @file DashboardFilterMenu.tsx
 * @description Segmented filter control for project lifecycle views.
 * Aligns dashboard filtering with shared glass and typography primitives.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/DashboardFilterMenu
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  PROJECT_FILTER,
  type ProjectFilterId,
} from "../constants/projectDomain";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/primitives/typography";

interface FilterOption {
  id: ProjectFilterId;
  label: string;
}

interface DashboardFilterMenuProps {
  currentFilter: ProjectFilterId;
  counts: Readonly<Record<ProjectFilterId, number>>;
  onFilterChange: (filter: ProjectFilterId) => void;
}

export const DashboardFilterMenu = ({
  currentFilter,
  counts,
  onFilterChange,
}: DashboardFilterMenuProps): React.JSX.Element => {
  const { t } = useTranslation();

  const filterOptions = useMemo<FilterOption[]>(
    () => [
      {
        id: PROJECT_FILTER.ACTIVE,
        label: t("projects.filters.active", "W przygotowaniu"),
      },
      {
        id: PROJECT_FILTER.DONE,
        label: t("projects.filters.done", "Archiwum"),
      },
      {
        id: PROJECT_FILTER.ALL,
        label: t("projects.filters.all", "Wszystkie"),
      },
    ],
    [t],
  );

  return (
    <div
      role="tablist"
      aria-label={t("projects.filters.aria_label", "Filtry statusu projektów")}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-ethereal-ink/8 bg-ethereal-alabaster/70 p-1 no-scrollbar"
    >
      {filterOptions.map((filter) => {
        const isActive = currentFilter === filter.id;

        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              isActive
                ? "bg-ethereal-gold text-ethereal-ink shadow-sm"
                : "text-ethereal-graphite hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink",
            )}
          >
            <Label size="sm" weight="semibold" color="inherit">
              {filter.label}
            </Label>
            <span
              className={cn(
                "rounded-full px-1.5 pb-1 leading-none",
                isActive ? "bg-ethereal-ink/10" : "bg-ethereal-ink/5",
              )}
            >
              <Label
                size="xs"
                weight="semibold"
                color="inherit"
                className="tabular-nums opacity-80"
              >
                {counts[filter.id]}
              </Label>
            </span>
          </button>
        );
      })}
    </div>
  );
};
