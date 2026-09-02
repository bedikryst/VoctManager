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
 * It decides whether the panel OFFERS the way in, and nothing more. The server
 * also admits staff (an account that reaches the admin can set this flag on
 * itself) and the panel never learns `is_staff`, so the desk itself is gated by
 * the server's answer to its own first request rather than by this predicate.
 */
export const canEditSiteCopy = (user: AuthUser | null): boolean =>
  user?.profile?.can_edit_site_copy === true;
