/**
 * @file BudgetTabs.tsx
 * @description The routed sub-navigation of the project's Budżet tab, on the
 * shared `RouteTabs` track: Przegląd, Kosztorys, Honoraria, Wydatki,
 * Finansowanie.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/BudgetTabs
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Landmark, LayoutDashboard, Receipt, Users } from "lucide-react";

import { RouteTabs, type RouteTabItem } from "@/shared/ui/composites/RouteTabs";

interface BudgetTabsProps {
  readonly projectId: string;
}

export const BudgetTabs = ({ projectId }: BudgetTabsProps): React.JSX.Element => {
  const { t } = useTranslation();
  const base = `/panel/projects/${projectId}/budget`;

  const tabs: RouteTabItem[] = [
    {
      to: base,
      label: t("finance.nav.overview", "Przegląd"),
      icon: <LayoutDashboard size={14} aria-hidden="true" />,
      end: true,
    },
    {
      to: `${base}/plan`,
      label: t("finance.nav.plan", "Kosztorys"),
      icon: <ClipboardList size={14} aria-hidden="true" />,
    },
    {
      to: `${base}/people`,
      label: t("finance.nav.people", "Honoraria"),
      icon: <Users size={14} aria-hidden="true" />,
    },
    {
      to: `${base}/costs`,
      label: t("finance.nav.costs", "Wydatki"),
      icon: <Receipt size={14} aria-hidden="true" />,
    },
    {
      to: `${base}/funding`,
      label: t("finance.nav.funding", "Finansowanie"),
      icon: <Landmark size={14} aria-hidden="true" />,
    },
  ];

  return (
    <RouteTabs
      items={tabs}
      ariaLabel={t("finance.nav.aria", "Sekcje budżetu")}
      className="max-w-full sm:w-max"
    />
  );
};
