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
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/shared/ui/composites/SegmentedTabs";
import { Button } from "@/shared/ui/primitives/Button";
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

  const viewItems: SegmentedTabItem<RosterView>[] = [
    { id: "grid", label: t("artists.toolbar.view_grid", "Siatka"), Icon: LayoutGrid },
    { id: "list", label: t("artists.toolbar.view_list", "Lista"), Icon: List },
  ];

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
        <Button
          variant={selectionMode ? "secondary" : "outline"}
          aria-pressed={selectionMode}
          onClick={onToggleSelectionMode}
          title={t("artists.toolbar.select_mode", "Zaznacz wielu")}
          aria-label={t("artists.toolbar.select_mode", "Zaznacz wielu")}
          leftIcon={<ListChecks size={16} aria-hidden="true" />}
          className={cn(
            "shrink-0",
            selectionMode && "border-ethereal-gold/40 text-ethereal-ink",
          )}
        >
          <span className="hidden sm:inline">
            {t("artists.toolbar.select_mode", "Zaznacz wielu")}
          </span>
        </Button>

        <div className="w-full sm:w-56">
          <Select
            variant="solid"
            leftIcon={<ArrowDownUp />}
            ariaLabel={t("artists.toolbar.sort_label", "Sortuj")}
            value={sortBy}
            onValueChange={(value) => onSort(value as RosterSort)}
            options={[
              {
                value: "name",
                label: t("artists.toolbar.sort_name", "Nazwisko (A–Z)"),
              },
              {
                value: "section",
                label: t("artists.toolbar.sort_section", "Sekcja (SATB)"),
              },
              {
                value: "skill",
                label: t("artists.toolbar.sort_skill", "Czytanie a vista"),
              },
            ]}
          />
        </div>

        <SegmentedTabs
          items={viewItems}
          value={viewMode}
          onChange={onViewMode}
          ariaLabel={t("artists.toolbar.view_label", "Widok")}
          className="shrink-0"
          iconOnly
        />
      </div>
    </div>
  );
};
