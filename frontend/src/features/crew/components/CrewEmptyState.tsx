/**
 * @file CrewEmptyState.tsx
 * @description Empty state for the crew collection list.
 * Adapts copy and primary action to search-driven, filter-driven, and pristine scenarios.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewEmptyState
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, RotateCcw, UsersRound } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface CrewEmptyStateProps {
  searchTerm: string;
  hasActiveFilters: boolean;
  onCreatePerson: () => void;
  onResetFilters: () => void;
}

export function CrewEmptyState({
  searchTerm,
  hasActiveFilters,
  onCreatePerson,
  onResetFilters,
}: CrewEmptyStateProps): React.JSX.Element {
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
        <UsersRound size={32} strokeWidth={1.5} />
      </div>

      <div className="space-y-2">
        <Eyebrow color="muted">
          {t("crew.empty_state.title", "Brak osób w bieżącym widoku")}
        </Eyebrow>

        {searchTerm ? (
          <Text color="graphite" className="mx-auto max-w-md">
            {t(
              "crew.empty_state.search_results",
              'Nie znaleźliśmy osoby ani firmy "{{term}}". Możesz dodać nowy wpis lub usunąć część filtrów.',
              { term: searchTerm },
            )}
          </Text>
        ) : hasActiveFilters ? (
          <Text color="graphite" className="mx-auto max-w-md">
            {t(
              "crew.empty_state.filters_blocked",
              "Aktualne filtry ukrywają całą bazę. Wyczyść je, aby wrócić do pełnego spisu.",
            )}
          </Text>
        ) : (
          <Text color="graphite" className="mx-auto max-w-md">
            {t(
              "crew.empty_state.start_building",
              "Rozpocznij budowę zespołu produkcyjnego, dodając pierwszego współpracownika do bazy.",
            )}
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          onClick={onCreatePerson}
          leftIcon={<Plus size={14} aria-hidden="true" />}
        >
          {searchTerm
            ? t("crew.empty_state.add_search", 'Dodaj wpis "{{term}}"', {
                term: searchTerm,
              })
            : t("crew.empty_state.add_person", "Dodaj współpracownika")}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={onResetFilters}
            leftIcon={<RotateCcw size={14} aria-hidden="true" />}
          >
            {t("crew.filters.clear_filters", "Wyczyść filtry")}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
