/**
 * @file ProjectTabs.tsx
 * @description Per-project sub-navigation for the Project Hub. Replaces the
 * in-modal tablist of the old slide-over panel with real, deep-linkable routes
 * under `/panel/projects/:id/*`. Horizontally scrollable so all work areas stay
 * reachable on narrow viewports.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ProjectTabs
 */

import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Banknote,
  Briefcase,
  Calendar1,
  Grid,
  LayoutDashboard,
  ListOrdered,
  MicVocal,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

interface ProjectTabsProps {
  readonly projectId: string;
  readonly className?: string;
}

interface TabDef {
  readonly segment: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  /** Marks the index route so it is only active on the exact hub root. */
  readonly end?: boolean;
}

export const ProjectTabs = ({
  projectId,
  className,
}: ProjectTabsProps): React.JSX.Element => {
  const { t } = useTranslation();
  const base = `/panel/projects/${projectId}`;

  const tabs: TabDef[] = [
    {
      segment: "",
      label: t("projects.hub.tabs.overview", "Przegląd"),
      icon: <LayoutDashboard size={14} aria-hidden="true" />,
      end: true,
    },
    {
      segment: "details",
      label: t("projects.editor.tabs.details", "Szczegóły"),
      icon: <Briefcase size={14} aria-hidden="true" />,
    },
    {
      segment: "program",
      label: t("projects.editor.tabs.program", "Program"),
      icon: <ListOrdered size={14} aria-hidden="true" />,
    },
    {
      segment: "cast",
      label: t("projects.editor.tabs.cast", "Obsada"),
      icon: <Users size={14} aria-hidden="true" />,
    },
    {
      segment: "divisi",
      label: t("projects.editor.tabs.divisi", "Divisi"),
      icon: <MicVocal size={14} aria-hidden="true" />,
    },
    {
      segment: "rehearsals",
      label: t("projects.editor.tabs.rehearsals", "Próby"),
      icon: <Calendar1 size={14} aria-hidden="true" />,
    },
    {
      segment: "attendance",
      label: t("projects.editor.tabs.matrix", "Frekwencja"),
      icon: <Grid size={14} aria-hidden="true" />,
    },
    {
      segment: "crew",
      label: t("projects.editor.tabs.crew", "Ekipa"),
      icon: <Wrench size={14} aria-hidden="true" />,
    },
    {
      segment: "budget",
      label: t("projects.editor.tabs.budget", "Budżet"),
      icon: <Banknote size={14} aria-hidden="true" />,
    },
  ];

  return (
    <nav
      aria-label={t("projects.hub.tabs_aria", "Sekcje projektu")}
      className={cn(
        "flex gap-1 overflow-x-auto rounded-2xl border border-ethereal-ink/6 bg-ethereal-marble/55 p-1.5 shadow-glass-solid backdrop-blur-md no-scrollbar",
        className,
      )}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.segment || "overview"}
          to={tab.segment ? `${base}/${tab.segment}` : base}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              isActive
                ? "bg-ethereal-marble text-ethereal-ink shadow-[0_1px_3px_rgba(0,0,0,0.07),0_1px_1px_rgba(194,168,120,0.14)]"
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
              <Text
                as="span"
                className="truncate text-[11px] font-bold uppercase tracking-wider text-inherit"
              >
                {tab.label}
              </Text>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
