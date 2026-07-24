// frontend/src/features/notifications/types/notifications.dto.ts

export type NotificationLevel = "INFO" | "WARNING" | "URGENT";

export type NotificationType =
  | "PROJECT_INVITATION"
  | "PROJECT_UPDATED"
  | "PROJECT_CANCELLED"
  | "PROJECT_REMINDER"
  | "REHEARSAL_SCHEDULED"
  | "REHEARSAL_UPDATED"
  | "REHEARSAL_CANCELLED"
  | "REHEARSAL_REMINDER"
  | "PIECE_CASTING_ASSIGNED"
  | "PIECE_CASTING_UPDATED"
  | "MATERIAL_UPLOADED"
  | "CONTRACT_ISSUED"
  | "ABSENCE_REQUESTED"
  | "ABSENCE_APPROVED"
  | "ABSENCE_REJECTED"
  | "SYSTEM_ALERT"
  | "PARTICIPATION_RESPONSE"
  | "ATTENDANCE_SUBMITTED"
  | "CUSTOM_ADMIN_MESSAGE"
  | "MESSAGE_RECEIVED"
  | "CHANNEL_MESSAGE"
  | "NOTIFICATION_READ_RECEIPT";

// ==========================================
// STRICT METADATA PAYLOADS
// ==========================================
//
// Metadata carries STRUCTURED, language-neutral data only (stable status/field
// codes, names, ISO datetimes, display fallbacks). The in-app row composes its own copy from
// these codes in the viewer's current UI language — see NotificationItem.tsx.

/** One audited field change; `field` is a stable key localized at render time. */
export interface FieldChange {
  field: string;
  old?: string | null;
  new?: string | null;
}

export interface EventMomentMetadata {
  starts_at?: string | null;
  starts_at_display?: string | null;
  timezone?: string | null;
}

export type ProjectChangeEvent = "updated" | "removed";
export type CastingChangeEvent = "updated" | "removed";

/** Attendance status (PRESENT/LATE/EXCUSED/ABSENT) or participation RSVP (INV/CON/DEC). */
export type RosterStatusCode = string;

export interface ProjectInvitationMetadata extends EventMomentMetadata {
  project_id: string;
  project_name: string;
  participation_id: string;
  inviter_name?: string;
  /** Legacy display fallback for rows emitted before the canonical event moment. */
  date_range?: string;
  location?: string;
  description?: string;
}

export interface ProjectUpdatedMetadata {
  project_id?: string;
  project_name: string;
  event?: ProjectChangeEvent;
  changes?: FieldChange[];
}

export interface ProjectReminderMetadata extends EventMomentMetadata {
  project_id?: string;
  project_name: string;
  date_range?: string | null;
  location?: string | null;
}

export interface RehearsalScheduledMetadata extends EventMomentMetadata {
  rehearsal_id: string;
  project_id: string;
  project_name: string;
  location?: string;
  focus?: string;
}

export interface RehearsalUpdatedMetadata extends EventMomentMetadata {
  rehearsal_id: string;
  project_id?: string;
  project_name: string;
  location?: string;
  focus?: string;
  changes: FieldChange[];
}

export interface RehearsalCancelledMetadata extends EventMomentMetadata {
  rehearsal_id?: string;
  project_id?: string;
  project_name: string;
  location?: string;
  focus?: string;
}

export interface RehearsalReminderMetadata extends EventMomentMetadata {
  rehearsal_id?: string;
  project_id?: string;
  project_name: string;
  rehearsal_date?: string | null;
  location?: string | null;
  focus?: string | null;
}

export interface PieceCastingMetadata extends EventMomentMetadata {
  piece_id?: string;
  piece_title: string;
  /** Language-neutral VoiceLine CODE (e.g. "B1"), localized at render time.
   *  Legacy rows may carry a pre-rendered label; the renderer falls back to it. */
  voice_line?: string;
  /** The concert this part belongs to (name + `starts_at` moment). */
  project_id?: string;
  project_name?: string;
  event?: CastingChangeEvent;
  changes?: FieldChange[];
}

export interface MaterialUploadedMetadata {
  piece_id?: string;
  piece_title?: string;
  /** What landed: "score" | "recording" — rendered as an accent pill. */
  material_kind?: string;
  composer_name?: string;
}

export interface AbsenceStatusMetadata extends EventMomentMetadata {
  rehearsal_id: string;
  project_name?: string;
  /** Legacy display fallback for rows emitted before the canonical event moment. */
  rehearsal_date?: string;
}

