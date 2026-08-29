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

/**
 * What the server says about the window it just sent. `has_older` drives the
 * "earlier messages" affordance; `reset` is the answer to a poll that had
 * fallen too far behind to be given a delta — the client must drop what it
 * holds rather than append, or the conversation gains a hole in its middle.
 */
export interface MessageWindowMeta {
  has_older: boolean;
  reset: boolean;
}

/** The `GET …/messages/?before=` payload: one window and nothing else. */
export interface MessageWindow<T> {
  messages: T[];
  messages_page: MessageWindowMeta;
}

/** Cursors a client may put on a conversation read. Mutually exclusive in practice. */
export interface MessageWindowParams {
  /** Walk backwards from this message id (the oldest one the client holds). */
  before?: string;
  /** Only what arrived after this instant — the poll path. */
  since?: string;
}

export type ThreadDetail = Omit<ThreadSummary, "snippet"> & {
  messages: MessageDTO[];
  messages_page: MessageWindowMeta;
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
  messages_page: MessageWindowMeta;
  /**
   * Every pinned announcement, whatever window it was written in. An
   * announcement from March is precisely what the banner exists for, and it
   * stopped being reachable from `messages` when `messages` became a tail.
   */
  pinned_messages: ChannelMessageDTO[];
};
