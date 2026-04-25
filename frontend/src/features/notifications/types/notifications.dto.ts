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
  | "CREW_ASSIGNED"
  | "CONTRACT_ISSUED"
  | "ABSENCE_REQUESTED"
  | "ABSENCE_APPROVED"
  | "ABSENCE_REJECTED"
  | "SYSTEM_ALERT"
  | "PARTICIPATION_RESPONSE"
  | "ATTENDANCE_SUBMITTED"
  | "CUSTOM_ADMIN_MESSAGE"
  | "NOTIFICATION_READ_RECEIPT";

// ==========================================
// STRICT METADATA PAYLOADS
// ==========================================

export interface ProjectInvitationMetadata {
  project_id: string;
  project_name: string;
  participation_id: string;
  inviter_name: string;
  date_range: string;
  location: string;
  description: string;
  message?: string;
}

export interface ProjectUpdatedMetadata {
  project_id?: string;
  project_name: string;
  message?: string;
  changes?: string[];
}

export interface RehearsalScheduledMetadata {
  rehearsal_id: string;
  project_id: string;
  project_name: string;
}

export interface RehearsalUpdatedMetadata {
  rehearsal_id: string;
  project_name: string;
  changes: string[];
}

export interface RehearsalCancelledMetadata {
  project_name: string;
  message: string;
}

export interface PieceCastingMetadata {
  piece_id?: string;
  piece_title: string;
  voice_line?: string;
  message?: string;
}

export interface MaterialUploadedMetadata {
  piece_id: string;
  piece_title: string;
  message?: string;
}

export interface CrewAssignedMetadata {
  project_id: string;
  project_name: string;
  role: string;
}

export interface AbsenceStatusMetadata {
  rehearsal_id: string;
  project_name?: string;
  rehearsal_date?: string;
}

export interface ManagerActionMetadata {
  project_name: string;
  artist_name: string;
  action_details: string;
  rehearsal_date?: string;
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
        notification_type: "PIECE_CASTING_ASSIGNED" | "PIECE_CASTING_UPDATED";
        metadata: PieceCastingMetadata;
      }
    | { notification_type: "MATERIAL_UPLOADED"; metadata: MaterialUploadedMetadata }
    | { notification_type: "CREW_ASSIGNED"; metadata: CrewAssignedMetadata }
    | {
        notification_type:
          | "ABSENCE_APPROVED"
          | "ABSENCE_REJECTED"
          | "ABSENCE_REQUESTED";
        metadata: AbsenceStatusMetadata;
      }
    | {
        notification_type: "PARTICIPATION_RESPONSE" | "ATTENDANCE_SUBMITTED";
        metadata: ManagerActionMetadata;
      }
    | {
        notification_type:
          | "PROJECT_CANCELLED"
          | "PROJECT_REMINDER"
          | "REHEARSAL_REMINDER"
          | "CONTRACT_ISSUED"
          | "SYSTEM_ALERT";
        metadata: DefaultMetadata;
      }
    | {
        notification_type: "CUSTOM_ADMIN_MESSAGE";
        metadata: CustomAdminMessageMetadata;
      }
    | {
        notification_type: "NOTIFICATION_READ_RECEIPT";
        metadata: NotificationReadReceiptMetadata;
      }
  );

export interface UnreadCountResponse {
  unread_count: number;
}
