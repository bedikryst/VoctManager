// frontend/src/features/notifications/api/notifications.service.ts

import api, { type AuthRequestConfig } from "@/shared/api/api";
import type {
  NotificationDTO,
  SendToArtistPayload,
  SendToArtistResponse,
  UnreadCountResponse,
} from "../types/notifications.dto";

export type { SendToArtistPayload } from "../types/notifications.dto";

const NOTIFICATIONS_BASE_URL = "/api/notifications/";

/** One page of the (cursor-paginated) bell feed. */
export interface NotificationsPage {
  results: NotificationDTO[];
  /** Relative path+query for the next (older) page, or null when exhausted. */
  next: string | null;
}

/** DRF emits absolute `next` URLs; normalize to a same-origin relative path so
 *  the request honours the axios baseURL / dev proxy instead of the raw host. */
const toRelativePath = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

export const NotificationService = {
  getPage: async (cursor?: string | null): Promise<NotificationsPage> => {
    // Opt out of the global `.results` unwrap so we keep the cursor `next`.
    const response = await api.get(cursor || NOTIFICATIONS_BASE_URL, {
      skipUnwrap: true,
    } as AuthRequestConfig);
    const data = response.data as
      | { results?: NotificationDTO[]; next?: string | null }
      | NotificationDTO[];
    // Tolerate a legacy unpaginated array payload as a single, terminal page.
    if (Array.isArray(data)) return { results: data, next: null };
    return { results: data.results ?? [], next: toRelativePath(data.next) };
  },

  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await api.get<UnreadCountResponse>(
      `${NOTIFICATIONS_BASE_URL}unread-count/`,
    );
    return response.data;
  },

  /** Stamp the centre as "seen" — clears the bell badge without marking reads. */
  markSeen: async (): Promise<void> => {
    await api.post(`${NOTIFICATIONS_BASE_URL}mark-seen/`, {});
  },

  markAsRead: async (id: string): Promise<NotificationDTO> => {
    const response = await api.patch<NotificationDTO>(
      `${NOTIFICATIONS_BASE_URL}${id}/mark-read/`,
      {},
    );
    return response.data;
  },

  markAllAsRead: async (): Promise<void> => {
    await api.post(`${NOTIFICATIONS_BASE_URL}mark-all-read/`, {});
  },

  sendToArtist: async (
    payload: SendToArtistPayload,
  ): Promise<SendToArtistResponse> => {
    const response = await api.post<SendToArtistResponse>(
      `${NOTIFICATIONS_BASE_URL}send-to-artist/`,
      payload,
    );
    return response.data;
  },
};
