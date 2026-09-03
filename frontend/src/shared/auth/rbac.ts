/**
 * @file rbac.ts
 * @description Central RBAC helpers for route gating and adaptive UI rendering.
 * @module shared/auth/rbac
 */

import { APP_ROLES, type AppRole, type AuthUser } from "./auth.types";

export const getUserRole = (user: AuthUser | null): AppRole | null => {
  if (!user?.profile) {
    return null;
  }

  if (user.profile.role) {
    return user.profile.role;
  }

  if (user.profile.is_manager) {
    return APP_ROLES.MANAGER;
  }

  if (user.profile.is_crew) {
    return APP_ROLES.CREW;
  }

  if (user.profile.is_artist) {
    return APP_ROLES.ARTIST;
  }

  return null;
};

export const isManager = (user: AuthUser | null): boolean =>
  getUserRole(user) === APP_ROLES.MANAGER;

export const isArtist = (user: AuthUser | null): boolean =>
  getUserRole(user) === APP_ROLES.ARTIST;

export const isCrew = (user: AuthUser | null): boolean =>
  getUserRole(user) === APP_ROLES.CREW;

/**
 * May this account be offered the copy desk. Read off the capability flag, not
 * off `getUserRole` — a manager is not an editor by default, and an editor need
 * not be a manager.
 *
 * The payload carries the EFFECTIVE capability, so this matches whom the server
 * will actually admit — staff included, whether or not the flag was ever set on
 * them. It still decides only whether the panel OFFERS the way in: the desk
 * itself is gated by the server's answer to its own first request.
 */
export const canEditSiteCopy = (user: AuthUser | null): boolean =>
  user?.profile?.can_edit_site_copy === true;
