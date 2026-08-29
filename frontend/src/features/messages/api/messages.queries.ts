/**
 * @file messages.queries.ts
 * @description TanStack Query hooks for the messaging domain. The inbox polls at
 * 30s like the notifications inbox; an OPEN conversation polls faster and never
 * treats its cache as fresh (see CONVERSATION_POLLING_INTERVAL). The reply
 * mutation applies an optimistic message bubble, rolling back on error.
 *
 * A conversation's history is WINDOWED by the API, so the cache — not the last
 * response — is what holds the conversation: the poll asks only for what arrived
 * since the newest message it already has, and every answer is folded in (see
 * lib/conversationWindow). That is why these query functions read the cache
 * before they fetch.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/api
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18n from "@/shared/config/i18n";
import { toastApiError } from "@/shared/api/errors";
import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import {
  mergeConversation,
  mergeMessages,
  pollCursor,
  withoutMessage,
} from "../lib/conversationWindow";
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

/**
 * An open conversation is read as live, so it polls faster than the inbox — and,
 * more importantly, it carries no freshness window at all (`staleTime: 0` +
 * {@link RECONCILING_REFETCH}). On a phone the poll timer is the ONE refresh path
 * the platform suspends: the app is frozen while it sits in the background, and
 * every attempt to "refresh" by leaving the thread and re-entering it restarts
 * the interval from zero. With a positive staleTime inherited from the client
 * default, remount / focus / reconnect all decline to refetch, so the reply that
 * just fired a push notification stays invisible until the reader writes
 * something themselves (a mutation invalidates unconditionally). Freshness here
 * is decided per event, never per clock.
 */
const CONVERSATION_POLLING_INTERVAL = 1000 * 10;

/** Freshness contract shared by the thread and channel conversation panes. */
const CONVERSATION_FRESHNESS = {
  staleTime: 0,
  refetchInterval: CONVERSATION_POLLING_INTERVAL,
  ...RECONCILING_REFETCH,
} as const;

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

export const useThread = (id: string | undefined) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: messagingKeys.thread(id ?? "none"),
    queryFn: async () => {
      const key = messagingKeys.thread(id as string);
      const held = queryClient.getQueryData<ThreadDetail>(key);
      const since = pollCursor(held?.messages);
      const fresh = await MessagingService.get(id as string, since ? { since } : undefined);
      return mergeConversation(held, fresh, !!since);
    },
    enabled: !!id,
    ...CONVERSATION_FRESHNESS,
  });
};

/**
 * Walks one page back from the oldest message the reader holds. A read, run as a
 * mutation because it is an act rather than a subscription: it happens when a
 * finger asks for it, and the button needs its pending state.
 */
export const useOlderThreadMessages = (threadId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (before: string) => MessagingService.messageWindow(threadId, { before }),
    onSuccess: (window) => {
      queryClient.setQueryData<ThreadDetail>(messagingKeys.thread(threadId), (held) =>
        held
          ? {
              ...held,
              messages: mergeMessages(held.messages, window.messages, false),
              messages_page: window.messages_page,
            }
          : held,
      );
    },
    onError: (error) => {
      toastApiError(error, undefined, {
        fallbackDescription: i18n.t(
          "messages.conversation.older_failed",
          "Nie udało się wczytać wcześniejszych wiadomości.",
        ),
      });
    },
  });
};

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

/**
 * The optimistic bubble is undone by ITS OWN ID, never by restoring a snapshot:
 * the conversation polls while a send is in flight, so a snapshot taken before
 * the POST can already be missing messages by the time the POST answers.
 */
interface OptimisticContext {
  optimisticId: string;
}

