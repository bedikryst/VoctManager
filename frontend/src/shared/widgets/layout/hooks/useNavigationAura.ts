/**
 * @file useNavigationAura.ts
 * @description Centralized identity & navigation logic for Ethereal UI Layouts.
 * Implements SSOT (Single Source of Truth) for Spatial UI Dock routing and RBAC resolution.
 * @module shared/widgets/layout/hooks
 * @architecture Enterprise SaaS 2026
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ADMIN_NAV_GROUPS,
  ARTIST_NAV_GROUPS,
} from "@/shared/config/navigation/dashboard.config";
import { isCrew, isManager } from "@/shared/auth/rbac";
import type { AuthUser } from "@/shared/auth/auth.types";

export const useNavigationAura = (user: AuthUser | null) => {
  const { t } = useTranslation();

  // 1. Establish core identity
  const isManagerUser = isManager(user);

  // 2. SSOT Navigation Tree: Resolve the exact navigation payload based on RBAC
  const navGroups = useMemo(() => {
    return isManagerUser ? ADMIN_NAV_GROUPS : ARTIST_NAV_GROUPS;
  }, [isManagerUser]);

  // 3. Spatial UI Extraction: Dynamically extract pinned items for the Mobile Dock.
  // This guarantees the Dock NEVER displays unauthorized or mismatched routes.
  const pinnedItems = useMemo(() => {
    return navGroups.flatMap((group) =>
      group.links.filter((link) => link.isPinned),
    );
  }, [navGroups]);

  // 4. Identity Metadata Projections
  const userFullName = useMemo(() => {
    if (!user) return t("dashboard.layout.roles.guest", "Guest");
    return [user.first_name, user.last_name].filter(Boolean).join(" ");
  }, [user, t]);

  const roleLabel = useMemo(() => {
    if (isManagerUser) return t("dashboard.layout.roles.admin");
    if (isCrew(user)) return t("dashboard.layout.roles.crew");

    // Fallback to specific vocal part (e.g., "Soprano I") or generic "Artist"
    return user?.voice_type_display || t("dashboard.layout.roles.artist");
  }, [user, isManagerUser, t]);

  const initials = useMemo(() => {
    return (
      `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
      "U"
    );
  }, [user]);

  return {
    navGroups,
    pinnedItems,
    userFullName,
    roleLabel,
    initials,
    isManagerUser,
    t,
  };
};
