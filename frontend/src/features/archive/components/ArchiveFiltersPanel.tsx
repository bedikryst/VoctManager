/**
 * @file ArchiveFiltersPanel.tsx
 * @description Centralized filter surface for the archive dashboard.
 * Encapsulates inputs, active filter chips, and result summary without owning business state.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Filter,
  Library,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";

import type { Composer } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Text } from "@/shared/ui/primitives/typography";

export interface ArchiveActiveFilter {
  id: string;
  label: string;
  clear: () => void;
}

interface EpochOption {
  value: string;
  label: string;
}

interface ArchiveFiltersPanelProps {
  searchTerm: string;
  composerFilter: string;
  epochFilter: string;
  voicingFilter: string;
  composers: Composer[];
  epochOptions: EpochOption[];
  availableVoicings: string[];
  hasActiveFilters: boolean;
  activeFilterCount: number;
  activeFilters: ArchiveActiveFilter[];
  visibleCount: number;
  totalCount: number;
  onSearchTermChange: (value: string) => void;
  onComposerFilterChange: (value: string) => void;
  onEpochFilterChange: (value: string) => void;
  onVoicingFilterChange: (value: string) => void;
  onResetFilters: () => void;
}

export function ArchiveFiltersPanel({
  searchTerm,
  composerFilter,
  epochFilter,
  voicingFilter,
  composers,
  epochOptions,
  availableVoicings,
  hasActiveFilters,
  activeFilterCount,
  activeFilters,
  visibleCount,
  totalCount,
  onSearchTermChange,
  onComposerFilterChange,
  onEpochFilterChange,
  onVoicingFilterChange,
  onResetFilters,
}: ArchiveFiltersPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <GlassCard
      variant="ethereal"
      padding="md"
      isHoverable={false}
      className="border border-ethereal-incense/20"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" icon={<SlidersHorizontal size={12} />}>
              {t("archive.filters.heading", "Filtry Kolekcji")}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="glass" icon={<Filter size={12} />}>
              {hasActiveFilters
                ? t("archive.filters.active_filters", {
                    count: activeFilterCount,
                    defaultValue: "{{count}} aktywne filtry",
                  })
                : t("archive.filters.no_active_filters", "Brak aktywnych filtrów")}
            </Badge>
            {hasActiveFilters && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onResetFilters}
                leftIcon={<RotateCcw size={14} aria-hidden="true" />}
              >
                {t("archive.filters.clear_filters", "Wyczyść filtry")}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label={t("archive.filters.search_label", "Wyszukiwanie")}
            leftIcon={<Search size={16} aria-hidden="true" />}
            type="search"
            placeholder={t(
              "archive.filters.search_placeholder",
              "Szukaj po tytule lub kompozytorze...",
            )}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />

          <Select
            label={t("archive.filters.composer_label", "Kompozytor")}
            leftIcon={<Users size={16} aria-hidden="true" />}
            value={composerFilter}
            onChange={(event) => onComposerFilterChange(event.target.value)}
          >
            <option value="">{t("archive.filters.all_composers", "Wszyscy kompozytorzy")}</option>
            {composers.map((composer) => (
              <option key={composer.id} value={composer.id}>
                {composer.last_name} {composer.first_name || ""}
              </option>
            ))}
          </Select>

          <Select
            label={t("archive.filters.epoch_label", "Epoka")}
            leftIcon={<Clock size={16} aria-hidden="true" />}
            value={epochFilter}
            onChange={(event) => onEpochFilterChange(event.target.value)}
          >
            <option value="">{t("archive.filters.all_epochs", "Wszystkie epoki")}</option>
            {epochOptions.map((epoch) => (
              <option key={epoch.value} value={epoch.value}>
                {epoch.label}
              </option>
            ))}
          </Select>

          <Select
            label={t("archive.filters.voicing_label", "Obsada")}
            leftIcon={<Library size={16} aria-hidden="true" />}
            value={voicingFilter}
            onChange={(event) => onVoicingFilterChange(event.target.value)}
          >
            <option value="">{t("archive.filters.all_voicings", "Wszystkie profile obsady")}</option>
            {availableVoicings.map((voicing) => (
              <option key={voicing} value={voicing}>
                {voicing}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-3 border-t border-ethereal-incense/15 pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div aria-live="polite">
              <Text size="sm" color="graphite">
                {t("archive.filters.summary", {
                  visible: visibleCount,
                  total: totalCount,
                  defaultValue: "{{visible}} z {{total}} utworów w aktualnym widoku.",
                })}
              </Text>
            </div>
            {hasActiveFilters && (
              <Text size="sm" color="graphite">
                {t(
                  "archive.filters.active_description",
                  "Kliknij filtr, aby usunąć go bez resetowania całego widoku.",
                )}
              </Text>
            )}
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filterToken) => (
                <button
                  key={filterToken.id}
                  type="button"
                  onClick={filterToken.clear}
                  className="inline-flex items-center gap-2 rounded-full border border-ethereal-incense/20 bg-ethereal-alabaster/70 px-3 py-1.5 text-[11px] font-medium text-ethereal-graphite transition-colors hover:border-ethereal-gold/35 hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/30"
                >
                  <span>{filterToken.label}</span>
                  <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <Text size="sm" color="graphite">
              {t(
                "archive.filters.no_filters_message",
                "Brak aktywnych filtrów. Widok pokazuje pełny katalog archiwum.",
              )}
            </Text>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
