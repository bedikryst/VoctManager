/**
 * @file ArchiveSearchBar.tsx
 * @description The library's toolbar (`ListToolbar`): the search, then the
 * "Zaznacz wiele" switch for the list's selection mode and the "Filtry" toggle
 * that counts the filters in use. Most of the time the conductor just types;
 * the composer, epoch and voicing filters wait behind "Filtry". The line under
 * the row is the page's census: the count the caller passes, its quick filters,
 * then a removable token for each filter in use.
 * @module features/archive/components/ArchiveSearchBar
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { CheckSquare, ChevronDown, Search, SlidersHorizontal } from "lucide-react";

import type { Composer } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { FilterTokens, type FilterToken } from "@/shared/ui/composites/FilterTokens";
import { GlossaryTerm } from "@/shared/ui/composites/glossary/GlossaryTerm";
import { ListToolbar, ToolbarButton } from "@/shared/ui/composites/ListToolbar";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Text } from "@/shared/ui/primitives/typography";
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
  readonly activeFilterCount: number;
  readonly activeFilters: ArchiveActiveFilter[];
  /** The list's count (`ListCensus`), first on the census line. */
  readonly census: React.ReactNode;
  /** `FilterToggle` chips, after the count. */
  readonly quickFilters?: React.ReactNode;
  readonly onSearchTermChange: (value: string) => void;
  readonly onComposerFilterChange: (value: string) => void;
  readonly onEpochFilterChange: (value: string) => void;
  readonly onVoicingFilterChange: (value: string) => void;
  readonly onResetFilters: () => void;
  /** Bulk selection of rows — the archive's one multi-piece act (divisi). */
  readonly selectionMode: boolean;
  readonly onToggleSelectionMode: () => void;
}

export const ArchiveSearchBar = ({
  searchTerm,
  composerFilter,
  epochFilter,
  voicingFilter,
  composers,
  epochOptions,
  availableVoicings,
  activeFilterCount,
  activeFilters,
  census,
  quickFilters,
  onSearchTermChange,
  onComposerFilterChange,
  onEpochFilterChange,
  onVoicingFilterChange,
  onResetFilters,
  selectionMode,
  onToggleSelectionMode,
}: ArchiveSearchBarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(
    activeFilterCount > 1 || (activeFilterCount === 1 && !searchTerm),
  );

  return (
    <ListToolbar
      search={
        <Input
          leftIcon={<Search size={16} aria-hidden="true" />}
          type="search"
          placeholder={t("archive.search.placeholder", "Szukaj utworu lub kompozytora…")}
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          aria-label={t("archive.search.aria", "Szukaj w bibliotece")}
        />
      }
      controls={
        <>
          <ToolbarButton
            icon={<CheckSquare size={16} aria-hidden="true" />}
            label={t("archive.search.select_mode", "Zaznacz wiele")}
            on={selectionMode}
            aria-pressed={selectionMode}
            onClick={onToggleSelectionMode}
          />
          <ToolbarButton
            icon={<SlidersHorizontal size={16} aria-hidden="true" />}
            label={t("archive.search.filters_btn", "Filtry")}
            on={activeFilterCount > 0}
            aria-expanded={isAdvancedOpen}
            onClick={() => setIsAdvancedOpen((open) => !open)}
            trailing={
              <>
                {activeFilterCount > 0 && (
                  <Badge variant="warning" casing="natural" className="px-1.5 py-0 tabular-nums">
                    {activeFilterCount}
                  </Badge>
                )}
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={cn("transition-transform", isAdvancedOpen && "rotate-180")}
                />
              </>
            }
          />
        </>
      }
      // One clear-everything control, and only where it is more than one click:
      // with a single filter in use, that token's own × is the way back.
      census={
        <>
          {census}
          {quickFilters}
          <FilterTokens tokens={activeFilters} onClearAll={onResetFilters} className="contents" />
        </>
      }
    >
      {/* Opacity and a short drop, on the compositor: the panel pushes the
          list down at once rather than growing into it. */}
      <AnimatePresence initial={false}>
        {isAdvancedOpen && (
          <motion.div
            initial={{ opacity: 0, transform: "translateY(-4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-4px)" }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="grid gap-3 rounded-nested border border-hairline bg-ethereal-alabaster/40 p-3 md:grid-cols-3">
              <div>
                <Text as="span" size="sm" color="graphite" className="mb-1 ml-1 block">
                  {t("archive.search.composer", "Kompozytor")}
                </Text>
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
                <Text as="span" size="sm" color="graphite" className="mb-1 ml-1 block">
                  <GlossaryTerm term="epoch">{t("archive.search.epoch", "Epoka")}</GlossaryTerm>
                </Text>
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
                <Text as="span" size="sm" color="graphite" className="mb-1 ml-1 block">
                  {t("archive.search.voicing", "Obsada")}
                </Text>
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
    </ListToolbar>
  );
};
