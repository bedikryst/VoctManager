/**
 * @file dashboard.config.tsx
 * @description Centralised navigation schema for the authenticated Dashboard.
 * Implements strict RBAC structures, i18next extraction marking, and pure component references
 * to ensure zero Layout Projection warping and flawless React rendering cycles.
 * @module shared/config/navigation/dashboard
 * @architecture Enterprise SaaS 2026
 */

import {
  Briefcase,
  Calendar,
  CalendarCheck,
  FileText,
  BookMarked,
  Headphones,
  LayoutDashboard,
  MessageCircle,
  Music,
  Users,
  Wrench,
  MapPin,
  type LucideIcon,
} from "lucide-react";

// Marker for i18next-parser to extract keys (and optionally default values).
// This remains a pure utility function.
const t = (key: string, _defaultValue?: string): string => key;

// ----------------------------------------------------------------------
// 1. CORE INTERFACES (Strict TypeScript 7.0 Protocols)
// ----------------------------------------------------------------------

export interface NavLinkItem {
  readonly to: string;
  readonly labelKey: string;
  // Crucial paradigm shift: We store the reference, not the instance.
  readonly icon: LucideIcon;
  readonly isPinned: boolean;
}

export interface NavGroup {
  readonly labelKey: string;
  readonly links: readonly NavLinkItem[];
}

// ----------------------------------------------------------------------
// 2. STANDARD NAVIGATION (Sidebar / Mobile Command Centre)
// ----------------------------------------------------------------------

export const ADMIN_NAV_GROUPS: readonly NavGroup[] = [
  {
    labelKey: t("dashboard.layout.groups.overview"),
    links: [
      {
        to: "/panel",
        icon: LayoutDashboard,
        labelKey: t("dashboard.layout.links.admin_dashboard"),
        isPinned: true,
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.production"),
    links: [
      {
        to: "/panel/projects",
        icon: Briefcase,
        labelKey: t("dashboard.layout.links.projects"),
        isPinned: true,
      },
      {
        to: "/panel/rehearsals",
        icon: CalendarCheck,
        labelKey: t("dashboard.layout.links.attendance"),
        isPinned: true,
      },
      {
        to: "/panel/messages",
        icon: MessageCircle,
        labelKey: t("dashboard.layout.links.messages"),
        isPinned: true,
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.logistics"),
    links: [
      {
        to: "/panel/locations",
        icon: MapPin,
        labelKey: t("dashboard.layout.links.locations"),
        isPinned: false,
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.data_admin"),
    links: [
      {
        to: "/panel/artists",
        icon: Users,
        labelKey: t("dashboard.layout.links.artists"),
        isPinned: false,
      },
      {
        to: "/panel/crew",
        icon: Wrench,
        labelKey: t("dashboard.layout.links.crew"),
        isPinned: false,
      },
      {
        to: "/panel/contracts",
        icon: FileText,
        labelKey: t("dashboard.layout.links.contracts"),
        isPinned: false,
      },
      {
        to: "/panel/archive-management",
        icon: Music,
        labelKey: t("dashboard.layout.links.archive"),
        isPinned: true,
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.artist_zone"),
    links: [
      {
        to: "/panel/schedule",
        icon: Calendar,
        labelKey: t("dashboard.layout.links.schedule"),
        isPinned: false,
      },
      {
        to: "/panel/materials",
        icon: Headphones,
        labelKey: t("dashboard.layout.links.materials"),
        isPinned: false,
      },
      {
        to: "/panel/resources",
        icon: BookMarked,
        labelKey: t("dashboard.layout.links.resources"),
        isPinned: false,
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
        icon: LayoutDashboard,
        labelKey: t("dashboard.layout.links.artist_dashboard"),
        isPinned: true,
      },
    ],
  },
  {
    labelKey: t("dashboard.layout.groups.my_zone"),
    links: [
      {
        to: "/panel/messages",
        icon: MessageCircle,
        labelKey: t("dashboard.layout.links.messages"),
        isPinned: true,
      },
      {
        to: "/panel/schedule",
        icon: Calendar,
        labelKey: t("dashboard.layout.links.schedule"),
        isPinned: true,
      },
      {
        to: "/panel/materials",
        icon: Headphones,
        labelKey: t("dashboard.layout.links.materials"),
        isPinned: true,
      },
      {
        to: "/panel/resources",
        icon: BookMarked,
        labelKey: t("dashboard.layout.links.resources"),
        isPinned: true,
      },
    ],
  },
] as const;

// ----------------------------------------------------------------------
// 2b. MOBILE PRIMARY TABS (bottom tab bar)
// A deliberately small, role-scoped set of the most-used destinations,
// with SHORT labels purpose-built for a five-slot bar (the sidebar's
// descriptive labels are far too long for a tab). The fifth slot ("Więcej")
// opens the full sheet, so the long tail never needs to live in the bar.
// ----------------------------------------------------------------------

export interface MobilePrimaryTab {
  readonly to: string;
  readonly icon: LucideIcon;
  readonly labelKey: string;
}

export const ADMIN_MOBILE_TABS: readonly MobilePrimaryTab[] = [
  {
    to: "/panel",
    icon: LayoutDashboard,
    labelKey: t("dashboard.layout.mobile_tabs.dashboard"),
  },
  {
    to: "/panel/projects",
    icon: Briefcase,
    labelKey: t("dashboard.layout.mobile_tabs.projects"),
  },
  {
    to: "/panel/rehearsals",
    icon: CalendarCheck,
    labelKey: t("dashboard.layout.mobile_tabs.attendance"),
  },
  {
    to: "/panel/messages",
    icon: MessageCircle,
    labelKey: t("dashboard.layout.mobile_tabs.messages"),
  },
] as const;

export const ARTIST_MOBILE_TABS: readonly MobilePrimaryTab[] = [
  {
    to: "/panel",
    icon: LayoutDashboard,
    labelKey: t("dashboard.layout.mobile_tabs.dashboard"),
  },
  {
    to: "/panel/schedule",
    icon: Calendar,
    labelKey: t("dashboard.layout.mobile_tabs.schedule"),
  },
  {
    to: "/panel/materials",
    icon: Headphones,
    labelKey: t("dashboard.layout.mobile_tabs.materials"),
  },
  {
    to: "/panel/messages",
    icon: MessageCircle,
    labelKey: t("dashboard.layout.mobile_tabs.messages"),
  },
] as const;
