/**
 * @file ArchiveTabs.tsx
 * @description Top-level toggle between the two Archive surfaces:
 * `Utwory` (pieces list) and `Kompozytorzy` (composers list). Rendered
 * under the PageHeader of both pages so the conductor can flip without
 * navigating up and back.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ArchiveTabs
 */

import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Music, Users } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

interface ArchiveTabsProps {
  readonly className?: string;
}

interface ArchiveTabDef {
  readonly to: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  /** Marks the index route so it is only active on the exact list root. */
  readonly end?: boolean;
}

export const ArchiveTabs = ({
  className,
}: ArchiveTabsProps): React.JSX.Element => {
  const { t } = useTranslation();

  const tabs: ArchiveTabDef[] = [
    {
      to: "/panel/archive-management",
      label: t("archive.tabs.pieces", "Utwory"),
      icon: <Music size={14} aria-hidden="true" />,
      end: true,
    },
    {
      to: "/panel/archive-management/composers",
      label: t("archive.tabs.composers", "Kompozytorzy"),
      icon: <Users size={14} aria-hidden="true" />,
    },
  ];

  return (
    <nav
      aria-label={t("archive.tabs.aria", "Sekcje archiwum")}
      className={cn(
        "flex w-max gap-1 rounded-nested border border-hairline bg-ethereal-marble/55 p-1.5 shadow-glass-solid backdrop-blur-md",
        className,
      )}
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
