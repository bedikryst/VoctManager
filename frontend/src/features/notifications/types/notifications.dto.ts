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

export interface NotificationMetadata {
  project_id?: string;
  project_name?: string;
  rehearsal_id?: string;
  piece_id?: string;
  piece_title?: string;
  voice_line?: string;
  role?: string;
  message?: string;
  changes?: string[];
  [key: string]: unknown; // Fallback for future metadata
}

export interface NotificationDTO {
  id: string;
  notification_type: NotificationType;
  level: NotificationLevel;
  is_read: boolean;
  read_at: string | null;
  metadata: NotificationMetadata;
  created_at: string;
}

export interface UnreadCountResponse {
  unread_count: number;
}
