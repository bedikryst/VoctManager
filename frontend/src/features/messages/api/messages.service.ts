/**
 * @file messages.service.ts
 * @description Thin Axios client for the messaging API. The global interceptor
 * leaves the unpaginated array responses untouched (no `.results` wrapper).
 * @architecture Enterprise SaaS 2026
 * @module features/messages/api
 */

import api from "@/shared/api/api";
import type {
  ChannelDetail,
  ChannelMessageDTO,
  ChannelSummary,
  CreateThreadPayload,
  MessageDTO,
  PostMessagePayload,
  ThreadDetail,
  ThreadListParams,
  ThreadSummary,
  ThreadUpdatePayload,
  UnreadCountResponse,
  UserBrief,
} from "../types/messages.dto";

const BASE_URL = "/api/messaging/threads/";
const CHANNELS_URL = "/api/messaging/channels/";

export const MessagingService = {
  list: async (params?: ThreadListParams): Promise<ThreadSummary[]> => {
    const response = await api.get<ThreadSummary[]>(BASE_URL, { params });
    return response.data;
  },

  get: async (id: string): Promise<ThreadDetail> => {
    const response = await api.get<ThreadDetail>(`${BASE_URL}${id}/`);
    return response.data;
  },

  create: async (payload: CreateThreadPayload): Promise<ThreadDetail> => {
    const response = await api.post<ThreadDetail>(BASE_URL, payload);
    return response.data;
  },

  postMessage: async (
    id: string,
    payload: PostMessagePayload,
  ): Promise<MessageDTO> => {
    const response = await api.post<MessageDTO>(
      `${BASE_URL}${id}/messages/`,
      payload,
    );
    return response.data;
  },

  markRead: async (id: string): Promise<void> => {
    await api.post(`${BASE_URL}${id}/read/`, {});
  },

  update: async (
    id: string,
    payload: ThreadUpdatePayload,
  ): Promise<ThreadDetail> => {
    const response = await api.patch<ThreadDetail>(`${BASE_URL}${id}/`, payload);
    return response.data;
  },

  unreadCount: async (): Promise<number> => {
    const response = await api.get<UnreadCountResponse>(
      `${BASE_URL}unread-count/`,
    );
    return response.data.unread_count;
  },

  recipients: async (): Promise<UserBrief[]> => {
    const response = await api.get<UserBrief[]>(`${BASE_URL}recipients/`);
    return response.data;
  },
};

export const ChannelService = {
  list: async (): Promise<ChannelSummary[]> => {
    const response = await api.get<ChannelSummary[]>(CHANNELS_URL);
    return response.data;
  },

  get: async (id: string): Promise<ChannelDetail> => {
    const response = await api.get<ChannelDetail>(`${CHANNELS_URL}${id}/`);
    return response.data;
  },

  byProject: async (projectId: string): Promise<ChannelDetail> => {
    const response = await api.get<ChannelDetail>(`${CHANNELS_URL}by-project/${projectId}/`);
    return response.data;
  },

  postMessage: async (id: string, body: string): Promise<ChannelMessageDTO> => {
    const response = await api.post<ChannelMessageDTO>(`${CHANNELS_URL}${id}/messages/`, { body });
    return response.data;
  },

  markRead: async (id: string): Promise<void> => {
    await api.post(`${CHANNELS_URL}${id}/read/`, {});
  },

  setPush: async (id: string, pushEnabled: boolean): Promise<void> => {
    await api.patch(`${CHANNELS_URL}${id}/membership/`, { push_enabled: pushEnabled });
  },

  pin: async (id: string, messageId: string, pinned: boolean): Promise<ChannelMessageDTO> => {
    const response = await api.post<ChannelMessageDTO>(
      `${CHANNELS_URL}${id}/messages/${messageId}/pin/`,
      { pinned },
    );
    return response.data;
  },
};
