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

import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Search } from "lucide-react";

import type { Composer } from "@/shared/types";
import { FilterTokens, type FilterToken } from "@/shared/ui/composites/FilterTokens";
import { GlossaryTerm } from "@/shared/ui/composites/glossary/GlossaryTerm";
import {
  ListToolbar,
  ToolbarButton,
  ToolbarPanel,
  ToolbarPanelButton,
  ToolbarPanelField,
} from "@/shared/ui/composites/ListToolbar";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";

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
  const panelId = useId();
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
          <ToolbarPanelButton
            label={t("archive.search.filters_btn", "Filtry")}
            count={activeFilterCount}
            open={isAdvancedOpen}
            onToggle={() => setIsAdvancedOpen((open) => !open)}
            panelId={panelId}
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
      <ToolbarPanel id={panelId} open={isAdvancedOpen}>
        {/* An unset filter means "everything": that reading belongs on the
            placeholder, and the clear entry is the way back to it. */}
        <ToolbarPanelField label={t("archive.search.composer", "Kompozytor")}>
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
        </ToolbarPanelField>
        <ToolbarPanelField
          label={<GlossaryTerm term="epoch">{t("archive.search.epoch", "Epoka")}</GlossaryTerm>}
        >
          <Select
            value={epochFilter}
            onValueChange={onEpochFilterChange}
            placeholder={t("archive.search.all_epochs", "Wszystkie")}
            clearLabel={t("archive.search.all_epochs", "Wszystkie")}
            ariaLabel={t("archive.search.epoch", "Epoka")}
            options={epochOptions}
          />
        </ToolbarPanelField>
        <ToolbarPanelField label={t("archive.search.voicing", "Obsada")}>
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
        </ToolbarPanelField>
      </ToolbarPanel>
    </ListToolbar>
  );
};
