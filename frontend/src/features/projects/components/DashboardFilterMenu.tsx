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
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/shared/ui/composites/SegmentedTabs";

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

  const items = useMemo<SegmentedTabItem<ProjectFilterId>[]>(
    () => [
      {
        id: PROJECT_FILTER.ACTIVE,
        label: t("projects.filters.active", "W przygotowaniu"),
        count: counts[PROJECT_FILTER.ACTIVE],
      },
      {
        id: PROJECT_FILTER.DRAFT,
        label: t("projects.filters.draft", "Szkice"),
        count: counts[PROJECT_FILTER.DRAFT],
      },
      {
        id: PROJECT_FILTER.DONE,
        label: t("projects.filters.done", "Archiwum"),
        count: counts[PROJECT_FILTER.DONE],
      },
      {
        id: PROJECT_FILTER.ALL,
        label: t("projects.filters.all", "Wszystkie"),
        count: counts[PROJECT_FILTER.ALL],
      },
    ],
    [counts, t],
  );

  return (
    <SegmentedTabs
      items={items}
      value={currentFilter}
      onChange={onFilterChange}
      ariaLabel={t("projects.filters.aria_label", "Filtry statusu projektów")}
    />
  );
};
