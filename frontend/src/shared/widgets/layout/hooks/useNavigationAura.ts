/**
 * @file useNavigationAura.ts
 * @description Centralized identity & navigation logic for Ethereal UI Layouts.
 * @module shared/widgets/layout/hooks
 */

import { useTranslation } from "react-i18next";
import {
  ADMIN_NAV_GROUPS as adminNavGroups,
  ARTIST_NAV_GROUPS as artistNavGroups,
} from "@/shared/config/navigation/dashboard.config";
import { isCrew, isManager } from "@/shared/auth/rbac";
import type { AuthUser } from "@/shared/auth/auth.types";

export const useNavigationAura = (user: AuthUser | null) => {
  const { t } = useTranslation();
  const isManagerUser = isManager(user);

  const navGroups = isManagerUser ? adminNavGroups : artistNavGroups;

  const userFullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");

  const roleLabel = isManagerUser
    ? t("dashboard.layout.roles.admin")
    : isCrew(user)
      ? t("dashboard.layout.roles.crew")
      : user?.voice_type_display || t("dashboard.layout.roles.artist");

  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
    "U";

  return {
    navGroups,
    userFullName,
    roleLabel,
    initials,
    isManagerUser,
    t,
  };
};
