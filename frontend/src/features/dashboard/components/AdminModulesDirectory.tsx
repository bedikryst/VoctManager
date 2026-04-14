/**
 * @file AdminModulesDirectory.tsx
 * @description Centralised routing directory for Mission Control.
 * Encapsulates the module dictionary and renders a high-density grid.
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
      },
    ],
    [t],
  );

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
      {ADMIN_MODULES.map((moduleConfig, index) => (
        <motion.div key={moduleConfig.id} variants={itemKinematics}>
          <SystemModuleCard index={index + 1} {...moduleConfig} />
        </motion.div>
      ))}
    </div>
  );
}
