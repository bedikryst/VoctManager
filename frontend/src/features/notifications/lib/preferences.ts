/**
 * @file preferences.ts
 * @description Pure, dependency-light helpers over notification preference rows:
 * the recommended-baseline resolver, the "customized vs recommended" predicate,
 * how a group's control reads when its members are polled, and the minimal
 * payloads for Restore-recommended and a whole-group channel decision. Shared by
 * the preferences API and the settings ledger so each rule has one definition.
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

export type PreferenceChannel = keyof PreferenceChannels;

/**
 * How a group's control reads when its members are polled. `mixed` is the state
 * a reader arrives in when they once answered per type — it is displayed rather
 * than resolved, because coercing it would overwrite a choice they actually made.
 */
export type GroupChannelState = "on" | "off" | "mixed";

export const groupChannelState = (
  rows: readonly NotificationPreferenceDTO[],
  channel: PreferenceChannel,
): GroupChannelState => {
  if (rows.length === 0) return "off";
  const on = rows.filter((pref) => pref[channel]).length;
  if (on === rows.length) return "on";
  if (on === 0) return "off";
  return "mixed";
};

/**
 * What clicking a group's control means. A mixed group resolves to "on" — the
 * conventional reading of a partially-set control, and the safe direction: it
 * adds delivery rather than silencing something the reader never asked to lose.
 */
export const nextGroupChannelValue = (state: GroupChannelState): boolean =>
  state !== "on";

export interface PreferenceRestoreItem extends PreferenceChannels {
  notification_type: NotificationType;
}

/**
 * The minimal payload that puts one channel of a whole group at `value`. Only
 * rows that actually differ are written, and the untouched channel travels at its
 * stored value so a group decision never silently moves the other one.
 */
export const groupChannelPayload = (
  rows: readonly NotificationPreferenceDTO[],
  channel: PreferenceChannel,
  value: boolean,
): PreferenceRestoreItem[] =>
  rows
    .filter((pref) => pref[channel] !== value)
    .map((pref) => ({
      notification_type: pref.notification_type,
      email_enabled: channel === "email_enabled" ? value : pref.email_enabled,
      push_enabled: channel === "push_enabled" ? value : pref.push_enabled,
    }));

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
