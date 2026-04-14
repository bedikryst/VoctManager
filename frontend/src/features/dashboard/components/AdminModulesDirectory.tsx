/**
 * @file AdminModulesDirectory.tsx
 * @description Centralised routing directory for Mission Control.
 * Encapsulates the module dictionary and renders an asymmetrical bento grid.
 * @module panel/dashboard/components/AdminModulesDirectory
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { Music, FileText, Users, Briefcase, Wrench, Map } from "lucide-react";
import { SystemModuleCard } from "@/shared/widgets/domain/SystemModuleCard";

interface AdminModulesDirectoryProps {
  itemKinematics: Variants;
}

export function AdminModulesDirectory({
  itemKinematics,
}: AdminModulesDirectoryProps): React.JSX.Element {
  const { t } = useTranslation();

  const ADMIN_MODULES = useMemo(
    () => [
      {
        id: "projects",
        title: t("dashboard.admin.modules.projects_title", "Projekty"),
        features: [
          t("dashboard.admin.features.schedules", "Harmonogramy"),
          t("dashboard.admin.features.setlists", "Setlisty"),
        ],
        icon: Briefcase,
        iconBgClass: "text-ethereal-gold",
        path: "/panel/projects",
        // Klasy mapujące pozycję w siatce Bento
        gridClass: "md:col-span-2 md:row-span-2",
      },
      {
        id: "logistics",
        title: t("dashboard.admin.modules.logistics_title", "Logistyka"),
        features: [
          t("dashboard.admin.features.locations", "Lokacje"),
          t("dashboard.admin.features.transport", "Transport"),
        ],
        icon: Map,
        iconBgClass: "text-ethereal-sage",
        path: "/panel/locations",
        gridClass: "md:col-span-2 md:row-span-2",
      },
      {
        id: "archive",
        title: t("dashboard.admin.modules.archive_title", "Archiwum"),
        features: [
          t("dashboard.admin.features.pdf_scores", "Nuty PDF"),
          t("dashboard.admin.features.audio", "Audio referencyjne"),
        ],
        icon: Music,
        iconBgClass: "text-ethereal-graphite",
        path: "/panel/archive-management",
        gridClass: "md:col-span-1 md:row-span-1",
      },
      {
        id: "artists",
        title: t("dashboard.admin.modules.artists_title", "Artyści"),
        features: [
          t("dashboard.admin.features.satb", "SATB"),
          t("dashboard.admin.features.profiles", "Profile"),
        ],
        icon: Users,
        iconBgClass: "text-ethereal-amethyst",
        path: "/panel/artists",
        gridClass: "md:col-span-1 md:row-span-1",
      },
      {
        id: "contracts",
        title: t("dashboard.admin.modules.contracts_title", "Finanse"),
        features: [
          t("dashboard.admin.features.rates", "Stawki"),
          t("dashboard.admin.features.budget", "Budżet"),
        ],
        icon: FileText,
        iconBgClass: "text-ethereal-incense",
        path: "/panel/contracts",
        gridClass: "md:col-span-1 md:row-span-1",
      },
      {
        id: "crew",
        title: t("dashboard.admin.modules.crew_title", "Technika"),
        features: [
          t("dashboard.admin.features.sound", "Dźwięk & Światło"),
          t("dashboard.admin.features.vendors", "Podwykonawcy"),
        ],
        icon: Wrench,
        iconBgClass: "text-ethereal-ink",
        path: "/panel/crew",
        gridClass: "md:col-span-1 md:row-span-1",
      },
    ],
    [t],
  );

  return (
    <div className="grid grid-cols-1 gap-1 md:grid-cols-4 md:gap-6 xl:gap-8">
      {ADMIN_MODULES.map((moduleConfig, index) => (
        <motion.div
          key={moduleConfig.id}
          variants={itemKinematics}
          className={moduleConfig.gridClass}
        >
          <div className="h-full w-full">
            <SystemModuleCard index={index + 1} {...moduleConfig} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
