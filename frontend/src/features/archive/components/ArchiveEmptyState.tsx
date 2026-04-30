/**
 * @file ArchiveEmptyState.tsx
 * @description Empty state for the archive collection list.
 * Adapts its copy and actions to search-driven and filter-driven no-result scenarios.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Layers, Plus, RotateCcw } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface ArchiveEmptyStateProps {
  searchTerm: string;
  hasActiveFilters: boolean;
  onCreatePiece: () => void;
  onResetFilters: () => void;
}

export function ArchiveEmptyState({
  searchTerm,
  hasActiveFilters,
  onCreatePiece,
  onResetFilters,
}: ArchiveEmptyStateProps): React.JSX.Element {
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
        <Layers size={32} />
      </div>

      <div className="space-y-2">
        <Eyebrow color="muted">
          {t("archive.empty_state.title", "Brak utworów w bieżącym widoku")}
        </Eyebrow>

        {searchTerm ? (
          <Text color="graphite" className="mx-auto max-w-md">
            {t("archive.empty_state.search_results", "Nie znaleziono wyników dla \"{{term}}\". Możesz utworzyć nową kartę utworu lub usunąć część filtrów.", {
              term: searchTerm,
            })}
          </Text>
        ) : hasActiveFilters ? (
          <Text color="graphite" className="mx-auto max-w-md">
            {t(
              "archive.empty_state.filters_blocked",
              "Aktualne filtry ukrywają całą kolekcję. Wyczyść je, aby wrócić do pełnego katalogu.",
            )}
          </Text>
        ) : (
          <Text color="graphite" className="mx-auto max-w-md">
            {t(
              "archive.empty_state.start_building",
              "Rozpocznij budowę biblioteki, dodając pierwszy utwór do archiwum.",
            )}
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          onClick={onCreatePiece}
          leftIcon={<Plus size={14} aria-hidden="true" />}
        >
          {searchTerm
            ? t("archive.empty_state.add_search", "Dodaj utwór \"{{term}}\"", {
                term: searchTerm,
              })
            : t("archive.empty_state.add_piece", "Dodaj utwór")}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={onResetFilters}
            leftIcon={<RotateCcw size={14} aria-hidden="true" />}
          >
            {t("archive.filters.clear_filters", "Wyczyść filtry")}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
