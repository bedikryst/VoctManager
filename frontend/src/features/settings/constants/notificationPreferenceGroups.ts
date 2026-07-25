/**
 * @file notificationPreferenceGroups.ts
 * @description The client half of the preference-group map: a glyph per group and
 * per event type, and the assembly of the server's matrix into ordered, non-empty
 * sections. Membership, order and the recommended baseline are the backend's
 * (notifications/delivery.py) — nothing here re-decides them, so the ledger a
 * reader operates and the policy the router applies cannot drift apart. Labels
 * and descriptions live in i18n (settings.notifications.groups.* / .type_desc.*).
 * @architecture Enterprise SaaS 2026
 * @module settings/constants/notificationPreferenceGroups
 */
import {
  AlarmClock,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarCog,
  CalendarOff,
  CalendarPlus,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  FileMusic,
  Library,
  MailPlus,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Music,
  PencilLine,
  Repeat,
  ShieldCheck,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type {
  NotificationGroupId,
  NotificationPreferenceDTO,
  NotificationPreferenceGroupDTO,
  NotificationPreferenceMatrixDTO,
  NotificationType,
} from "@/features/notifications/types/notifications.dto";

export type { NotificationGroupId };

export const NOTIFICATION_GROUP_ICON: Record<NotificationGroupId, LucideIcon> = {
  commitments: CalendarCheck,
  messages: MessagesSquare,
  materials: Library,
  // A one-member group, so it shares its single row's glyph rather than inventing
  // a second symbol for the same event.
  safety_net: Megaphone,
  team: ShieldCheck,
};

/**
 * Per-type glyph. Purely decorative: an unmapped type still renders its row with
 * the neutral bell rather than disappearing. Only the types the server groups
 * appear here — one with no group has no row to draw a glyph on.
 */
export const NOTIFICATION_TYPE_ICON: Partial<Record<NotificationType, LucideIcon>> = {
  // Commitments — what you have said yes to, and decisions on your own requests
  PROJECT_INVITATION: MailPlus,
  PROJECT_UPDATED: PencilLine,
  PROJECT_CANCELLED: CalendarX,
  REHEARSAL_SCHEDULED: CalendarPlus,
  REHEARSAL_UPDATED: CalendarCog,
  REHEARSAL_CANCELLED: CalendarX,
  PIECE_CASTING_ASSIGNED: Music,
  PIECE_CASTING_UPDATED: Repeat,
  ABSENCE_APPROVED: CheckCircle2,
  ABSENCE_REJECTED: XCircle,
  // Messages — someone writing to you
  MESSAGE_RECEIVED: MessageCircle,
  CUSTOM_ADMIN_MESSAGE: Megaphone,
  // Materials & reminders — preparation and nudges
  MATERIAL_UPLOADED: FileMusic,
  PROJECT_REMINDER: CalendarClock,
  REHEARSAL_REMINDER: AlarmClock,
  // Team operations — the manager's console
  PARTICIPATION_RESPONSE: UserCheck,
  ATTENDANCE_SUBMITTED: ClipboardCheck,
  ABSENCE_REQUESTED: CalendarOff,
  // Safety net — the queue nobody has published yet
  ANNOUNCEMENT_PENDING: Megaphone,
};

export const FALLBACK_TYPE_ICON: LucideIcon = Bell;

export const notificationTypeIcon = (type: NotificationType): LucideIcon =>
  NOTIFICATION_TYPE_ICON[type] ?? FALLBACK_TYPE_ICON;

export interface NotificationPreferenceGroup extends NotificationPreferenceGroupDTO {
  icon: LucideIcon;
  preferences: NotificationPreferenceDTO[];
}

/**
 * Assembles the server's matrix into render-ready sections, in the order the
 * server declared and keeping each group's row order. A group the response
 * declares but leaves empty is dropped rather than rendered as a control over
 * nothing; a row naming a group the response never declared is dropped for the
 * same reason — it would be a switch nobody could reach.
 */
export const groupNotificationPreferences = (
  matrix: NotificationPreferenceMatrixDTO | undefined,
): NotificationPreferenceGroup[] => {
  if (!matrix) return [];

  const buckets = new Map<NotificationGroupId, NotificationPreferenceDTO[]>();
  for (const pref of matrix.preferences) {
    const bucket = buckets.get(pref.group) ?? [];
    bucket.push(pref);
    buckets.set(pref.group, bucket);
  }

  return matrix.groups
    .filter((group) => (buckets.get(group.id)?.length ?? 0) > 0)
    .map((group) => ({
      ...group,
      icon: NOTIFICATION_GROUP_ICON[group.id] ?? Bell,
      preferences: buckets.get(group.id) ?? [],
    }));
};
