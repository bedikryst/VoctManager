/**
 * @file AdminModulesDirectory.tsx
 * @description Centralised routing directory for Mission Control.
 * Evaluates i18n keys from the global navigation configuration.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { SystemModuleCard } from "@/shared/widgets/domain/SystemModuleCard";
import { ADMIN_BENTO_DIRECTIVES } from "@/shared/config/navigation/dashboard.config";

interface AdminModulesDirectoryProps {
  itemKinematics: Variants;
}

export function AdminModulesDirectory({
  itemKinematics,
}: AdminModulesDirectoryProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t(
        "dashboard.admin.directory_nav_aria",
        "Główne Moduły Systemu",
      )}
    >
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-4 md:auto-rows-[180px]">
        {ADMIN_BENTO_DIRECTIVES.map((directive) => (
          <motion.li
            key={directive.id}
            variants={itemKinematics}
            className={directive.gridClass}
          >
            <SystemModuleCard
              id={directive.id}
              path={directive.path}
              romanNumeral={directive.romanNumeral}
              accentClass={directive.accentClass}
              // Translation evaluation happens here:
              title={t(directive.titleKey, directive.defaultTitle)}
              features={directive.features.map((feat) =>
                t(feat.labelKey, feat.defaultLabel),
              )}
            />
          </motion.li>
        ))}
      </ul>
    </nav>
  );
}
