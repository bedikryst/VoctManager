// frontend/src/features/notifications/api/notifications.queries.ts

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { NotificationService, type SendToArtistPayload } from "./notifications.service";
import type { UnreadCountResponse } from "../types/notifications.dto";

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

const POLLING_INTERVAL = 1000 * 30;

// 1. Cursor-paginated inbox. `select` flattens pages into a single newest-first
//    array, so list consumers keep a plain `NotificationDTO[]`; the panel uses
//    `fetchNextPage`/`hasNextPage` to reveal older history on demand.
export const useNotifications = (enabled: boolean = true) =>
  useInfiniteQuery({
    queryKey: notificationKeys.lists(),
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      NotificationService.getPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.results),
    staleTime: POLLING_INTERVAL,
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
    enabled,
  });

// 2. Smart Polling for the Bell Icon
export const useUnreadNotificationCount = (enabled: boolean = true) =>
  useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: NotificationService.getUnreadCount,
    staleTime: POLLING_INTERVAL,
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
    enabled,
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

// 3b. Mutation: stamp the centre as "seen" — clears the bell badge on open
//     without marking any notification read. Optimistic so the badge clears
//     instantly, then reconciled against the server.
export const useMarkNotificationsSeen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => NotificationService.markSeen(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount() });
      const previous = queryClient.getQueryData<UnreadCountResponse>(
        notificationKeys.unreadCount(),
      );
      if (previous) {
        queryClient.setQueryData<UnreadCountResponse>(notificationKeys.unreadCount(), {
          ...previous,
          new_count: 0,
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
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

// 5. Mutation: Manager sends a direct message to an artist
export const useSendToArtist = () =>
  useMutation({
    mutationFn: (payload: SendToArtistPayload) =>
      NotificationService.sendToArtist(payload),
  });
