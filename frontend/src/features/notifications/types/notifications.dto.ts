// frontend/src/features/notifications/types/notifications.dto.ts

export type NotificationLevel = "INFO" | "WARNING" | "URGENT";

export type NotificationType =
  | "PROJECT_INVITATION"
  | "PROJECT_UPDATED"
  | "PROJECT_CANCELLED"
  | "PROJECT_REMINDER"
  | "PROJECT_BRIEFING"
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
  | "ANNOUNCEMENT_PENDING"
  | "SITE_COPY_PROPOSED"
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

/** One rehearsal inside an invitation's schedule block. */
export interface InvitationRehearsalMetadata extends EventMomentMetadata {
  rehearsal_id: string;
  location?: string;
  focus?: string;
  is_mandatory?: boolean;
}

/**
 * An invitation is the only message a singer gets before answering, so it states
 * the real cost of saying yes. Everything below `description` arrives with a
 * project published under the publication model; rows emitted before it — and
 * invitations to an artist joining a live project without a schedule — simply
 * omit them, so every consumer must tolerate their absence.
 */
export interface ProjectInvitationMetadata extends EventMomentMetadata {
  project_id: string;
  project_name: string;
  participation_id: string;
  inviter_name?: string;
  /** Legacy display fallback for rows emitted before the canonical event moment. */
  date_range?: string;
  location?: string;
  description?: string;
  call_time_at?: string;
  call_time_display?: string;
  dress_code?: string;
  rehearsals?: InvitationRehearsalMetadata[];
  /** Ordered programme, as piece titles. */
  program?: string[];
  /** This artist's own voice lines, as language-neutral VoiceLine codes. */
  voice_lines?: string[];
  /** Every line the programme divides into — the scope those codes are NAMED
   *  in. Empty on rows written before it existed; those keep their index. */
  voice_scope?: string[];
}

export interface ProjectUpdatedMetadata {
  project_id?: string;
  project_name: string;
  event?: ProjectChangeEvent;
  changes?: FieldChange[];
}

/** What a briefing item is about, and which lifecycle step it records. Mirrors
 *  the backend AnnouncementSubject / AnnouncementKind. */
export type BriefingSubject = "PROJECT" | "REHEARSAL" | "CASTING";
export type BriefingKind = "CREATED" | "CHANGED" | "REMOVED";

/**
 * One change inside a briefing. `metadata` is the payload the emitting service
 * built, untouched — so a briefing line renders from exactly the same facts as
 * the standalone notification it would otherwise have been, and the row needs no
 * second vocabulary for a rehearsal or a part.
 */
export interface BriefingItemMetadata {
  subject_type: BriefingSubject;
  kind: BriefingKind;
  notification_type: NotificationType;
  level: NotificationLevel;
  metadata: DefaultMetadata;
}

/**
 * Everything one artist has not been told about one project, published as a
 * single message. A recipient with only one piece of news never receives this —
 * they get that event's own notification, which names it more precisely.
 */
export interface ProjectBriefingMetadata {
  project_id?: string;
  project_name: string;
  /** The conductor's own words, written when publishing the queue. */
  note?: string;
  items?: BriefingItemMetadata[];
}

/**
 * A live project whose announcement queue has been sitting unpublished, raised by
 * the clock rather than by an edit. Manager-only: it is a prompt to act, and only
 * a manager may publish.
 *
 * `change_count` is the same number the project hub's pill shows and
 * `recipient_count` is how many people are still in the dark. How many messages
 * publication would actually send belongs to the review sheet's confirm button —
 * a third number here would only be one more thing to reconcile.
 */
export interface AnnouncementPendingMetadata {
  project_id: string;
  project_name: string;
  change_count?: number;
  recipient_count?: number;
  /** A count, not a rendered duration — the viewer's language decides whether it
   *  reads as hours or days. */
  waiting_hours?: number;
}

/** One page an editor touched during a sitting at the copy desk. `label` is the
 *  page's own name as the site prints it — a name, not copy to translate. */
export interface CopyScopeMetadata {
  scope: string;
  label?: string;
  count?: number;
}

/**
 * An editor's sitting at the copy desk, gathered into one message once they have
 * stopped. Staff-only: the reader is whoever applies an accepted proposal to the
 * repository and commits it.
 *
 * `locales` carries bare codes, never language names — whether "en" reads as
 * "English", "angielski" or "anglais" is answered in the viewer's language here.
 */
export interface SiteCopyProposedMetadata {
  author_id?: number | null;
  author_name: string;
  proposal_count?: number;
  scopes?: CopyScopeMetadata[];
  locales?: string[];
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
  /** The bound arrangement's lines — the scope `voice_line` is named in, so a
   *  piece with one tenor line reads "Tenor". Empty on legacy rows. */
  voice_scope?: string[];
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
        notification_type: "PROJECT_BRIEFING";
        metadata: ProjectBriefingMetadata;
      }
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
        notification_type: "ANNOUNCEMENT_PENDING";
        metadata: AnnouncementPendingMetadata;
      }
    | {
        notification_type: "SITE_COPY_PROPOSED";
        metadata: SiteCopyProposedMetadata;
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

/**
 * The consequence a reader is actually answering for. Not a topic: "something I
 * committed to has changed" is a decision a chorister can make; "PROJECT_UPDATED
 * but not REHEARSAL_UPDATED" is not. Server-owned — see notifications/delivery.py.
 */
export type NotificationGroupId =
  | "commitments"
  | "requests"
  | "messages"
  | "materials"
  | "safety_net"
  | "site_copy"
  | "team";

export interface NotificationPreferenceGroupDTO {
  id: NotificationGroupId;
  manager_only: boolean;
  /** What the group's control targets. Never null: a type that disagrees with its
   *  neighbours gets its own group, so every group can state one answer. */
  recommended_email: boolean;
  recommended_push: boolean;
}

export interface NotificationPreferenceDTO {
  notification_type: NotificationType;
  /** Which group speaks for this row. Assigned by the backend, never inferred
   *  here — the ledger and the router must not hold two different maps. */
  group: NotificationGroupId;
  email_enabled: boolean;
  push_enabled: boolean;
  label?: string;
  /** The shared default contract for this type — drives the "recommended" badge
   *  and Restore-recommended without re-deriving the backend policy. */
  recommended_email?: boolean;
  recommended_push?: boolean;
}

/**
 * The settings ledger: the groups a reader decides in, and the per-type rows
 * behind each one. Rows stay flat and keyed by type because that is still the
 * storage grain — a group control writes all of its members at once, and the
 * details disclosure writes exactly one.
 */
export interface NotificationPreferenceMatrixDTO {
  groups: NotificationPreferenceGroupDTO[];
  preferences: NotificationPreferenceDTO[];
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
