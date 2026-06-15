/**
 * @file useNavigationAura.ts
 * @description Centralized identity & navigation logic for Ethereal UI Layouts.
 * Implements SSOT (Single Source of Truth) for Spatial UI Dock routing and RBAC resolution.
 * @module widgets/panel-shell/hooks
 * @architecture Enterprise SaaS 2026
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ADMIN_MOBILE_TABS,
  ADMIN_NAV_GROUPS,
  ARTIST_MOBILE_TABS,
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

  // Flat list of every authorized destination. The mobile dock shows only
  // `pinnedItems` on a phone, but expands to the full set on wider touch
  // screens (tablets), so the bar fills the width instead of stranding a
  // narrow pill in the middle.
  const allItems = useMemo(
    () => navGroups.flatMap((group) => group.links),
    [navGroups],
  );

  // Mobile bottom-tab-bar primaries + the route set they occupy, so the
  // "More" sheet can drop them from its idle list (no duplication) while still
  // searching across everything.
  const mobileTabs = useMemo(
    () => (isManagerUser ? ADMIN_MOBILE_TABS : ARTIST_MOBILE_TABS),
    [isManagerUser],
  );

  const primaryRoutes = useMemo(
    () => new Set(mobileTabs.map((tab) => tab.to)),
    [mobileTabs],
  );

  // 4. Identity Metadata Projections
  const userFullName = useMemo(() => {
    if (!user) return t("dashboard.layout.roles.guest", "Guest");
    return [user.first_name, user.last_name].filter(Boolean).join(" ");
  }, [user, t]);

  const roleLabel = useMemo(() => {
    if (isManagerUser) return t("dashboard.layout.roles.admin");
    if (isCrew(user)) return t("dashboard.layout.roles.crew");

    // Resolve specific vocal part or role from translations if available
    const voiceKey = user?.voice_type;
    const translatedVoice = voiceKey
      ? t(`dashboard.layout.roles.${voiceKey}`)
      : null;

    return (
      translatedVoice ||
      user?.voice_type_display ||
      t("dashboard.layout.roles.artist")
    );
  }, [user, isManagerUser, t]);

  const initials = useMemo(() => {
    return (
      `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
      "U"
    );
  }, [user]);

  const avatarUrl = user?.profile?.avatar_thumb_url ?? null;

  return {
    navGroups,
    pinnedItems,
    allItems,
    mobileTabs,
    primaryRoutes,
    userFullName,
    roleLabel,
    initials,
    avatarUrl,
    isManagerUser,
    t,
  };
};
