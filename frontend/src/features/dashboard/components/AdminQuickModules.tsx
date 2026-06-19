/**
 * @file AdminQuickModules.tsx
 * @description The conductor's quick-jump strip — a dense, polished row of the
 * operational areas (replaces the old 180px bento module directory, which merely
 * duplicated the sidebar at triple the height). Shares the QuickTile language
 * with the chorister home. 6-up on desktop, 3-up on tablet, 2-up on mobile.
 * @module features/dashboard/components/AdminQuickModules
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Briefcase,
  CalendarCheck,
  FileText,
  MapPin,
  Music,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Eyebrow } from "@/shared/ui/primitives/typography";
import { QuickTile, type QuickAccent } from "./QuickTile";

interface AdminModule {
  to: string;
  Icon: LucideIcon;
  accent: QuickAccent;
  label: string;
  hint: string;
}

export const AdminQuickModules = (): React.JSX.Element => {
  const { t } = useTranslation();

  const modules: ReadonlyArray<AdminModule> = [
    {
      to: "/panel/projects",
      Icon: Briefcase,
      accent: "gold",
      label: t("dashboard.admin.quick.projects", "Projekty"),
      hint: t("dashboard.admin.quick.projects_hint", "Produkcje i obsada"),
    },
    {
      to: "/panel/rehearsals",
      Icon: CalendarCheck,
      accent: "sage",
      label: t("dashboard.admin.quick.rehearsals", "Próby"),
      hint: t("dashboard.admin.quick.rehearsals_hint", "Obecności i frekwencja"),
    },
    {
      to: "/panel/artists",
      Icon: Users,
      accent: "amethyst",
      label: t("dashboard.admin.quick.artists", "Artyści"),
      hint: t("dashboard.admin.quick.artists_hint", "Skład i głosy"),
    },
    {
      to: "/panel/archive-management",
      Icon: Music,
      accent: "incense",
      label: t("dashboard.admin.quick.archive", "Archiwum"),
      hint: t("dashboard.admin.quick.archive_hint", "Nuty i utwory"),
    },
    {
      to: "/panel/contracts",
      Icon: FileText,
      accent: "gold",
      label: t("dashboard.admin.quick.contracts", "Finanse"),
      hint: t("dashboard.admin.quick.contracts_hint", "Umowy i rozliczenia"),
    },
    {
      to: "/panel/locations",
      Icon: MapPin,
      accent: "sage",
      label: t("dashboard.admin.quick.locations", "Lokalizacje"),
      hint: t("dashboard.admin.quick.locations_hint", "Sale i miejsca"),
    },
  ];

  return (
    <section aria-label={t("dashboard.admin.quick.aria", "Moduły systemu")}>
      <Eyebrow color="muted" className="mb-3 block px-1">
        {t("dashboard.admin.quick.title", "Centrum dowodzenia")}
      </Eyebrow>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {modules.map(({ to, Icon, accent, label, hint }) => (
          <QuickTile
            key={to}
            to={to}
            Icon={Icon}
            accent={accent}
            label={label}
            hint={hint}
          />
        ))}
      </div>
    </section>
  );
};