export interface ManagerActionMetadata extends EventMomentMetadata {
  project_name: string;
  artist_name: string;
  artist_id?: string;
  project_id?: string;
  rehearsal_id?: string;
  /** Legacy display fallback for rows emitted before the canonical event moment. */
  rehearsal_date?: string;
  status?: RosterStatusCode;
  previous_status?: RosterStatusCode;
  minutes_late?: number | null;
  excuse_note?: string | null;
}

export interface CustomAdminMessageMetadata {
  title: string;
  message: string;
  sender_id: string;
  sender_name: string;
  level: NotificationLevel;
  cta_url?: string | null;
  cta_label?: string | null;
}

export interface NotificationReadReceiptMetadata {
  artist_name: string;
  artist_id: string;
  original_title: string;
  read_at: string;
}

export interface MessageReceivedMetadata {
  thread_id?: string | null;
  title: string;
  sender_name: string;
  message: string;
  snippet: string;
  cta_url?: string;
}

export interface ChannelMessageMetadata {
  channel_id?: string | null;
  project_name: string;
  sender_name: string;
  snippet?: string | null;
}

export type DefaultMetadata = Record<string, unknown>;

// ==========================================
// DISCRIMINATED UNION DATA TRANSFER OBJECT
// ==========================================

export interface BaseNotification {
  id: string;
  level: NotificationLevel;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export type NotificationDTO = BaseNotification &
  (
    | {
        notification_type: "PROJECT_INVITATION";
        metadata: ProjectInvitationMetadata;
      }
    | { notification_type: "PROJECT_UPDATED"; metadata: ProjectUpdatedMetadata }
    | {
        notification_type: "REHEARSAL_SCHEDULED";
        metadata: RehearsalScheduledMetadata;
      }
    | {
        notification_type: "REHEARSAL_UPDATED";
        metadata: RehearsalUpdatedMetadata;
      }
    | {
        notification_type: "REHEARSAL_CANCELLED";
        metadata: RehearsalCancelledMetadata;
      }
    | {
        notification_type: "REHEARSAL_REMINDER";
        metadata: RehearsalReminderMetadata;
      }
    | {
        notification_type: "PIECE_CASTING_ASSIGNED" | "PIECE_CASTING_UPDATED";
        metadata: PieceCastingMetadata;
      }
    | { notification_type: "MATERIAL_UPLOADED"; metadata: MaterialUploadedMetadata }
    | {
        notification_type: "ABSENCE_APPROVED" | "ABSENCE_REJECTED";
        metadata: AbsenceStatusMetadata;
      }
    | {
        notification_type:
          | "PARTICIPATION_RESPONSE"
          | "ATTENDANCE_SUBMITTED"
          | "ABSENCE_REQUESTED";
        metadata: ManagerActionMetadata;
      }
    | {
        notification_type:
          | "PROJECT_CANCELLED"
          | "CONTRACT_ISSUED"
          | "SYSTEM_ALERT";
        metadata: DefaultMetadata;
      }
    | { notification_type: "PROJECT_REMINDER"; metadata: ProjectReminderMetadata }
    | {
        notification_type: "CUSTOM_ADMIN_MESSAGE";
        metadata: CustomAdminMessageMetadata;
      }
    | {
        notification_type: "NOTIFICATION_READ_RECEIPT";
        metadata: NotificationReadReceiptMetadata;
      }
    | {
        notification_type: "MESSAGE_RECEIVED";
        metadata: MessageReceivedMetadata;
      }
    | {
        notification_type: "CHANNEL_MESSAGE";
        metadata: ChannelMessageMetadata;
      }
  );

export interface UnreadCountResponse {
  /** True per-item unread total — drives the panel header + "mark all read". */
  unread_count: number;
  /** Unread items that arrived since the user last opened the centre — drives
   *  the bell badge, and clears on open without changing read state. */
  new_count: number;
}

export interface NotificationPreferenceDTO {
  notification_type: NotificationType;
  email_enabled: boolean;
  push_enabled: boolean;
  label?: string;
  /** The shared default contract for this type — drives the "recommended" badge
   *  and Restore-recommended without re-deriving the backend policy. */
  recommended_email?: boolean;
  recommended_push?: boolean;
}

export type NotificationPreferenceUpdateDTO =
  Partial<
    Pick<
      NotificationPreferenceDTO,
      "email_enabled" | "push_enabled"
    >
  > & {
    notification_type: NotificationType;
  };

export interface PushDeviceRegisterDTO {
  registration_token: string;
  device_type?: "WEB" | "IOS" | "ANDROID";
}

export interface WebPushSubscribeDTO {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

export interface SendToArtistPayload {
  artist_id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  cta_url?: string | null;
  cta_label?: string | null;
}

export interface SendToArtistResponse {
  status: "dispatched";
}
