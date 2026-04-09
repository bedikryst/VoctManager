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
  | "SYSTEM_ALERT";

// ==========================================
// STRICT METADATA PAYLOADS
// ==========================================

export interface ProjectInvitationMetadata {
  project_id: string;
  project_name: string;
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

export interface CrewAssignedMetadata {
  project_id: string;
  project_name: string;
  role: string;
}

export interface AbsenceStatusMetadata {
  rehearsal_id: string;
}

/** * Fallback for types that are defined in NotificationType but do not
 * have a strict strict metadata schema implemented yet.
 */
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

/**
 * Enterprise DTO utilizing Discriminated Unions.
 * This guarantees type safety in React components based on the notification_type.
 */
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
    | { notification_type: "CREW_ASSIGNED"; metadata: CrewAssignedMetadata }
    | {
        notification_type:
          | "ABSENCE_APPROVED"
          | "ABSENCE_REJECTED"
          | "ABSENCE_REQUESTED";
        metadata: AbsenceStatusMetadata;
      }
    // Types that currently don't have distinct strictly typed payloads yet
    | {
        notification_type:
          | "PROJECT_CANCELLED"
          | "PROJECT_REMINDER"
          | "REHEARSAL_REMINDER"
          | "MATERIAL_UPLOADED"
          | "CONTRACT_ISSUED"
          | "SYSTEM_ALERT";
        metadata: DefaultMetadata;
      }
  );

export interface UnreadCountResponse {
  unread_count: number;
}
