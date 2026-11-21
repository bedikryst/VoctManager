/**
 * @file ArchiveTabs.tsx
 * @description The library's two routed sections, pieces and composers, as
 * one underline tab row under the header of both pages, so the conductor can
 * flip between them without navigating up and back.
 * @module features/archive/components/ArchiveTabs
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { RouteTabs, type RouteTabItem } from "@/shared/ui/composites/RouteTabs";

interface ArchiveTabsProps {
  readonly className?: string;
}

export const ArchiveTabs = ({ className }: ArchiveTabsProps): React.JSX.Element => {
  const { t } = useTranslation();

  const items: readonly RouteTabItem[] = [
    {
      to: "/panel/archive-management",
      label: t("archive.tabs.pieces", "Utwory"),
      end: true,
    },
    {
      to: "/panel/archive-management/composers",
      label: t("archive.tabs.composers", "Kompozytorzy"),
    },
  ];

  return (
    <RouteTabs
      variant="underline"
      items={items}
      ariaLabel={t("archive.tabs.aria", "Sekcje archiwum")}
      className={className}
    />
  );
};
