/**
 * @file DashboardFilterMenu.tsx
 * @description Segmented filter control for project lifecycle views.
 * Aligns dashboard filtering with shared glass and typography primitives.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/components/DashboardFilterMenu
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { PROJECT_FILTER, type ProjectFilterId } from "../constants/projectDomain";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow } from "@/shared/ui/primitives/typography";

interface FilterOption {
  id: ProjectFilterId;
  label: string;
}

interface DashboardFilterMenuProps {
  currentFilter: ProjectFilterId;
  onFilterChange: (filter: ProjectFilterId) => void;
}

export const DashboardFilterMenu = ({
  currentFilter,
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
    <GlassCard
      variant="light"
      padding="sm"
      isHoverable={false}
      className="overflow-hidden"
    >
      <div
        role="tablist"
        aria-label={t("projects.filters.aria_label", "Filtry statusu projektów")}
        className="flex max-w-full gap-2 overflow-x-auto no-scrollbar"
      >
        {filterOptions.map((filter) => {
          const isActive = currentFilter === filter.id;

          return (
            <Button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              variant={isActive ? "primary" : "ghost"}
              size="sm"
              onClick={() => onFilterChange(filter.id)}
              className="shrink-0"
            >
              <Eyebrow color="inherit">{filter.label}</Eyebrow>
            </Button>
          );
        })}
      </div>
    </GlassCard>
  );
};
