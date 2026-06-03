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

interface ArchiveTabsProps {
  readonly className?: string;
}

export const ArchiveTabs = ({
  className,
}: ArchiveTabsProps): React.JSX.Element => {
  const { t } = useTranslation();

  const linkClasses = ({ isActive }: { isActive: boolean }): string =>
    cn(
      "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors",
      isActive
        ? "bg-ethereal-alabaster text-ethereal-gold shadow-glass-ethereal border border-ethereal-incense/20"
        : "text-ethereal-graphite hover:bg-ethereal-alabaster/50 hover:text-ethereal-ink border border-transparent",
    );

  return (
    <nav
      aria-label={t("archive.tabs.aria", "Sekcje archiwum")}
      className={cn(
        "inline-flex items-center gap-1 rounded-2xl border border-ethereal-incense/20 bg-ethereal-incense/5 p-1 backdrop-blur-sm",
        className,
      )}
    >
      <NavLink to="/panel/archive-management" end className={linkClasses}>
        <Music size={13} aria-hidden="true" />
        {t("archive.tabs.pieces", "Utwory")}
      </NavLink>
      <NavLink
        to="/panel/archive-management/composers"
        className={linkClasses}
      >
        <Users size={13} aria-hidden="true" />
        {t("archive.tabs.composers", "Kompozytorzy")}
      </NavLink>
    </nav>
  );
};
