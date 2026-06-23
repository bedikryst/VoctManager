/**
 * @file messages.queries.ts
 * @description TanStack Query hooks for the messaging domain. 30s polling mirrors
 * the notifications inbox (push does not yet invalidate the RQ cache). The reply
 * mutation applies an optimistic message bubble, rolling back on error.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/api
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18n from "@/shared/config/i18n";
import { toastApiError } from "@/shared/api/errors";

import { ChannelService, MessagingService } from "./messages.service";
import type {
  ChannelDetail,
  ChannelMessageDTO,
  CreateThreadPayload,
  MessageDTO,
  ThreadDetail,
  ThreadListParams,
  ThreadSummary,
  ThreadUpdatePayload,
  UserBrief,
} from "../types/messages.dto";

const POLLING_INTERVAL = 1000 * 30;

export const messagingKeys = {
  all: ["messaging"] as const,
  threads: (params?: ThreadListParams) =>
    [...messagingKeys.all, "threads", params ?? {}] as const,
  thread: (id: string) => [...messagingKeys.all, "thread", id] as const,
  unreadCount: () => [...messagingKeys.all, "unread-count"] as const,
  recipients: () => [...messagingKeys.all, "recipients"] as const,
};

export const useThreads = (params?: ThreadListParams, enabled = true) =>
  useQuery({
    queryKey: messagingKeys.threads(params),
    queryFn: () => MessagingService.list(params),
    staleTime: POLLING_INTERVAL,
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
    enabled,
  });

export const useThread = (id: string | undefined) =>
  useQuery({
    queryKey: messagingKeys.thread(id ?? "none"),
    queryFn: () => MessagingService.get(id as string),
    enabled: !!id,
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
  });

export const useUnreadThreadCount = (enabled = true) =>
  useQuery({
    queryKey: messagingKeys.unreadCount(),
    queryFn: MessagingService.unreadCount,
    staleTime: POLLING_INTERVAL,
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
    enabled,
  });

export const useRecipients = (enabled = true) =>
  useQuery({
    queryKey: messagingKeys.recipients(),
    queryFn: MessagingService.recipients,
    staleTime: 1000 * 60 * 10,
    enabled,
  });

export const useCreateThread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateThreadPayload) =>
      MessagingService.create(payload),
    onSuccess: (thread) => {
      queryClient.setQueryData(messagingKeys.thread(thread.id), thread);
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
};

interface OptimisticContext {
  previous?: ThreadDetail;
}

export const usePostMessage = (threadId: string, me: UserBrief) => {
  const queryClient = useQueryClient();
  return useMutation<MessageDTO, unknown, string, OptimisticContext>({
    mutationFn: (body: string) =>
      MessagingService.postMessage(threadId, { body }),
    onMutate: async (body) => {
      const key = messagingKeys.thread(threadId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ThreadDetail>(key);
      if (previous) {
        const optimistic: MessageDTO = {
          id: `optimistic-${Date.now()}`,
          body,
          created_at: new Date().toISOString(),
          sender: me,
          is_mine: true,
        };
        queryClient.setQueryData<ThreadDetail>(key, {
          ...previous,
          messages: [...previous.messages, optimistic],
          last_message_at: optimistic.created_at,
        });
      }
      return { previous };
    },
    onError: (error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          messagingKeys.thread(threadId),
          context.previous,
        );
      }
      toastApiError(error, undefined, {
        fallbackDescription: i18n.t(
          "messages.send_failed",
          "Nie udało się wysłać wiadomości.",
        ),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: messagingKeys.thread(threadId),
      });
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
};

export const useMarkThreadRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => MessagingService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
};

export const useUpdateThread = (threadId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ThreadUpdatePayload) =>
      MessagingService.update(threadId, payload),
    onSuccess: (thread) => {
      queryClient.setQueryData(messagingKeys.thread(thread.id), thread);
      queryClient.invalidateQueries({ queryKey: messagingKeys.threads() });
    },
  });
};

// ---------------------------------------------------------------------------
// Project channels
// ---------------------------------------------------------------------------

export const channelKeys = {
  all: ["messaging", "channels"] as const,
  list: () => [...channelKeys.all, "list"] as const,
  detail: (id: string) => [...channelKeys.all, "detail", id] as const,
};

export const useChannels = (enabled = true) =>
  useQuery({
    queryKey: channelKeys.list(),
    queryFn: ChannelService.list,
    staleTime: POLLING_INTERVAL,
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
    enabled,
  });

export const useChannel = (id: string | undefined) =>
  useQuery({
    queryKey: channelKeys.detail(id ?? "none"),
    queryFn: () => ChannelService.get(id as string),
    enabled: !!id,
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
  });

interface ChannelOptimisticContext {
  previous?: ChannelDetail;
}

export const usePostChannelMessage = (channelId: string, me: UserBrief) => {
  const queryClient = useQueryClient();
  return useMutation<ChannelMessageDTO, unknown, string, ChannelOptimisticContext>({
    mutationFn: (body: string) => ChannelService.postMessage(channelId, body),
    onMutate: async (body) => {
      const key = channelKeys.detail(channelId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChannelDetail>(key);
      if (previous) {
        const optimistic: ChannelMessageDTO = {
          id: `optimistic-${Date.now()}`,
          body,
          created_at: new Date().toISOString(),
          is_pinned: false,
          sender: me,
          is_mine: true,
        };
        queryClient.setQueryData<ChannelDetail>(key, {
          ...previous,
          messages: [...previous.messages, optimistic],
          last_message_at: optimistic.created_at,
        });
      }
      return { previous };
    },
    onError: (error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(channelKeys.detail(channelId), context.previous);
      }
      toastApiError(error, undefined, {
        fallbackDescription: i18n.t(
          "messages.send_failed",
          "Nie udało się wysłać wiadomości.",
        ),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.detail(channelId) });
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
};

/**
 * Manager broadcast: post a message to a project channel and (optionally) pin it as
 * an announcement. Two sequential calls — post returns the new message id, then pin.
 */
export const usePostChannelAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      channelId,
      body,
      pin,
    }: {
      channelId: string;
      body: string;
      pin: boolean;
    }) => {
      const message = await ChannelService.postMessage(channelId, body);
      if (pin) {
        await ChannelService.pin(channelId, message.id, true);
      }
      return message;
    },
    onSuccess: (_message, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: channelKeys.detail(channelId) });
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
};

export const useMarkChannelRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ChannelService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
};

export const useSetChannelPush = (channelId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => ChannelService.setPush(channelId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.detail(channelId) });
    },
  });
};

export const usePinChannelMessage = (channelId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: string; pinned: boolean }) =>
      ChannelService.pin(channelId, messageId, pinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.detail(channelId) });
    },
  });
};

export type { ThreadSummary };
