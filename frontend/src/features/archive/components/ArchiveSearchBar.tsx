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
import { ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

import type { Composer } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

export interface ArchiveActiveFilter {
  id: string;
  label: string;
  clear: () => void;
}

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
          <button
            type="button"
            onClick={() => setIsAdvancedOpen((open) => !open)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors",
              activeFilterCount > 0
                ? "border-ethereal-gold/40 bg-ethereal-gold/10 text-ethereal-gold"
                : "border-ethereal-incense/25 bg-ethereal-alabaster/60 text-ethereal-graphite hover:border-ethereal-gold/30 hover:text-ethereal-ink",
            )}
            aria-expanded={isAdvancedOpen}
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            {t("archive.search.filters_btn", "Filtry")}
            {activeFilterCount > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ethereal-gold px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={13}
              aria-hidden="true"
              className={cn("transition-transform", isAdvancedOpen && "rotate-180")}
            />
          </button>
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
            <div className="grid gap-3 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/40 p-3 md:grid-cols-3">
              <div>
                <Eyebrow color="muted" size="caption" className="mb-1 ml-1 block">
                  {t("archive.search.composer", "Kompozytor")}
                </Eyebrow>
                <Select
                  value={composerFilter}
                  onChange={(event) => onComposerFilterChange(event.target.value)}
                >
                  <option value="">
                    {t("archive.search.all_composers", "Wszyscy")}
                  </option>
                  {composers.map((composer) => (
                    <option key={composer.id} value={composer.id}>
                      {composer.last_name} {composer.first_name || ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Eyebrow color="muted" size="caption" className="mb-1 ml-1 block">
                  {t("archive.search.epoch", "Epoka")}
                </Eyebrow>
                <Select
                  value={epochFilter}
                  onChange={(event) => onEpochFilterChange(event.target.value)}
                >
                  <option value="">
                    {t("archive.search.all_epochs", "Wszystkie")}
                  </option>
                  {epochOptions.map((epoch) => (
                    <option key={epoch.value} value={epoch.value}>
                      {epoch.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Eyebrow color="muted" size="caption" className="mb-1 ml-1 block">
                  {t("archive.search.voicing", "Obsada")}
                </Eyebrow>
                <Select
                  value={voicingFilter}
                  onChange={(event) => onVoicingFilterChange(event.target.value)}
                >
                  <option value="">
                    {t("archive.search.all_voicings", "Wszystkie")}
                  </option>
                  {availableVoicings.map((voicing) => (
                    <option key={voicing} value={voicing}>
                      {voicing}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter chips — total/visible counts live in the header stat strip */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Caption color="muted">
            {t("archive.search.summary_filtered", "{{visible}} z {{total}}", {
              visible: visibleCount,
              total: totalCount,
            })}
          </Caption>
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map((filterToken) => (
              <button
                key={filterToken.id}
                type="button"
                onClick={filterToken.clear}
                className="inline-flex items-center gap-1.5 rounded-full border border-ethereal-incense/25 bg-ethereal-alabaster/70 px-2.5 py-0.5 text-[11px] text-ethereal-graphite transition-colors hover:border-ethereal-gold/40 hover:text-ethereal-ink"
              >
                <span>{filterToken.label}</span>
                <X size={10} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
