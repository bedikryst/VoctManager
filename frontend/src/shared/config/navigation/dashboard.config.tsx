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
  FolderOpen,
  Headphones,
  LayoutDashboard,
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

export interface BentoDirectiveFeature {
  readonly labelKey: string;
  readonly defaultLabel: string;
}

export interface BentoDirective {
  readonly id: string;
  readonly romanNumeral: string;
  readonly titleKey: string;
  readonly defaultTitle: string;
  readonly features: readonly BentoDirectiveFeature[];
  readonly accentClass: string;
  readonly path: string;
  readonly gridClass: string;
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
        icon: FolderOpen,
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
        icon: FolderOpen,
        labelKey: t("dashboard.layout.links.resources"),
        isPinned: true,
      },
    ],
  },
] as const;

// ----------------------------------------------------------------------
// 3. DASHBOARD BENTO DIRECTIVES (Admin Home Matrix)
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

export const ARTIST_BENTO_DIRECTIVES: readonly BentoDirective[] = [
  {
    id: "schedule",
    romanNumeral: "I",
    titleKey: t("dashboard.artist.modules.schedule_title", "Harmonogram"),
    defaultTitle: "Harmonogram",
    features: [
      {
        labelKey: t("dashboard.artist.features.events", "Próby i Koncerty"),
        defaultLabel: "Próby i Koncerty",
      },
      {
        labelKey: t(
          "dashboard.artist.features.absences",
          "Zgłaszanie Absencji",
        ),
        defaultLabel: "Zgłaszanie Absencji",
      },
    ],
    accentClass: "bg-ethereal-gold",
    path: "/panel/schedule",
    gridClass: "md:col-span-1 md:row-span-1",
  },
  {
    id: "materials",
    romanNumeral: "II",
    titleKey: t("dashboard.artist.modules.materials_title", "Repertuar"),
    defaultTitle: "Repertuar",
    features: [
      {
        labelKey: t("dashboard.artist.features.pdf_scores", "Partytury PDF"),
        defaultLabel: "Partytury PDF",
      },
      {
        labelKey: t("dashboard.artist.features.audio_tracks", "Ścieżki Audio"),
        defaultLabel: "Ścieżki Audio",
      },
    ],
    accentClass: "bg-ethereal-sage",
    path: "/panel/materials",
    gridClass: "md:col-span-1 md:row-span-1",
  },
  {
    id: "resources",
    romanNumeral: "III",
    titleKey: t("dashboard.artist.modules.resources_title", "Materiały"),
    defaultTitle: "Doktryna",
    features: [
      {
        labelKey: t("dashboard.artist.features.dress_code", "Dress-code"),
        defaultLabel: "Dress-code",
      },
      {
        labelKey: t("dashboard.artist.features.logistics", "Logistyka"),
        defaultLabel: "Logistyka",
      },
    ],
    accentClass: "bg-ethereal-incense",
    path: "/panel/resources",
    gridClass: "md:col-span-1 md:row-span-1",
  },
];
