/**
 * @file RosterToolbar.tsx
 * @description The roster's toolbar (`ListToolbar`): the name search, then
 * "Zaznacz wiele" for the list's selection mode and "Filtry", whose panel holds
 * the range filter and the order. The line under the row is the census: the
 * count the caller passes, its quick filters, then a removable token for each
 * filter in use.
 *
 * The range filter is always there, even before the first proposal: then "Bez
 * propozycji skali" lists every singer still to answer, which is the question
 * the conductor asks of it. Its options each name the range, so the token a
 * chosen one leaves on the census line reads on its own.
 * @module features/artists/components/RosterToolbar
 */

import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Search } from "lucide-react";

import { FilterTokens, type FilterToken } from "@/shared/ui/composites/FilterTokens";
import {
  ListToolbar,
  ToolbarButton,
  ToolbarPanel,
  ToolbarPanelButton,
  ToolbarPanelField,
} from "@/shared/ui/composites/ListToolbar";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";

import type { RosterSort } from "../lib/rosterScope";
import { isRangeFilter, type RangeFilter } from "../lib/vocalRangeProposal";

interface RosterToolbarProps {
  readonly searchTerm: string;
  readonly onSearch: (value: string) => void;
  readonly rangeFilter: RangeFilter;
  readonly onRangeFilter: (value: RangeFilter) => void;
  readonly sortBy: RosterSort;
  readonly onSort: (value: RosterSort) => void;
  readonly selectionMode: boolean;
  readonly onToggleSelectionMode: () => void;
  /** The list's count (`ListCensus`), first on the census line. */
  readonly census: React.ReactNode;
  /** `FilterToggle` chips, after the count. */
  readonly quickFilters?: React.ReactNode;
  readonly onResetFilters: () => void;
}

const isSort = (value: string): value is RosterSort =>
  value === "name" || value === "section" || value === "skill";

export const RosterToolbar = ({
  searchTerm,
  onSearch,
  rangeFilter,
  onRangeFilter,
  sortBy,
  onSort,
  selectionMode,
  onToggleSelectionMode,
  census,
  quickFilters,
  onResetFilters,
}: RosterToolbarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const panelId = useId();
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(
    () => rangeFilter !== "all" || sortBy !== "name",
  );

  const rangeLabels: Readonly<Record<Exclude<RangeFilter, "all">, string>> = {
    proposed: t("artists.toolbar.range_proposed", "Z propozycją skali"),
    awaiting: t("artists.toolbar.range_awaiting", "Propozycja czeka na ocenę"),
    missing: t("artists.toolbar.range_missing", "Bez propozycji skali"),
    differs: t("artists.toolbar.range_differs", "Propozycja inna niż ocena"),
  };

  const term = searchTerm.trim();
  const tokens: FilterToken[] = [];
  if (term) {
    tokens.push({
      id: "search",
      label: t("artists.toolbar.search_token", 'Fraza: "{{term}}"', { term }),
      clear: () => onSearch(""),
    });
  }
  if (rangeFilter !== "all") {
    tokens.push({
      id: "range",
      label: rangeLabels[rangeFilter],
      clear: () => onRangeFilter("all"),
    });
  }

  return (
    <ListToolbar
      search={
        <Input
          leftIcon={<Search size={16} aria-hidden="true" />}
          type="search"
          aria-label={t("artists.dashboard.search_placeholder", "Szukaj po nazwisku…")}
          placeholder={t("artists.dashboard.search_placeholder", "Szukaj po nazwisku…")}
          value={searchTerm}
          onChange={(event) => onSearch(event.target.value)}
        />
      }
      controls={
        <>
          <ToolbarButton
            icon={<CheckSquare size={16} aria-hidden="true" />}
            label={t("artists.toolbar.select_mode", "Zaznacz wielu")}
            on={selectionMode}
            aria-pressed={selectionMode}
            onClick={onToggleSelectionMode}
          />
          <ToolbarPanelButton
            label={t("artists.toolbar.filters", "Filtry")}
            count={rangeFilter !== "all" ? 1 : 0}
            open={isPanelOpen}
            onToggle={() => setIsPanelOpen((open) => !open)}
            panelId={panelId}
          />
        </>
      }
      census={
        <>
          {census}
          {quickFilters}
          <FilterTokens tokens={tokens} onClearAll={onResetFilters} className="contents" />
        </>
      }
    >
      <ToolbarPanel id={panelId} open={isPanelOpen}>
        <ToolbarPanelField label={t("artists.toolbar.range_label", "Skala głosu")}>
          <Select
            value={rangeFilter === "all" ? "" : rangeFilter}
            onValueChange={(value) => onRangeFilter(isRangeFilter(value) ? value : "all")}
            placeholder={t("artists.toolbar.range_all", "Wszyscy")}
            clearLabel={t("artists.toolbar.range_all", "Wszyscy")}
            ariaLabel={t("artists.toolbar.range_label", "Skala głosu")}
            options={(Object.keys(rangeLabels) as Exclude<RangeFilter, "all">[]).map((value) => ({
              value,
              label: rangeLabels[value],
            }))}
          />
        </ToolbarPanelField>
        <ToolbarPanelField label={t("artists.toolbar.sort_label", "Kolejność")}>
          <Select
            value={sortBy}
            onValueChange={(value) => {
              if (isSort(value)) onSort(value);
            }}
            ariaLabel={t("artists.toolbar.sort_label", "Kolejność")}
            options={[
              { value: "name", label: t("artists.toolbar.sort_name", "Nazwisko (A–Z)") },
              { value: "section", label: t("artists.toolbar.sort_section", "Sekcja (SATB)") },
              { value: "skill", label: t("artists.toolbar.sort_skill", "Czytanie a vista") },
            ]}
          />
        </ToolbarPanelField>
      </ToolbarPanel>
    </ListToolbar>
  );
};
