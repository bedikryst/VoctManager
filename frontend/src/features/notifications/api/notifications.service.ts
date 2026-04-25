// frontend/src/features/notifications/api/notifications.service.ts

import api from "@/shared/api/api";
import type {
  NotificationDTO,
  NotificationLevel,
  UnreadCountResponse,
} from "../types/notifications.dto";

export interface SendToArtistPayload {
  artist_id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  cta_url?: string | null;
  cta_label?: string | null;
}

const NOTIFICATIONS_BASE_URL = "/api/notifications/";

export const NotificationService = {
  getAll: async (): Promise<NotificationDTO[]> => {
    // API returns paginated results, but your global api interceptor
    // handles unwrapping response.data.results automatically.
    const response = await api.get<NotificationDTO[]>(NOTIFICATIONS_BASE_URL);
    return response.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await api.get<UnreadCountResponse>(
      `${NOTIFICATIONS_BASE_URL}unread-count/`,
    );
    return response.data.unread_count;
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

  sendToArtist: async (payload: SendToArtistPayload): Promise<void> => {
    await api.post(`${NOTIFICATIONS_BASE_URL}send-to-artist/`, payload);
  },
};
