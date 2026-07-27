/**
 * @file ArchiveSearchBar.tsx
 * @description Dominant search input + collapsible advanced filters.
 * Replaces the 4-dropdown panel that always took a full row. Most of the
 * time the conductor just types — composer / epoch / voicing filters hide
 * behind a small "Filtry" toggle with a count badge.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ArchiveSearchBar
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import type { Composer } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { FilterTokens, type FilterToken } from "@/shared/ui/composites/FilterTokens";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

export type ArchiveActiveFilter = FilterToken;

interface EpochOption {
  value: string;
  label: string;
}

interface ArchiveSearchBarProps {
  readonly searchTerm: string;
  readonly composerFilter: string;
  readonly epochFilter: string;
  readonly voicingFilter: string;
  readonly composers: Composer[];
  readonly epochOptions: EpochOption[];
  readonly availableVoicings: string[];
  readonly hasActiveFilters: boolean;
  readonly activeFilterCount: number;
  readonly activeFilters: ArchiveActiveFilter[];
  readonly visibleCount: number;
  readonly totalCount: number;
  readonly onSearchTermChange: (value: string) => void;
  readonly onComposerFilterChange: (value: string) => void;
  readonly onEpochFilterChange: (value: string) => void;
  readonly onVoicingFilterChange: (value: string) => void;
  readonly onResetFilters: () => void;
}

export const ArchiveSearchBar = ({
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
}: ArchiveSearchBarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(
    activeFilterCount > 1 || (activeFilterCount === 1 && !searchTerm),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex-1">
          <Input
            leftIcon={<Search size={16} aria-hidden="true" />}
            type="search"
            placeholder={t(
              "archive.search.placeholder",
              "Szukaj utworu lub kompozytora…",
            )}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            aria-label={t("archive.search.aria", "Szukaj w archiwum")}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={activeFilterCount > 0 ? "secondary" : "outline"}
            onClick={() => setIsAdvancedOpen((open) => !open)}
            aria-expanded={isAdvancedOpen}
            leftIcon={<SlidersHorizontal size={13} aria-hidden="true" />}
            rightIcon={
              <ChevronDown
                size={13}
                aria-hidden="true"
                className={cn(
                  "transition-transform",
                  isAdvancedOpen && "rotate-180",
                )}
              />
            }
          >
            {t("archive.search.filters_btn", "Filtry")}
            {activeFilterCount > 0 && (
              <Badge variant="warning" className="ml-2 px-1.5 py-0">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              leftIcon={<RotateCcw size={13} aria-hidden="true" />}
            >
              {t("archive.search.reset", "Wyczyść")}
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isAdvancedOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 rounded-nested border border-hairline bg-ethereal-alabaster/40 p-3 md:grid-cols-3">
              <div>
                <Eyebrow color="muted" className="mb-1 ml-1 block">
                  {t("archive.search.composer", "Kompozytor")}
                </Eyebrow>
                {/* An unset filter means "everything" — that reading belongs on
                    the placeholder, and the clear entry is the way back to it. */}
                <Select
                  value={composerFilter}
                  onValueChange={onComposerFilterChange}
                  placeholder={t("archive.search.all_composers", "Wszyscy")}
                  clearLabel={t("archive.search.all_composers", "Wszyscy")}
                  ariaLabel={t("archive.search.composer", "Kompozytor")}
                  options={composers.map((composer) => ({
                    value: String(composer.id),
                    label: `${composer.last_name} ${composer.first_name || ""}`.trim(),
                  }))}
                />
              </div>
              <div>
                <Eyebrow color="muted" className="mb-1 ml-1 block">
                  {t("archive.search.epoch", "Epoka")}
                </Eyebrow>
                <Select
                  value={epochFilter}
                  onValueChange={onEpochFilterChange}
                  placeholder={t("archive.search.all_epochs", "Wszystkie")}
                  clearLabel={t("archive.search.all_epochs", "Wszystkie")}
                  ariaLabel={t("archive.search.epoch", "Epoka")}
                  options={epochOptions}
                />
              </div>
              <div>
                <Eyebrow color="muted" className="mb-1 ml-1 block">
                  {t("archive.search.voicing", "Obsada")}
                </Eyebrow>
                <Select
                  value={voicingFilter}
                  onValueChange={onVoicingFilterChange}
                  placeholder={t("archive.search.all_voicings", "Wszystkie")}
                  clearLabel={t("archive.search.all_voicings", "Wszystkie")}
                  ariaLabel={t("archive.search.voicing", "Obsada")}
                  options={availableVoicings.map((voicing) => ({
                    value: voicing,
                    label: voicing,
                  }))}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unlike the crew roster's permanent census, this summary is the *effect*
          of a filter — the library total is already stated in the stat line
          above, so with nothing narrowing the view it would only say "128 z
          128". Hence the guard rather than `FilterTokens`' summary-only mode.
          `onClearAll` is deliberately not passed either: "Wyczyść" already sits
          beside the Filtry toggle, and a second clear-everything control is the
          same sentence twice. */}
      {activeFilters.length > 0 && (
        <FilterTokens
          tokens={activeFilters}
          summary={
            <Caption color="muted">
              {t("archive.search.summary_filtered", "{{visible}} z {{total}}", {
                visible: visibleCount,
                total: totalCount,
              })}
            </Caption>
          }
        />
      )}
    </div>
  );
};
