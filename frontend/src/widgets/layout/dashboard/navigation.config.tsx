// frontend/src/widgets/layout/dashboard/navigation.config.tsx
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
} from "lucide-react";

export interface NavLinkItem {
  to: string;
  labelKey: string;
  icon: React.ReactNode;
}

export interface NavGroup {
  labelKey: string;
  links: NavLinkItem[];
}

export const adminNavGroups: NavGroup[] = [
  {
    labelKey: "dashboard.layout.groups.overview",
    links: [
      {
        to: "/panel",
        icon: <LayoutDashboard size={18} />,
        labelKey: "dashboard.layout.links.admin_dashboard",
      },
    ],
  },
  {
    labelKey: "dashboard.layout.groups.production",
    links: [
      {
        to: "/panel/project-management",
        icon: <Briefcase size={18} />,
        labelKey: "dashboard.layout.links.projects",
      },
      {
        to: "/panel/rehearsals",
        icon: <CalendarCheck size={18} />,
        labelKey: "dashboard.layout.links.attendance",
      },
    ],
  },
  {
    labelKey: "dashboard.layout.groups.data_admin",
    links: [
      {
        to: "/panel/artists",
        icon: <Users size={18} />,
        labelKey: "dashboard.layout.links.artists",
      },
      {
        to: "/panel/crew",
        icon: <Wrench size={18} />,
        labelKey: "dashboard.layout.links.crew",
      },
      {
        to: "/panel/contracts",
        icon: <FileText size={18} />,
        labelKey: "dashboard.layout.links.contracts",
      },
      {
        to: "/panel/archive-management",
        icon: <Music size={18} />,
        labelKey: "dashboard.layout.links.archive",
      },
    ],
  },
  {
    labelKey: "dashboard.layout.groups.artist_zone",
    links: [
      {
        to: "/panel/schedule",
        icon: <Calendar size={18} />,
        labelKey: "dashboard.layout.links.schedule",
      },
      {
        to: "/panel/materials",
        icon: <Headphones size={18} />,
        labelKey: "dashboard.layout.links.materials",
      },
      {
        to: "/panel/resources",
        icon: <FolderOpen size={18} />,
        labelKey: "dashboard.layout.links.resources",
      },
    ],
  },
];

export const artistNavGroups: NavGroup[] = [
  {
    labelKey: "dashboard.layout.groups.overview",
    links: [
      {
        to: "/panel",
        icon: <LayoutDashboard size={18} />,
        labelKey: "dashboard.layout.links.artist_dashboard",
      },
    ],
  },
  {
    labelKey: "dashboard.layout.groups.my_zone",
    links: [
      {
        to: "/panel/schedule",
        icon: <Calendar size={18} />,
        labelKey: "dashboard.layout.links.schedule",
      },
      {
        to: "/panel/materials",
        icon: <Headphones size={18} />,
        labelKey: "dashboard.layout.links.materials",
      },
      {
        to: "/panel/resources",
        icon: <FolderOpen size={18} />,
        labelKey: "dashboard.layout.links.resources",
      },
    ],
  },
];

export const BrandMark = () => (
  <h2
    className="text-3xl font-medium text-stone-900 tracking-tight"
    style={{ fontFamily: "'Cormorant', serif" }}
  >
    Voct<span className="italic text-[#002395]">Manager</span>
  </h2>
);
