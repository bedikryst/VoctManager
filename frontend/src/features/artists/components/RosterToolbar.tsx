/**
 * @file RosterToolbar.tsx
 * @description Roster controls: name search, sort order, and a grid/list density
 * toggle. Deliberately mirrors the project dashboard control row so the gesture
 * vocabulary is identical across features.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/RosterToolbar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownUp, LayoutGrid, List, ListChecks, Search } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import type { RosterSort, RosterView } from "../hooks/useArtistData";

interface RosterToolbarProps {
  readonly searchTerm: string;
  readonly onSearch: (value: string) => void;
  readonly sortBy: RosterSort;
  readonly onSort: (value: RosterSort) => void;
  readonly viewMode: RosterView;
  readonly onViewMode: (value: RosterView) => void;
  readonly selectionMode: boolean;
  readonly onToggleSelectionMode: () => void;
}

const VIEW_OPTIONS = [
  { mode: "grid" as const, Icon: LayoutGrid, labelKey: "artists.toolbar.view_grid", fallback: "Siatka" },
  { mode: "list" as const, Icon: List, labelKey: "artists.toolbar.view_list", fallback: "Lista" },
];

export const RosterToolbar = ({
  searchTerm,
  onSearch,
  sortBy,
  onSort,
  viewMode,
  onViewMode,
  selectionMode,
  onToggleSelectionMode,
}: RosterToolbarProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex-1">
        <Input
          leftIcon={<Search size={16} />}
          type="search"
          aria-label={t("artists.dashboard.search_placeholder", "Szukaj po nazwisku...")}
          placeholder={t("artists.dashboard.search_placeholder", "Szukaj po nazwisku...")}
          value={searchTerm}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-pressed={selectionMode}
          onClick={onToggleSelectionMode}
          title={t("artists.toolbar.select_mode", "Zaznacz wielu")}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
            selectionMode
              ? "border-ethereal-gold/40 bg-ethereal-gold/[0.06] text-ethereal-ink"
              : "border-ethereal-incense/20 bg-ethereal-alabaster/70 text-ethereal-graphite hover:border-ethereal-gold/40 hover:text-ethereal-ink",
          )}
        >
          <ListChecks size={16} aria-hidden="true" />
          <span className="hidden sm:inline">
            {t("artists.toolbar.select_mode", "Zaznacz wielu")}
          </span>
        </button>

        <div className="w-full sm:w-56">
          <Select
            variant="solid"
            leftIcon={<ArrowDownUp />}
            aria-label={t("artists.toolbar.sort_label", "Sortuj")}
            value={sortBy}
            onChange={(event) => onSort(event.target.value as RosterSort)}
          >
            <option value="name">
              {t("artists.toolbar.sort_name", "Nazwisko (A–Z)")}
            </option>
            <option value="section">
              {t("artists.toolbar.sort_section", "Sekcja (SATB)")}
            </option>
            <option value="skill">
              {t("artists.toolbar.sort_skill", "Czytanie a vista")}
            </option>
          </Select>
        </div>

        <div
          role="group"
          aria-label={t("artists.toolbar.view_label", "Widok")}
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
    </div>
  );
};
