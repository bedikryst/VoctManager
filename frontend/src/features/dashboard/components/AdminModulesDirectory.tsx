/**
 * @file AdminModulesDirectory.tsx
 * @description Centralised routing directory for Mission Control.
 * Reinvented for Ethereal UI 2026: Asymmetric Golden Ratio layout.
 * Delegates entirely to SystemModuleCard for proximity spotlight kinematics.
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { SystemModuleCard } from "@/shared/widgets/domain/SystemModuleCard";

interface AdminModulesDirectoryProps {
  itemKinematics: Variants;
}

interface DirectiveConfig {
  id: string;
  romanNumeral: string;
  title: string;
  features: string[];
  accentClass: string;
  path: string;
  gridClass: string;
}

export function AdminModulesDirectory({
  itemKinematics,
}: AdminModulesDirectoryProps): React.JSX.Element {
  const { t } = useTranslation();

  const DIRECTIVES: DirectiveConfig[] = useMemo(
    () => [
      {
        id: "projects",
        romanNumeral: "I",
        title: t("dashboard.admin.modules.projects_title", "Projekty"),
        features: [
          t("dashboard.admin.features.schedules", "Harmonogramy"),
          t("dashboard.admin.features.setlists", "Setlisty"),
        ],
        accentClass: "bg-ethereal-gold",
        path: "/panel/projects",
        // The Dominant Anchor (Golden Ratio Main Block)
        gridClass: "md:col-span-2 md:row-span-2",
      },
      {
        id: "logistics",
        romanNumeral: "II",
        title: t("dashboard.admin.modules.logistics_title", "Logistyka"),
        features: [
          t("dashboard.admin.features.locations", "Lokacje"),
          t("dashboard.admin.features.transport", "Transport"),
        ],
        accentClass: "bg-ethereal-sage",
        path: "/panel/locations",
        gridClass: "md:col-span-2 md:row-span-1",
      },
      {
        id: "archive",
        romanNumeral: "III",
        title: t("dashboard.admin.modules.archive_title", "Archiwum"),
        features: [
          t("dashboard.admin.features.pdf_scores", "Nuty PDF"),
          t("dashboard.admin.features.audio", "Audio ref."),
        ],
        accentClass: "bg-ethereal-incense",
        path: "/panel/archive-management",
        gridClass: "md:col-span-1 md:row-span-1",
      },
      {
        id: "artists",
        romanNumeral: "IV",
        title: t("dashboard.admin.modules.artists_title", "Artyści"),
        features: [
          t("dashboard.admin.features.satb", "SATB"),
          t("dashboard.admin.features.profiles", "Profile"),
        ],
        accentClass: "bg-ethereal-amethyst",
        path: "/panel/artists",
        gridClass: "md:col-span-1 md:row-span-1",
      },
      {
        id: "contracts",
        romanNumeral: "V",
        title: t("dashboard.admin.modules.contracts_title", "Finanse"),
        features: [
          t("dashboard.admin.features.rates", "Stawki"),
          t("dashboard.admin.features.budget", "Budżet"),
        ],
        accentClass: "bg-ethereal-graphite",
        path: "/panel/contracts",
        gridClass: "md:col-span-2 md:row-span-1",
      },
      {
        id: "crew",
        romanNumeral: "VI",
        title: t("dashboard.admin.modules.crew_title", "Technika"),
        features: [
          t("dashboard.admin.features.sound", "Dźwięk & Światło"),
          t("dashboard.admin.features.vendors", "Podwykonawcy"),
        ],
        accentClass: "bg-ethereal-ink",
        path: "/panel/crew",
        gridClass: "md:col-span-2 md:row-span-1",
      },
    ],
    [t],
  );

  return (
    <nav
      aria-label={t(
        "dashboard.admin.directory_nav_aria",
        "Główne Moduły Systemu",
      )}
    >
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-4 md:auto-rows-[180px]">
        {DIRECTIVES.map((directive) => (
          <motion.li
            key={directive.id}
            variants={itemKinematics}
            className={directive.gridClass}
          >
            <SystemModuleCard
              id={directive.id}
              title={directive.title}
              path={directive.path}
              romanNumeral={directive.romanNumeral}
              accentClass={directive.accentClass}
              features={directive.features}
            />
          </motion.li>
        ))}
      </ul>
    </nav>
  );
}
