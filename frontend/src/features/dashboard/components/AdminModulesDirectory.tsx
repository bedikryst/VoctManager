/**
 * @file AdminModulesDirectory.tsx
 * @description Centralised routing directory for Mission Control.
 * Kinematics are fully encapsulated: Container orchestrates the stagger, Items execute the motion.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { SystemModuleCard } from "@/shared/widgets/domain/SystemModuleCard";
import { ADMIN_BENTO_DIRECTIVES } from "@/shared/config/navigation/dashboard.config";
import {
  BENTO_CONTAINER_VARIANTS,
  BENTO_ITEM_VARIANTS,
} from "@/shared/ui/kinematics/motion-presets";

export function AdminModulesDirectory(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t(
        "dashboard.admin.directory_nav_aria",
        "Główne Moduły Systemu",
      )}
    >
      <motion.ul
        variants={BENTO_CONTAINER_VARIANTS}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 md:grid-cols-4 md:auto-rows-[180px]"
      >
        {ADMIN_BENTO_DIRECTIVES.map((directive) => (
          <motion.li
            key={directive.id}
            variants={BENTO_ITEM_VARIANTS}
            className={directive.gridClass}
          >
            <SystemModuleCard
              id={directive.id}
              path={directive.path}
              romanNumeral={directive.romanNumeral}
              accentClass={directive.accentClass}
              title={t(directive.titleKey, directive.defaultTitle)}
              features={directive.features.map((feat) =>
                t(feat.labelKey, feat.defaultLabel),
              )}
            />
          </motion.li>
        ))}
      </motion.ul>
    </nav>
  );
}
