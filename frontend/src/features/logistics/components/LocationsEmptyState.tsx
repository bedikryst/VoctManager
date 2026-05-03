/**
 * @file LocationsEmptyState.tsx
 * @description Empty state for the locations collection.
 * Adapts copy and primary action to search-driven, filter-driven, and pristine
 * scenarios — mirroring the Crew empty-state rhythm.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationsEmptyState
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { MapPinned, Plus, RotateCcw } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface LocationsEmptyStateProps {
  searchTerm: string;
  hasActiveFilters: boolean;
  onCreateLocation: () => void;
  onResetFilters: () => void;
}

export function LocationsEmptyState({
  searchTerm,
  hasActiveFilters,
  onCreateLocation,
  onResetFilters,
}: LocationsEmptyStateProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <GlassCard
      variant="light"
      padding="lg"
      isHoverable={false}
      className="flex flex-col items-center justify-center gap-5 text-center"
    >
      <div
        className="rounded-full border border-ethereal-incense/15 bg-ethereal-alabaster/70 p-4 text-ethereal-graphite/55"
        aria-hidden="true"
      >
        <MapPinned size={32} strokeWidth={1.5} />
      </div>

      <div className="space-y-2">
        <Eyebrow color="muted">
          {t("logistics.empty_state.title", "Brak lokacji w bieżącym widoku")}
        </Eyebrow>

        {searchTerm ? (
          <Text color="graphite" className="mx-auto max-w-md">
            {t(
              "logistics.empty_state.search_results",
              'Nie znaleźliśmy lokacji pasującej do "{{term}}". Możesz dodać nowy wpis lub zmienić filtry.',
              { term: searchTerm },
            )}
          </Text>
        ) : hasActiveFilters ? (
          <Text color="graphite" className="mx-auto max-w-md">
            {t(
              "logistics.empty_state.filters_blocked",
              "Aktualne filtry ukrywają całą bazę. Wyczyść je, aby wrócić do pełnego atlasu.",
            )}
          </Text>
        ) : (
          <Text color="graphite" className="mx-auto max-w-md">
            {t(
              "logistics.empty_state.start_building",
              "Rozpocznij budowę globalnego atlasu, dodając pierwszą salę, kościół lub hotel zespołu.",
            )}
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          onClick={onCreateLocation}
          leftIcon={<Plus size={14} aria-hidden="true" />}
        >
          {t("logistics.empty_state.add_location", "Dodaj lokację")}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={onResetFilters}
            leftIcon={<RotateCcw size={14} aria-hidden="true" />}
          >
            {t("logistics.filters.clear_filters", "Wyczyść filtry")}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
