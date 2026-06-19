/**
 * @file messages.dto.ts
 * @description Client-side contracts for the messaging domain (async conductor↔chorister
 * threads). Mirrors the DRF serializers in backend/messaging.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/types
 */

export type ThreadContextType = "GENERAL" | "PROJECT";
export type ThreadStatus = "OPEN" | "RESOLVED" | "ARCHIVED";

export interface UserBrief {
  id: number;
  name: string;
  /** Small avatar render; null/undefined → initials fallback. */
  avatar_url?: string | null;
}

export interface ThreadArtistBrief {
  id: string;
  name: string;
  voice_type: string;
  /** Small avatar render; null/undefined → initials fallback. */
  avatar_url?: string | null;
}

export interface MessageDTO {
  id: string;
  body: string;
  created_at: string;
  sender: UserBrief | null;
  is_mine: boolean;
}

export interface ThreadSummary {
  id: string;
  subject: string;
  context_type: ThreadContextType;
  context_id: string | null;
  status: ThreadStatus;
  last_message_at: string;
  created_at: string;
  artist: ThreadArtistBrief;
  assignee: UserBrief | null;
  unread: boolean;
  snippet: string;
}

export type ThreadDetail = Omit<ThreadSummary, "snippet"> & {
  messages: MessageDTO[];
};

export interface CreateThreadPayload {
  subject: string;
  body: string;
  context_type?: ThreadContextType;
  context_id?: string | null;
  /** Manager-initiated: the target artist. */
  artist_id?: string | null;
  /** Artist-initiated: the chosen manager (routing hint). */
  assignee_id?: number | null;
}

export interface PostMessagePayload {
  body: string;
}

export interface ThreadUpdatePayload {
  assignee_id?: number | null;
  status?: ThreadStatus;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export interface ThreadListParams {
  assignee?: "me" | "unassigned";
  status?: ThreadStatus;
  context_type?: ThreadContextType;
}

// ---------------------------------------------------------------------------
// Project channels (group conversation per project)
// ---------------------------------------------------------------------------

export interface ChannelMessageDTO {
  id: string;
  body: string;
  created_at: string;
  is_pinned: boolean;
  sender: UserBrief | null;
  is_mine: boolean;
}

export interface ChannelSummary {
  id: string;
  project_id: string;
  project_name: string;
  last_message_at: string | null;
  created_at: string;
  unread: boolean;
  member_count: number;
  snippet: string;
}

export type ChannelDetail = Omit<ChannelSummary, "snippet"> & {
  my_push_enabled: boolean;
  messages: ChannelMessageDTO[];
};