export const usePostMessage = (threadId: string, me: UserBrief) => {
  const queryClient = useQueryClient();
  return useMutation<MessageDTO, unknown, string, OptimisticContext>({
    mutationFn: (body: string) =>
      MessagingService.postMessage(threadId, { body }),
    onMutate: async (body) => {
      const key = messagingKeys.thread(threadId);
      await queryClient.cancelQueries({ queryKey: key });
      const optimistic: MessageDTO = {
        id: `optimistic-${Date.now()}`,
        body,
        created_at: new Date().toISOString(),
        sender: me,
        is_mine: true,
      };
      queryClient.setQueryData<ThreadDetail>(key, (held) =>
        held
          ? {
              ...held,
              messages: [...held.messages, optimistic],
              last_message_at: optimistic.created_at,
            }
          : held,
      );
      return { optimisticId: optimistic.id };
    },
    onSuccess: (message, _body, context) => {
      queryClient.setQueryData<ThreadDetail>(messagingKeys.thread(threadId), (held) =>
        held
          ? {
              ...held,
              messages: mergeMessages(
                withoutMessage(held.messages, context.optimisticId),
                [message],
                false,
              ),
            }
          : held,
      );
    },
    onError: (error, _body, context) => {
      if (context) {
        queryClient.setQueryData<ThreadDetail>(messagingKeys.thread(threadId), (held) =>
          held
            ? { ...held, messages: withoutMessage(held.messages, context.optimisticId) }
            : held,
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
      // A triage PATCH answers with the conversation's head and its tail window;
      // folding it in keeps whatever older history the reader had loaded.
      queryClient.setQueryData<ThreadDetail>(messagingKeys.thread(thread.id), (held) =>
        mergeConversation(held, thread, false),
      );
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

export const useChannel = (id: string | undefined) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: channelKeys.detail(id ?? "none"),
    queryFn: async () => {
      const key = channelKeys.detail(id as string);
      const held = queryClient.getQueryData<ChannelDetail>(key);
      const since = pollCursor(held?.messages);
      const fresh = await ChannelService.get(id as string, since ? { since } : undefined);
      return mergeConversation(held, fresh, !!since);
    },
    enabled: !!id,
    ...CONVERSATION_FRESHNESS,
  });
};

export const useOlderChannelMessages = (channelId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (before: string) => ChannelService.messageWindow(channelId, { before }),
    onSuccess: (window) => {
      queryClient.setQueryData<ChannelDetail>(channelKeys.detail(channelId), (held) =>
        held
          ? {
              ...held,
              messages: mergeMessages(held.messages, window.messages, false),
              messages_page: window.messages_page,
            }
          : held,
      );
    },
    onError: (error) => {
      toastApiError(error, undefined, {
        fallbackDescription: i18n.t(
          "messages.conversation.older_failed",
          "Nie udało się wczytać wcześniejszych wiadomości.",
        ),
      });
    },
  });
};

export const usePostChannelMessage = (channelId: string, me: UserBrief) => {
  const queryClient = useQueryClient();
  return useMutation<ChannelMessageDTO, unknown, string, OptimisticContext>({
    mutationFn: (body: string) => ChannelService.postMessage(channelId, body),
    onMutate: async (body) => {
      const key = channelKeys.detail(channelId);
      await queryClient.cancelQueries({ queryKey: key });
      const optimistic: ChannelMessageDTO = {
        id: `optimistic-${Date.now()}`,
        body,
        created_at: new Date().toISOString(),
        is_pinned: false,
        sender: me,
        is_mine: true,
      };
      queryClient.setQueryData<ChannelDetail>(key, (held) =>
        held
          ? {
              ...held,
              messages: [...held.messages, optimistic],
              last_message_at: optimistic.created_at,
            }
          : held,
      );
      return { optimisticId: optimistic.id };
    },
    onSuccess: (message, _body, context) => {
      queryClient.setQueryData<ChannelDetail>(channelKeys.detail(channelId), (held) =>
        held
          ? {
              ...held,
              messages: mergeMessages(
                withoutMessage(held.messages, context.optimisticId),
                [message],
                false,
              ),
            }
          : held,
      );
    },
    onError: (error, _body, context) => {
      if (context) {
        queryClient.setQueryData<ChannelDetail>(channelKeys.detail(channelId), (held) =>
          held
            ? { ...held, messages: withoutMessage(held.messages, context.optimisticId) }
            : held,
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
    // Patched in place, not invalidated: the poll answers with a DELTA, and the
    // message just pinned is by definition older than its cursor — a refetch
    // would leave both the bubble and the banner showing the previous state.
    onSuccess: (message) => {
      queryClient.setQueryData<ChannelDetail>(channelKeys.detail(channelId), (held) =>
        held
          ? {
              ...held,
              messages: mergeMessages(held.messages, [message], false),
              pinned_messages: message.is_pinned
                ? mergeMessages(held.pinned_messages, [message], false)
                : withoutMessage(held.pinned_messages, message.id),
            }
          : held,
      );
    },
  });
};

export type { ThreadSummary };
