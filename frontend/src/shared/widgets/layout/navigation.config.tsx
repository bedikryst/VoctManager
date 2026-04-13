/**
 * @file navigation.config.tsx
 * @description Centralized routing configuration for the authenticated dashboard.
 * Separated strictly into structural logic without UI rendering components.
 * @module shared/widgets/layout/navigation.config
 */

import React from "react";
import {
  Briefcase,
  Calendar,
  CalendarCheck,
  FileText,
  FolderOpen,
  Headphones,
  LayoutDashboard,
  Music,
  Users,
  Wrench,
  MapPin,
} from "lucide-react";

// Dummy function to mark keys for i18next extraction
const t = (key: string): string => key;

export interface NavLinkItem {
  to: string;
  labelKey: string;
  icon: React.ReactElement<{ className?: string; size?: number }>;
}

export interface NavGroup {
  labelKey: string;
  links: NavLinkItem[];
}

export const adminNavGroups: NavGroup[] = [
  {
    labelKey: t("dashboard.layout.groups.overview"),
    links: [
      {
        to: "/panel",
        icon: <LayoutDashboard size={18} />,
        labelKey: t("dashboard.layout.links.admin_dashboard"),
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.production"),
    links: [
      {
        to: "/panel/projects",
        icon: <Briefcase size={18} />,
        labelKey: t("dashboard.layout.links.projects"),
      },
      {
        to: "/panel/rehearsals",
        icon: <CalendarCheck size={18} />,
        labelKey: t("dashboard.layout.links.attendance"),
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.logistics"),
    links: [
      {
        to: "/panel/locations",
        icon: <MapPin size={18} />,
        labelKey: t("dashboard.layout.links.locations"),
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.data_admin"),
    links: [
      {
        to: "/panel/artists",
        icon: <Users size={18} />,
        labelKey: t("dashboard.layout.links.artists"),
      },
      {
        to: "/panel/crew",
        icon: <Wrench size={18} />,
        labelKey: t("dashboard.layout.links.crew"),
      },
      {
        to: "/panel/contracts",
        icon: <FileText size={18} />,
        labelKey: t("dashboard.layout.links.contracts"),
      },
      {
        to: "/panel/archive-management",
        icon: <Music size={18} />,
        labelKey: t("dashboard.layout.links.archive"),
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.artist_zone"),
    links: [
      {
        to: "/panel/schedule",
        icon: <Calendar size={18} />,
        labelKey: t("dashboard.layout.links.schedule"),
      },
      {
        to: "/panel/materials",
        icon: <Headphones size={18} />,
        labelKey: t("dashboard.layout.links.materials"),
      },
      {
        to: "/panel/resources",
        icon: <FolderOpen size={18} />,
        labelKey: t("dashboard.layout.links.resources"),
      },
    ],
  },
];

export const artistNavGroups: NavGroup[] = [
  {
    labelKey: t("dashboard.layout.groups.overview"),
    links: [
      {
        to: "/panel",
        icon: <LayoutDashboard size={18} />,
        labelKey: t("dashboard.layout.links.artist_dashboard"),
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.my_zone"),
    links: [
      {
        to: "/panel/schedule",
        icon: <Calendar size={18} />,
        labelKey: t("dashboard.layout.links.schedule"),
      },
      {
        to: "/panel/materials",
        icon: <Headphones size={18} />,
        labelKey: t("dashboard.layout.links.materials"),
      },
      {
        to: "/panel/resources",
        icon: <FolderOpen size={18} />,
        labelKey: t("dashboard.layout.links.resources"),
      },
    ],
  },
];
