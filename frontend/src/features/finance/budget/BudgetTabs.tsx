/**
 * @file BudgetTabs.tsx
 * @description The routed sub-navigation of the project's Budżet tab — the
 * `ArchiveTabs` recipe, because it switches between routes, not between local
 * views. A sub-tab appears in the stage that builds it; there are no
 * placeholder tabs for the plan, expenses or funding.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/BudgetTabs
 */

import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Users } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

interface BudgetTabsProps {
  readonly projectId: string;
}

interface BudgetTabDef {
  readonly to: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly end?: boolean;
}

export const BudgetTabs = ({ projectId }: BudgetTabsProps): React.JSX.Element => {
  const { t } = useTranslation();
  const base = `/panel/projects/${projectId}/budget`;

  const tabs: BudgetTabDef[] = [
    {
      to: base,
      label: t("finance.nav.overview", "Przegląd"),
      icon: <LayoutDashboard size={14} aria-hidden="true" />,
      end: true,
    },
    {
      to: `${base}/people`,
      label: t("finance.nav.people", "Honoraria"),
      icon: <Users size={14} aria-hidden="true" />,
    },
  ];

  return (
    <nav
      aria-label={t("finance.nav.aria", "Sekcje budżetu")}
      className="flex w-max gap-1 rounded-nested border border-hairline bg-ethereal-marble/55 p-1.5 shadow-glass-solid backdrop-blur-md"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-control px-3.5 py-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              isActive
                ? "bg-ethereal-marble text-ethereal-ink shadow-[0_1px_3px_var(--glass-contact),0_1px_1px_rgba(194,168,120,0.14)]"
                : "text-ethereal-graphite/65 hover:bg-ethereal-marble/60 hover:text-ethereal-ink",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "shrink-0 transition-colors",
                  isActive ? "text-ethereal-gold" : "text-ethereal-graphite/50",
                )}
                aria-hidden="true"
              >
                {tab.icon}
              </span>
              <Eyebrow color="inherit" className="truncate">
                {tab.label}
              </Eyebrow>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
