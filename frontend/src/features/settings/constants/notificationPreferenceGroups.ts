/**
 * @file notificationPreferenceGroups.ts
 * @description Presentation metadata for the notification preferences ledger:
 * maps each NotificationType to a domain group + icon, and groups a flat
 * preference list into ordered, non-empty sections. Labels/descriptions live in
 * i18n (settings.notifications.groups.* / settings.notifications.type_desc.*).
 * @architecture Enterprise SaaS 2026
 * @module settings/constants/notificationPreferenceGroups
 */
import {
  AlarmClock,
  Bell,
  CalendarClock,
  CalendarCog,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  CalendarX,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  FileMusic,
  MailPlus,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Music,
  PencilLine,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type {
  NotificationPreferenceDTO,
  NotificationType,
} from "@/features/notifications/types/notifications.dto";

export type NotificationGroupId =
  | "schedule"
  | "repertoire"
  | "messages"
  | "decisions"
  | "team";

/**
 * Render order of the domain sections. Team-ops is intentionally last so the
 * manager-only daily digest can sit beneath it as the ledger's true footer.
 */
export const NOTIFICATION_GROUP_ORDER: readonly NotificationGroupId[] = [
  "schedule",
  "repertoire",
  "messages",
  "decisions",
  "team",
] as const;

export const NOTIFICATION_GROUP_ICON: Record<NotificationGroupId, LucideIcon> = {
  schedule: CalendarDays,
  repertoire: Music,
  messages: MessagesSquare,
  decisions: CheckCheck,
  team: ShieldCheck,
};

interface NotificationTypeMeta {
  group: NotificationGroupId;
  icon: LucideIcon;
}

/**
 * Per-type group + glyph. The backend decides which types reach the matrix
 * (it hides channel/in-app-only types and role-gates manager rows); anything
 * unmapped here degrades gracefully into the `messages` (Communications) group.
 */
export const NOTIFICATION_TYPE_META: Partial<
  Record<NotificationType, NotificationTypeMeta>
> = {
  // Schedule & rehearsals
  PROJECT_INVITATION: { group: "schedule", icon: MailPlus },
  PROJECT_UPDATED: { group: "schedule", icon: PencilLine },
  PROJECT_CANCELLED: { group: "schedule", icon: CalendarX },
  PROJECT_REMINDER: { group: "schedule", icon: CalendarClock },
  REHEARSAL_SCHEDULED: { group: "schedule", icon: CalendarPlus },
  REHEARSAL_UPDATED: { group: "schedule", icon: CalendarCog },
  REHEARSAL_CANCELLED: { group: "schedule", icon: CalendarX },
  REHEARSAL_REMINDER: { group: "schedule", icon: AlarmClock },
  // Repertoire & materials
  PIECE_CASTING_ASSIGNED: { group: "repertoire", icon: Music },
  PIECE_CASTING_UPDATED: { group: "repertoire", icon: Repeat },
  MATERIAL_UPLOADED: { group: "repertoire", icon: FileMusic },
  // Communications — direct messages, broadcasts and system-wide notices
  MESSAGE_RECEIVED: { group: "messages", icon: MessageCircle },
  CUSTOM_ADMIN_MESSAGE: { group: "messages", icon: Megaphone },
  SYSTEM_ALERT: { group: "messages", icon: ShieldAlert },
  // Decisions on the recipient's own requests
  ABSENCE_APPROVED: { group: "decisions", icon: CheckCircle2 },
  ABSENCE_REJECTED: { group: "decisions", icon: XCircle },
  // Manager / team operations
  PARTICIPATION_RESPONSE: { group: "team", icon: UserCheck },
  ATTENDANCE_SUBMITTED: { group: "team", icon: ClipboardCheck },
  ABSENCE_REQUESTED: { group: "team", icon: CalendarOff },
};

export const FALLBACK_TYPE_META: NotificationTypeMeta = {
  group: "messages",
  icon: Bell,
};

export const notificationTypeMeta = (
  type: NotificationType,
): NotificationTypeMeta => NOTIFICATION_TYPE_META[type] ?? FALLBACK_TYPE_META;

export interface NotificationPreferenceGroup {
  id: NotificationGroupId;
  icon: LucideIcon;
  preferences: NotificationPreferenceDTO[];
}

/**
 * Buckets a flat preference list into ordered, non-empty domain sections,
 * preserving the backend's row order within each section.
 */
export const groupNotificationPreferences = (
  preferences: readonly NotificationPreferenceDTO[],
): NotificationPreferenceGroup[] => {
  const buckets = new Map<NotificationGroupId, NotificationPreferenceDTO[]>();
  for (const pref of preferences) {
    const { group } = notificationTypeMeta(pref.notification_type);
    const bucket = buckets.get(group) ?? [];
    bucket.push(pref);
    buckets.set(group, bucket);
  }
  return NOTIFICATION_GROUP_ORDER.filter((id) => buckets.has(id)).map((id) => ({
    id,
    icon: NOTIFICATION_GROUP_ICON[id],
    preferences: buckets.get(id) ?? [],
  }));
};
