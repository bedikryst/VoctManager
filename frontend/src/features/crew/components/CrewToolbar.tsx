/**
 * @file CrewToolbar.tsx
 * @description The crew list's toolbar (`ListToolbar`): the search, then
 * "Filtry", whose panel holds the specialty, the company, the contact filter
 * and the order. The line under the row is the census: the count the caller
 * passes, the quick filter, then a removable token for each filter in use.
 *
 * Six specialties over a handful of people would make a tab row of zeros and
 * ones, so the specialty is a filter here, not the page's partition.
 * @module features/crew/components/CrewToolbar
 */

import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

import { FilterTokens, type FilterToken } from "@/shared/ui/composites/FilterTokens";
import {
  ListToolbar,
  ToolbarPanel,
  ToolbarPanelButton,
  ToolbarPanelField,
} from "@/shared/ui/composites/ListToolbar";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";

import type { CrewSpecialtyOption } from "../constants/crewSpecialties";
import { getContactFilterLabel, type CrewSort } from "../hooks/useCrewData";
import type { CrewContactCompleteness } from "../types/crew.dto";

interface CrewToolbarProps {
  readonly searchTerm: string;
  readonly onSearch: (value: string) => void;
  readonly specialtyOptions: readonly CrewSpecialtyOption[];
  readonly specialtyFilter: string;
  readonly onSpecialtyFilter: (value: string) => void;
  readonly availableCompanies: readonly string[];
  readonly companyFilter: string;
  readonly onCompanyFilter: (value: string) => void;
  readonly contactFilter: CrewContactCompleteness;
  readonly onContactFilter: (value: CrewContactCompleteness) => void;
  readonly sortBy: CrewSort;
  readonly onSort: (value: CrewSort) => void;
  /** The panel's filters in use, for the count on "Filtry". */
  readonly panelFilterCount: number;
  /** The list's count (`ListCensus`), first on the census line. */
  readonly census: React.ReactNode;
  /** `FilterToggle` chips, after the count. */
  readonly quickFilters?: React.ReactNode;
  readonly activeFilters: readonly FilterToken[];
  readonly onResetFilters: () => void;
}

const CONTACT_FILTERS: readonly Exclude<CrewContactCompleteness, "ALL">[] = [
  "WITH_EMAIL",
  "WITH_PHONE",
  "FULL_CONTACT",
];

const isContactFilter = (value: string): value is Exclude<CrewContactCompleteness, "ALL"> =>
  (CONTACT_FILTERS as readonly string[]).includes(value);

const isSort = (value: string): value is CrewSort =>
  value === "name" || value === "specialty" || value === "company";

export const CrewToolbar = ({
  searchTerm,
  onSearch,
  specialtyOptions,
  specialtyFilter,
  onSpecialtyFilter,
  availableCompanies,
  companyFilter,
  onCompanyFilter,
  contactFilter,
  onContactFilter,
  sortBy,
  onSort,
  panelFilterCount,
  census,
  quickFilters,
  activeFilters,
  onResetFilters,
}: CrewToolbarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const panelId = useId();
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  return (
    <ListToolbar
      search={
        <Input
          leftIcon={<Search size={16} aria-hidden="true" />}
          type="search"
          aria-label={t("crew.filters.search_label", "Wyszukiwanie")}
          placeholder={t("crew.filters.search_placeholder", "Szukaj osoby lub firmy…")}
          value={searchTerm}
          onChange={(event) => onSearch(event.target.value)}
        />
      }
      controls={
        <ToolbarPanelButton
          label={t("crew.toolbar.filters", "Filtry")}
          count={panelFilterCount}
          open={isPanelOpen}
          onToggle={() => setIsPanelOpen((open) => !open)}
          panelId={panelId}
        />
      }
      census={
        <>
          {census}
          {quickFilters}
          <FilterTokens tokens={[...activeFilters]} onClearAll={onResetFilters} className="contents" />
        </>
      }
    >
      <ToolbarPanel id={panelId} open={isPanelOpen} columns={4}>
        {/* An unset filter means "everything": that reading belongs on the
            placeholder, and the clear entry is the way back to it. */}
        <ToolbarPanelField label={t("crew.filters.specialty_label", "Specjalizacja")}>
          <Select
            value={specialtyFilter}
            onValueChange={onSpecialtyFilter}
            placeholder={t("crew.filters.all_specialties", "Wszystkie")}
            clearLabel={t("crew.filters.all_specialties", "Wszystkie")}
            ariaLabel={t("crew.filters.specialty_label", "Specjalizacja")}
            options={specialtyOptions.map((option) => ({ value: option.value, label: option.label }))}
          />
        </ToolbarPanelField>
        <ToolbarPanelField label={t("crew.filters.company_label", "Firma / Marka")}>
          <Select
            value={companyFilter}
            onValueChange={onCompanyFilter}
            disabled={availableCompanies.length === 0}
            placeholder={t("crew.filters.all_companies", "Wszystkie firmy")}
            clearLabel={t("crew.filters.all_companies", "Wszystkie firmy")}
            ariaLabel={t("crew.filters.company_label", "Firma / Marka")}
            options={availableCompanies.map((company) => ({ value: company, label: company }))}
          />
        </ToolbarPanelField>
        <ToolbarPanelField label={t("crew.filters.contact_label", "Stan kontaktu")}>
          <Select
            value={contactFilter === "ALL" ? "" : contactFilter}
            onValueChange={(value) => onContactFilter(isContactFilter(value) ? value : "ALL")}
            placeholder={t("crew.contact_filters.all", "Dowolny kontakt")}
            clearLabel={t("crew.contact_filters.all", "Dowolny kontakt")}
            ariaLabel={t("crew.filters.contact_label", "Stan kontaktu")}
            options={CONTACT_FILTERS.map((value) => ({ value, label: getContactFilterLabel(t, value) }))}
          />
        </ToolbarPanelField>
        <ToolbarPanelField label={t("crew.toolbar.sort_label", "Kolejność")}>
          <Select
            value={sortBy}
            onValueChange={(value) => {
              if (isSort(value)) onSort(value);
            }}
            ariaLabel={t("crew.toolbar.sort_label", "Kolejność")}
            options={[
              { value: "name", label: t("crew.toolbar.sort_name", "Nazwisko (A–Z)") },
              { value: "specialty", label: t("crew.toolbar.sort_specialty", "Specjalizacja") },
              { value: "company", label: t("crew.toolbar.sort_company", "Firma") },
            ]}
          />
        </ToolbarPanelField>
      </ToolbarPanel>
    </ListToolbar>
  );
};
