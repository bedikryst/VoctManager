/**
 * @file dashboard.config.tsx
 * @description Centralized navigation schema for the authenticated Dashboard.
 * Implements RBAC-ready structures, i18next marking, and Bento Grid kinematics.
 * @module shared/config/navigation/dashboard
 * @architecture Enterprise SaaS 2026
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

// Marker for i18next-parser to extract keys (and optionally default values)
const t = (key: string, defaultValue?: string): string => key;

export interface NavLinkItem {
  to: string;
  labelKey: string;
  icon: React.ReactElement<{ className?: string; size?: number }>;
}

export interface NavGroup {
  labelKey: string;
  links: NavLinkItem[];
}

export interface BentoDirectiveFeature {
  labelKey: string;
  defaultLabel: string;
}

export interface BentoDirective {
  id: string;
  romanNumeral: string;
  titleKey: string;
  defaultTitle: string;
  features: BentoDirectiveFeature[];
  accentClass: string;
  path: string;
  gridClass: string;
}

// ----------------------------------------------------------------------
// 1. STANDARD NAVIGATION (Sidebar / Navbar)
// ----------------------------------------------------------------------

export interface NavLinkItem {
  to: string;
  labelKey: string;
  icon: React.ReactElement<{ className?: string; size?: number }>;
}

export interface NavGroup {
  labelKey: string;
  links: NavLinkItem[];
}

export const ADMIN_NAV_GROUPS: readonly NavGroup[] = [
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
] as const;

export const ARTIST_NAV_GROUPS: readonly NavGroup[] = [
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
] as const;

// ----------------------------------------------------------------------
// 2. DASHBOARD BENTO DIRECTIVES (Admin Home)
// ----------------------------------------------------------------------

export const ADMIN_BENTO_DIRECTIVES: readonly BentoDirective[] = [
  {
    id: "projects",
    romanNumeral: "I",
    titleKey: t("dashboard.admin.modules.projects_title", "Projekty"),
    defaultTitle: "Projekty",
    features: [
      {
        labelKey: t("dashboard.admin.features.schedules", "Harmonogramy"),
        defaultLabel: "Harmonogramy",
      },
      {
        labelKey: t("dashboard.admin.features.setlists", "Setlisty"),
        defaultLabel: "Setlisty",
      },
    ],
    accentClass: "bg-ethereal-gold",
    path: "/panel/projects",
    gridClass: "md:col-span-2 md:row-span-2", // The Dominant Anchor
  },
  {
    id: "logistics",
    romanNumeral: "II",
    titleKey: t("dashboard.admin.modules.logistics_title", "Logistyka"),
    defaultTitle: "Logistyka",
    features: [
      {
        labelKey: t("dashboard.admin.features.locations", "Lokacje"),
        defaultLabel: "Lokacje",
      },
      {
        labelKey: t("dashboard.admin.features.transport", "Transport"),
        defaultLabel: "Transport",
      },
    ],
    accentClass: "bg-ethereal-sage",
    path: "/panel/locations",
    gridClass: "md:col-span-2 md:row-span-1",
  },
  {
    id: "archive",
    romanNumeral: "III",
    titleKey: t("dashboard.admin.modules.archive_title", "Archiwum"),
    defaultTitle: "Archiwum",
    features: [
      {
        labelKey: t("dashboard.admin.features.pdf_scores", "Nuty PDF"),
        defaultLabel: "Nuty PDF",
      },
      {
        labelKey: t("dashboard.admin.features.audio", "Audio ref."),
        defaultLabel: "Audio ref.",
      },
    ],
    accentClass: "bg-ethereal-incense",
    path: "/panel/archive-management",
    gridClass: "md:col-span-1 md:row-span-1",
  },
  {
    id: "artists",
    romanNumeral: "IV",
    titleKey: t("dashboard.admin.modules.artists_title", "Artyści"),
    defaultTitle: "Artyści",
    features: [
      {
        labelKey: t("dashboard.admin.features.satb", "SATB"),
        defaultLabel: "SATB",
      },
      {
        labelKey: t("dashboard.admin.features.profiles", "Profile"),
        defaultLabel: "Profile",
      },
    ],
    accentClass: "bg-ethereal-amethyst",
    path: "/panel/artists",
    gridClass: "md:col-span-1 md:row-span-1",
  },
  {
    id: "contracts",
    romanNumeral: "V",
    titleKey: t("dashboard.admin.modules.contracts_title", "Finanse"),
    defaultTitle: "Finanse",
    features: [
      {
        labelKey: t("dashboard.admin.features.rates", "Stawki"),
        defaultLabel: "Stawki",
      },
      {
        labelKey: t("dashboard.admin.features.budget", "Budżet"),
        defaultLabel: "Budżet",
      },
    ],
    accentClass: "bg-ethereal-graphite",
    path: "/panel/contracts",
    gridClass: "md:col-span-2 md:row-span-1",
  },
  {
    id: "crew",
    romanNumeral: "VI",
    titleKey: t("dashboard.admin.modules.crew_title", "Technika"),
    defaultTitle: "Technika",
    features: [
      {
        labelKey: t("dashboard.admin.features.sound", "Dźwięk & Światło"),
        defaultLabel: "Dźwięk & Światło",
      },
      {
        labelKey: t("dashboard.admin.features.vendors", "Podwykonawcy"),
        defaultLabel: "Podwykonawcy",
      },
    ],
    accentClass: "bg-ethereal-ink",
    path: "/panel/crew",
    gridClass: "md:col-span-2 md:row-span-1",
  },
];
