// frontend/src/features/notifications/api/notifications.queries.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationService } from "./notifications.service";

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

const POLLING_INTERVAL = 1000 * 30;

// 1. Fetch entire inbox
export const useNotifications = () =>
  useQuery({
    queryKey: notificationKeys.lists(),
    queryFn: NotificationService.getAll,
    staleTime: POLLING_INTERVAL,
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
  });

// 2. Smart Polling for the Bell Icon
export const useUnreadNotificationCount = () =>
  useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: NotificationService.getUnreadCount,
    staleTime: POLLING_INTERVAL,
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
  });

// 3. Mutation: Mark single notification as read
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => NotificationService.markAsRead(id),
    onSuccess: () => {
      // Invalidate both lists and unread count to force immediate UI updates
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};

// 4. Mutation: Mark all as read
export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => NotificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};
