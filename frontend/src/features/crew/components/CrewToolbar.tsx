/**
 * @file CrewToolbar.tsx
 * @description Compact crew controls — search, company + contact-completeness
 * filters, sort order, and a grid/list density toggle. Mirrors the artists'
 * RosterToolbar; the specialty filter lives in the balance bar above.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewToolbar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownUp,
  Building2,
  LayoutGrid,
  List,
  PhoneCall,
  Search,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import type { CrewContactCompleteness } from "../types/crew.dto";
import type { CrewSort, CrewView } from "../hooks/useCrewData";

interface CrewToolbarProps {
  searchTerm: string;
  onSearch: (value: string) => void;
  companyFilter: string;
  onCompanyFilter: (value: string) => void;
  availableCompanies: string[];
  contactFilter: CrewContactCompleteness;
  onContactFilter: (value: CrewContactCompleteness) => void;
  sortBy: CrewSort;
  onSort: (value: CrewSort) => void;
  viewMode: CrewView;
  onViewMode: (value: CrewView) => void;
}

const CONTACT_OPTIONS: ReadonlyArray<{
  value: CrewContactCompleteness;
  labelKey: string;
  defaultLabel: string;
}> = [
  { value: "ALL", labelKey: "crew.contact_filters.all", defaultLabel: "Dowolny kontakt" },
  { value: "WITH_EMAIL", labelKey: "crew.contact_filters.with_email", defaultLabel: "Z e-mailem" },
  { value: "WITH_PHONE", labelKey: "crew.contact_filters.with_phone", defaultLabel: "Z telefonem" },
  { value: "FULL_CONTACT", labelKey: "crew.contact_filters.full_contact", defaultLabel: "Pełny kontakt" },
  { value: "MISSING_CONTACT", labelKey: "crew.contact_filters.missing_contact", defaultLabel: "Niekompletny kontakt" },
];

const VIEW_OPTIONS = [
  { mode: "grid" as const, Icon: LayoutGrid, labelKey: "crew.toolbar.view_grid", fallback: "Siatka" },
  { mode: "list" as const, Icon: List, labelKey: "crew.toolbar.view_list", fallback: "Lista" },
];

export const CrewToolbar = ({
  searchTerm,
  onSearch,
  companyFilter,
  onCompanyFilter,
  availableCompanies,
  contactFilter,
  onContactFilter,
  sortBy,
  onSort,
  viewMode,
  onViewMode,
}: CrewToolbarProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            leftIcon={<Search size={16} />}
            type="search"
            aria-label={t("crew.filters.search_label", "Wyszukiwanie")}
            placeholder={t(
              "crew.filters.search_placeholder",
              "Szukaj po nazwisku, firmie lub e-mailu...",
            )}
            value={searchTerm}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>

        <div
          role="group"
          aria-label={t("crew.toolbar.view_label", "Widok")}
          className="inline-flex shrink-0 gap-1 rounded-xl border border-ethereal-ink/8 bg-ethereal-alabaster/70 p-1"
        >
          {VIEW_OPTIONS.map(({ mode, Icon, labelKey, fallback }) => {
            const isActive = viewMode === mode;
            const label = t(labelKey, fallback);
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={isActive}
                title={label}
                aria-label={label}
                onClick={() => onViewMode(mode)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                  isActive
                    ? "bg-ethereal-gold text-ethereal-ink shadow-sm"
                    : "text-ethereal-graphite hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink",
                )}
              >
                <Icon size={16} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          variant="solid"
          leftIcon={<Building2 />}
          aria-label={t("crew.filters.company_label", "Firma / Marka")}
          value={companyFilter}
          onChange={(event) => onCompanyFilter(event.target.value)}
          disabled={availableCompanies.length === 0}
        >
          <option value="">
            {t("crew.filters.all_companies", "Wszystkie firmy")}
          </option>
          {availableCompanies.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </Select>

        <Select
          variant="solid"
          leftIcon={<PhoneCall />}
          aria-label={t("crew.filters.contact_label", "Stan kontaktu")}
          value={contactFilter}
          onChange={(event) =>
            onContactFilter(event.target.value as CrewContactCompleteness)
          }
        >
          {CONTACT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey, option.defaultLabel)}
            </option>
          ))}
        </Select>

        <Select
          variant="solid"
          leftIcon={<ArrowDownUp />}
          aria-label={t("crew.toolbar.sort_label", "Sortuj")}
          value={sortBy}
          onChange={(event) => onSort(event.target.value as CrewSort)}
        >
          <option value="name">
            {t("crew.toolbar.sort_name", "Nazwisko (A–Z)")}
          </option>
          <option value="specialty">
            {t("crew.toolbar.sort_specialty", "Specjalizacja")}
          </option>
          <option value="company">
            {t("crew.toolbar.sort_company", "Firma")}
          </option>
        </Select>
      </div>
    </div>
  );
};
