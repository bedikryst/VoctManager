// frontend/src/features/notifications/api/notifications.service.ts

import api from "../../../shared/api/api";
import type {
  NotificationDTO,
  UnreadCountResponse,
} from "../types/notifications.dto";

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
};
