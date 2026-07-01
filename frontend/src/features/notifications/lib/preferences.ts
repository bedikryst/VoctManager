/**
 * @file preferences.ts
 * @description Pure, dependency-light helpers over notification preference rows:
 * the recommended-baseline resolver, the "customized vs recommended" predicate,
 * and the minimal Restore-recommended payload. Shared by the preferences API and
 * the settings ledger so the divergence rule has a single definition.
 * @architecture Enterprise SaaS 2026
 * @module notifications/lib/preferences
 */
import type {
  NotificationPreferenceDTO,
  NotificationType,
} from "../types/notifications.dto";

export interface PreferenceChannels {
  email_enabled: boolean;
  push_enabled: boolean;
}

/**
 * Recommended channel state for a row, defaulting to its current value when the
 * backend baseline is absent (defensive against older payloads).
 */
export const recommendedChannels = (
  pref: NotificationPreferenceDTO,
): PreferenceChannels => ({
  email_enabled: pref.recommended_email ?? pref.email_enabled,
  push_enabled: pref.recommended_push ?? pref.push_enabled,
});

/**
 * A row is "customized" when it diverges from the shared recommended baseline.
 * When `includePush` is false (the push column is hidden because push is
 * fundamentally unavailable here) the dormant push channel is ignored, so the
 * badge only ever reflects a channel the user can actually see and control.
 */
export const isPreferenceCustomized = (
  pref: NotificationPreferenceDTO,
  includePush = true,
): boolean => {
  const target = recommendedChannels(pref);
  if (target.email_enabled !== pref.email_enabled) return true;
  return includePush && target.push_enabled !== pref.push_enabled;
};

export interface PreferenceRestoreItem extends PreferenceChannels {
  notification_type: NotificationType;
}

/**
 * The minimal Restore-recommended payload for a set of rows: only the rows that
 * actually diverge, each carrying its recommended channel state. Returning an
 * empty list means there is nothing to restore. When `includePush` is false the
 * dormant push channel is left at its stored value, so a visible-only reset
 * never silently mutates a channel the user cannot see.
 */
export const restorePayload = (
  rows: readonly NotificationPreferenceDTO[],
  includePush = true,
): PreferenceRestoreItem[] =>
  rows
    .filter((pref) => isPreferenceCustomized(pref, includePush))
    .map((pref) => {
      const recommended = recommendedChannels(pref);
      return {
        notification_type: pref.notification_type,
        email_enabled: recommended.email_enabled,
        push_enabled: includePush ? recommended.push_enabled : pref.push_enabled,
      };
    });
