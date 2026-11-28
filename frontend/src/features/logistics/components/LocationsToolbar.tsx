/**
 * @file LocationsToolbar.tsx
 * @description The locations page's toolbar (`ListToolbar`): the search, then
 * "Filtry", whose panel holds one field, the kind of venue. The search and the
 * kind narrow the venues, the map's pins and the upcoming events alike. The
 * line under the row is the census of the view on screen: the count the
 * caller passes, its quick filter, then a removable token for each filter in
 * use.
 * @module features/logistics/components/LocationsToolbar
 */

import React, { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

import type { LocationCategory } from "@/shared/types";
import { FilterTokens, type FilterToken } from "@/shared/ui/composites/FilterTokens";
import {
  ListToolbar,
  ToolbarPanel,
  ToolbarPanelButton,
  ToolbarPanelField,
} from "@/shared/ui/composites/ListToolbar";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";

import {
  getLocationCategoryOptions,
  LOCATION_CATEGORY_VALUES,
} from "../constants/locationCategories";

interface LocationsToolbarProps {
  readonly searchTerm: string;
  readonly onSearch: (value: string) => void;
  readonly categoryFilter: LocationCategory | "";
  readonly onCategory: (value: LocationCategory | "") => void;
  /** The view's count (`ListCensus`), first on the census line. */
  readonly census: React.ReactNode;
  /** `FilterToggle` chips, after the count. */
  readonly quickFilters?: React.ReactNode;
  readonly tokens: readonly FilterToken[];
  readonly onResetFilters: () => void;
}

const isCategory = (value: string): value is LocationCategory =>
  (LOCATION_CATEGORY_VALUES as readonly string[]).includes(value);

export const LocationsToolbar = ({
  searchTerm,
  onSearch,
  categoryFilter,
  onCategory,
  census,
  quickFilters,
  tokens,
  onResetFilters,
}: LocationsToolbarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const panelId = useId();
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(() => categoryFilter !== "");
  const categoryOptions = useMemo(
    () =>
      getLocationCategoryOptions(t).map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [t],
  );
  const categoryLabel = t("logistics.toolbar.category_label", "Rodzaj miejsca");
  const searchLabel = t("logistics.filters.search_placeholder", "Szukaj miejsca…");

  return (
    <ListToolbar
      search={
        <Input
          leftIcon={<Search size={16} aria-hidden="true" />}
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={searchTerm}
          onChange={(event) => onSearch(event.target.value)}
        />
      }
      controls={
        <ToolbarPanelButton
          label={t("logistics.toolbar.filters", "Filtry")}
          count={categoryFilter ? 1 : 0}
          open={isPanelOpen}
          onToggle={() => setIsPanelOpen((open) => !open)}
          panelId={panelId}
        />
      }
      census={
        <>
          {census}
          {quickFilters}
          <FilterTokens tokens={tokens} onClearAll={onResetFilters} className="contents" />
        </>
      }
    >
      <ToolbarPanel id={panelId} open={isPanelOpen} columns={1}>
        <ToolbarPanelField label={categoryLabel}>
          <Select
            value={categoryFilter}
            onValueChange={(value) => onCategory(isCategory(value) ? value : "")}
            placeholder={t("logistics.toolbar.category_all", "Wszystkie")}
            clearLabel={t("logistics.toolbar.category_all", "Wszystkie")}
            ariaLabel={categoryLabel}
            options={categoryOptions}
          />
        </ToolbarPanelField>
      </ToolbarPanel>
    </ListToolbar>
  );
};
