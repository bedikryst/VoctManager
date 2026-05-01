/**
 * @file CrewFiltersPanel.tsx
 * @description Centralised filter surface for the crew dashboard.
 * Owns inputs, active-filter chips, and result summary while staying decoupled
 * from business state — every value flows in/out through declarative props.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewFiltersPanel
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Filter,
  PhoneCall,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkle,
  X,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Text } from "@/shared/ui/primitives/typography";

import type { CrewSpecialtyOption } from "../constants/crewSpecialties";
import type {
  CrewActiveFilter,
} from "../hooks/useCrewData";
import type { CrewContactCompleteness } from "../types/crew.dto";

interface CrewFiltersPanelProps {
  searchTerm: string;
  specialtyFilter: string;
  companyFilter: string;
  contactFilter: CrewContactCompleteness;
  specialtyOptions: CrewSpecialtyOption[];
  availableCompanies: string[];
  hasActiveFilters: boolean;
  activeFilterCount: number;
  activeFilters: CrewActiveFilter[];
  visibleCount: number;
  totalCount: number;
  onSearchTermChange: (value: string) => void;
  onSpecialtyFilterChange: (value: string) => void;
  onCompanyFilterChange: (value: string) => void;
  onContactFilterChange: (value: CrewContactCompleteness) => void;
  onResetFilters: () => void;
}

const CONTACT_OPTIONS: ReadonlyArray<{
  value: CrewContactCompleteness;
  labelKey: string;
  defaultLabel: string;
}> = [
  {
    value: "ALL",
    labelKey: "crew.contact_filters.all",
    defaultLabel: "Dowolny kontakt",
  },
  {
    value: "WITH_EMAIL",
    labelKey: "crew.contact_filters.with_email",
    defaultLabel: "Z e-mailem",
  },
  {
    value: "WITH_PHONE",
    labelKey: "crew.contact_filters.with_phone",
    defaultLabel: "Z telefonem",
  },
  {
    value: "FULL_CONTACT",
    labelKey: "crew.contact_filters.full_contact",
    defaultLabel: "Pełny kontakt",
  },
  {
    value: "MISSING_CONTACT",
    labelKey: "crew.contact_filters.missing_contact",
    defaultLabel: "Niekompletny kontakt",
  },
];

export function CrewFiltersPanel({
  searchTerm,
  specialtyFilter,
  companyFilter,
  contactFilter,
  specialtyOptions,
  availableCompanies,
  hasActiveFilters,
  activeFilterCount,
  activeFilters,
  visibleCount,
  totalCount,
  onSearchTermChange,
  onSpecialtyFilterChange,
  onCompanyFilterChange,
  onContactFilterChange,
  onResetFilters,
}: CrewFiltersPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <GlassCard
      variant="ethereal"
      padding="md"
      isHoverable={false}
      className="border border-ethereal-incense/20"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Badge variant="outline" icon={<SlidersHorizontal size={12} />}>
            {t("crew.filters.heading", "Filtry Ekipy")}
          </Badge>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="glass" icon={<Filter size={12} />}>
              {hasActiveFilters
                ? t("crew.filters.active_filters", {
                    count: activeFilterCount,
                    defaultValue: "{{count}} aktywne filtry",
                  })
                : t("crew.filters.no_active_filters", "Brak aktywnych filtrów")}
            </Badge>
            {hasActiveFilters && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onResetFilters}
                leftIcon={<RotateCcw size={14} aria-hidden="true" />}
              >
                {t("crew.filters.clear_filters", "Wyczyść filtry")}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label={t("crew.filters.search_label", "Wyszukiwanie")}
            leftIcon={<Search size={16} aria-hidden="true" />}
            type="search"
            placeholder={t(
              "crew.filters.search_placeholder",
              "Szukaj po nazwisku, firmie lub e-mailu...",
            )}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />

          <Select
            label={t("crew.filters.specialty_label", "Specjalizacja")}
            leftIcon={<Sparkle size={16} aria-hidden="true" />}
            value={specialtyFilter}
            onChange={(event) => onSpecialtyFilterChange(event.target.value)}
          >
            <option value="">
              {t("crew.filters.all_specialties", "Wszystkie specjalizacje")}
            </option>
            {specialtyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select
            label={t("crew.filters.company_label", "Firma / Marka")}
            leftIcon={<Building2 size={16} aria-hidden="true" />}
            value={companyFilter}
            onChange={(event) => onCompanyFilterChange(event.target.value)}
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
            label={t("crew.filters.contact_label", "Stan kontaktu")}
            leftIcon={<PhoneCall size={16} aria-hidden="true" />}
            value={contactFilter}
            onChange={(event) =>
              onContactFilterChange(
                event.target.value as CrewContactCompleteness,
              )
            }
          >
            {CONTACT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey, option.defaultLabel)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-3 border-t border-ethereal-incense/15 pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div aria-live="polite">
              <Text size="sm" color="graphite">
                {t("crew.filters.summary", {
                  visible: visibleCount,
                  total: totalCount,
                  defaultValue:
                    "{{visible}} z {{total}} osób w aktualnym widoku.",
                })}
              </Text>
            </div>
            {hasActiveFilters && (
              <Text size="sm" color="graphite">
                {t(
                  "crew.filters.active_description",
                  "Kliknij filtr, aby usunąć go bez resetowania całego widoku.",
                )}
              </Text>
            )}
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  onClick={token.clear}
                  className="inline-flex items-center gap-2 rounded-full border border-ethereal-incense/20 bg-ethereal-alabaster/70 px-3 py-1.5 text-[11px] font-medium text-ethereal-graphite transition-colors hover:border-ethereal-gold/35 hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/30"
                >
                  <span>{token.label}</span>
                  <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <Text size="sm" color="graphite">
              {t(
                "crew.filters.no_filters_message",
                "Brak aktywnych filtrów. Widok pokazuje pełną bazę współpracowników.",
              )}
            </Text>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
