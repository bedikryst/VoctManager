/**
 * @file ArchiveEmptyState.tsx
 * @description Empty state for the archive collection list.
 * Adapts its copy and actions to search-driven and filter-driven no-result scenarios.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Layers, Plus, RotateCcw } from "lucide-react";

import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";

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

  const description = searchTerm
    ? t(
        "archive.empty_state.search_results",
        'Nie znaleziono wyników dla "{{term}}". Możesz utworzyć nową kartę utworu lub usunąć część filtrów.',
        { term: searchTerm },
      )
    : hasActiveFilters
      ? t(
          "archive.empty_state.filters_blocked",
          "Aktualne filtry ukrywają całą kolekcję. Wyczyść je, aby wrócić do pełnego katalogu.",
        )
      : t(
          "archive.empty_state.start_building",
          "Rozpocznij budowę biblioteki, dodając pierwszy utwór do archiwum.",
        );

  return (
    <StatePanel
      icon={<Layers size={32} aria-hidden="true" />}
      title={t("archive.empty_state.title", "Brak utworów w bieżącym widoku")}
      description={description}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={onCreatePiece}
            leftIcon={<Plus size={14} aria-hidden="true" />}
          >
            {searchTerm
              ? t("archive.empty_state.add_search", 'Dodaj utwór "{{term}}"', {
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
        </>
      }
    />
  );
}
