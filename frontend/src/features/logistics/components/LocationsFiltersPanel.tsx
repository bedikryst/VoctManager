/**
 * @file LocationsFiltersPanel.tsx
 * @description Centralised filter surface for the logistics dashboard.
 * Owns search, category select, view-mode toggle, active-filter chips, and the
 * result summary while staying decoupled from business state — every value
 * flows in/out through declarative props.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationsFiltersPanel
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Filter,
  Globe2,
  LayoutGrid,
  RotateCcw,
  Search,
  Shapes,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import type { LocationCategory } from "@/shared/types";
import type { LocationCategoryOption } from "../constants/locationCategories";
import type {
  LocationsActiveFilter,
  LocationsViewMode,
} from "../hooks/useLocationsData";

interface LocationsFiltersPanelProps {
  searchTerm: string;
  categoryFilter: LocationCategory | "";
  categoryOptions: LocationCategoryOption[];
  categoryStats: Partial<Record<LocationCategory, number>>;
  totalCount: number;
  visibleCount: number;
  hasActiveFilters: boolean;
  activeFilters: LocationsActiveFilter[];
  viewMode: LocationsViewMode;
  onSearchTermChange: (value: string) => void;
  onCategoryFilterChange: (value: LocationCategory | "") => void;
  onResetFilters: () => void;
  onViewModeChange: (mode: LocationsViewMode) => void;
}

interface ViewModeOption {
  value: LocationsViewMode;
  icon: typeof LayoutGrid;
  labelKey: string;
  defaultLabel: string;
}

const VIEW_MODE_OPTIONS: ReadonlyArray<ViewModeOption> = [
  {
    value: "grid",
    icon: LayoutGrid,
    labelKey: "logistics.filters.view_grid",
    defaultLabel: "Siatka",
  },
  {
    value: "atlas",
    icon: Globe2,
    labelKey: "logistics.filters.view_atlas",
    defaultLabel: "Atlas",
  },
];

export function LocationsFiltersPanel({
  searchTerm,
  categoryFilter,
  categoryOptions,
  categoryStats,
  totalCount,
  visibleCount,
  hasActiveFilters,
  activeFilters,
  viewMode,
  onSearchTermChange,
  onCategoryFilterChange,
  onResetFilters,
  onViewModeChange,
}: LocationsFiltersPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <GlassCard
      variant="ethereal"
      padding="md"
      isHoverable={false}
      className="border border-ethereal-incense/20"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Badge variant="outline" icon={<SlidersHorizontal size={12} />}>
            {t("logistics.filters.heading", "Filtry Bazy")}
          </Badge>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="glass" icon={<Filter size={12} />}>
              {hasActiveFilters
                ? t("logistics.filters.active_filters", {
                    count: activeFilters.length,
                    defaultValue: "{{count}} aktywne filtry",
                  })
                : t(
                    "logistics.filters.no_active_filters",
                    "Brak aktywnych filtrów",
                  )}
            </Badge>

            <div
              role="tablist"
              aria-label={t("logistics.filters.view_aria", "Tryb widoku")}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-ethereal-incense/20 bg-ethereal-alabaster/55 p-1 backdrop-blur-md"
            >
              {VIEW_MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = viewMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onViewModeChange(option.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] antialiased transition-all duration-300",
                      isActive
                        ? "bg-ethereal-marble text-ethereal-ink shadow-sm"
                        : "text-ethereal-graphite/70 hover:text-ethereal-ink",
                    )}
                  >
                    <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                    <span>{t(option.labelKey, option.defaultLabel)}</span>
                  </button>
                );
              })}
            </div>

            {hasActiveFilters && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onResetFilters}
                leftIcon={<RotateCcw size={14} aria-hidden="true" />}
              >
                {t("logistics.filters.clear_filters", "Wyczyść filtry")}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={t("logistics.filters.search_label", "Wyszukiwanie")}
            leftIcon={<Search size={16} aria-hidden="true" />}
            type="search"
            placeholder={t(
              "logistics.filters.search_placeholder",
              "Szukaj po nazwie lub adresie...",
            )}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />

          <Select
            label={t("logistics.filters.category_label", "Kategoria")}
            leftIcon={<Shapes size={16} aria-hidden="true" />}
            value={categoryFilter}
            onChange={(event) =>
              onCategoryFilterChange(
                event.target.value as LocationCategory | "",
              )
            }
          >
            <option value="">
              {t("logistics.filters.all_categories", "Wszystkie kategorie")} ·{" "}
              {totalCount}
            </option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.plural} · {categoryStats[option.value] ?? 0}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-3 border-t border-ethereal-incense/15 pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div aria-live="polite">
              <Text size="sm" color="graphite">
                {t("logistics.filters.summary", {
                  visible: visibleCount,
                  total: totalCount,
                  defaultValue:
                    "{{visible}} z {{total}} lokacji w aktualnym widoku.",
                })}
              </Text>
            </div>
            {hasActiveFilters && (
              <Eyebrow color="muted">
                {t(
                  "logistics.filters.active_description",
                  "Kliknij filtr, aby usunąć go bez resetowania całego widoku.",
                )}
              </Eyebrow>
            )}
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  onClick={token.clear}
                  className="inline-flex items-center gap-2 rounded-full border border-ethereal-incense/20 bg-ethereal-alabaster/70 px-3 py-1.5 text-[11px] font-medium text-ethereal-graphite transition-colors hover:border-ethereal-gold/35 hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/30"
                >
                  <span>{token.label}</span>
                  <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <Text size="sm" color="graphite">
              {t(
                "logistics.filters.no_filters_message",
                "Widok prezentuje pełną bazę lokacji.",
              )}
            </Text>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
