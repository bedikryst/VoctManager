/**
 * @file ChannelView.tsx
 * @description Active project-channel pane: header (project, member count, per-user push
 * toggle), pinned-announcements banner, group message stream (sender shown per row,
 * manager pin/unpin), and a composer everyone can post to. Marks read on open.
 * Async by design — no presence/typing.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Bell, BellOff, Pin, PinOff, Send } from "lucide-react";

import { Heading, Text, Label } from "@/shared/ui/primitives/typography";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Button } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/lib/utils";
import {
  useChannel,
  useMarkChannelRead,
  usePinChannelMessage,
  usePostChannelMessage,
  useSetChannelPush,
} from "../api/messages.queries";
import type { ChannelMessageDTO, UserBrief } from "../types/messages.dto";

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

interface ChannelViewProps {
  channelId: string;
  isManager: boolean;
  me: UserBrief;
  onBack?: () => void;
}

interface ChannelRowProps {
  message: ChannelMessageDTO;
  isManager: boolean;
  onTogglePin: (message: ChannelMessageDTO) => void;
  pinPending: boolean;
}

const ChannelRow: React.FC<ChannelRowProps> = ({ message, isManager, onTogglePin, pinPending }) => (
  <div
    className={cn(
      "group/row flex flex-col rounded-xl border px-4 py-2.5",
      message.is_mine
        ? "bg-ethereal-gold/10 border-ethereal-gold/20"
        : "bg-ethereal-alabaster/60 border-ethereal-ink/8",
    )}
  >
    <div className="flex items-center gap-2">
      <Label size="xs" color="muted" weight="semibold" className="flex-1 truncate">
        {message.sender?.name ?? "—"}
      </Label>
      {message.is_pinned && <Pin size={12} className="text-ethereal-gold" />}
      <Label size="xs" color="muted" className="shrink-0 opacity-60">
        {formatTime(message.created_at)}
      </Label>
      {isManager && (
        <button
          type="button"
          onClick={() => onTogglePin(message)}
          disabled={pinPending}
          className="shrink-0 text-ethereal-graphite/40 opacity-0 transition-opacity hover:text-ethereal-gold group-hover/row:opacity-100"
          title={message.is_pinned ? "Odepnij" : "Przypnij"}
        >
          {message.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
      )}
    </div>
    <Text size="sm" color="graphite" className="whitespace-pre-line leading-relaxed">
      {message.body}
    </Text>
  </div>
);

export const ChannelView: React.FC<ChannelViewProps> = ({ channelId, isManager, me, onBack }) => {
  const { t } = useTranslation();
  const { data: channel, isLoading } = useChannel(channelId);
  const markRead = useMarkChannelRead();
  const postMessage = usePostChannelMessage(channelId, me);
  const setPush = useSetChannelPush(channelId);
  const pinMessage = usePinChannelMessage(channelId);

  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (channel?.unread) {
      markRead.mutate(channelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id, channel?.unread, channelId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [channel?.messages.length]);

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    postMessage.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading || !channel) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Text size="sm" color="muted">
          {t("messages.channel.loading", "Ładowanie kanału…")}
        </Text>
      </div>
    );
  }

  const pinned = channel.messages.filter((m) => m.is_pinned);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-ethereal-ink/8 px-5 py-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("common.back", "Wstecz")}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ethereal-graphite/60 transition-colors hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink md:hidden"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <Heading as="h3" size="lg" color="graphite" className="truncate">
            {channel.project_name}
          </Heading>
          <Label size="xs" color="muted" weight="medium">
            {t("messages.channel.members", "{{count}} uczestników", {
              count: channel.member_count,
            })}
          </Label>
        </div>
        <button
          type="button"
          onClick={() => setPush.mutate(!channel.my_push_enabled)}
          disabled={setPush.isPending}
          aria-label={t("messages.channel.toggle_push", "Powiadomienia push")}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            channel.my_push_enabled
              ? "bg-ethereal-gold/15 text-ethereal-gold"
              : "text-ethereal-graphite/50 hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink",
          )}
          title={
            channel.my_push_enabled
              ? t("messages.channel.push_on", "Push włączony")
              : t("messages.channel.push_off", "Push wyłączony")
          }
        >
          {channel.my_push_enabled ? <Bell size={16} /> : <BellOff size={16} />}
        </button>
      </div>

      {/* Pinned banner */}
      {pinned.length > 0 && (
        <div className="border-b border-ethereal-gold/20 bg-ethereal-gold/[0.06] px-5 py-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Pin size={12} className="text-ethereal-gold" />
            <Label size="xs" color="muted" weight="semibold">
              {t("messages.channel.pinned", "Przypięte")}
            </Label>
          </div>
          <div className="flex flex-col gap-1">
            {pinned.map((m) => (
              <Text key={m.id} size="xs" color="graphite" className="truncate opacity-80">
                <span className="font-semibold">{m.sender?.name ?? "—"}:</span> {m.body}
              </Text>
            ))}
          </div>
        </div>
      )}

      {/* Stream */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4 no-scrollbar">
        {channel.messages.map((message) => (
          <ChannelRow
            key={message.id}
            message={message}
            isManager={isManager}
            onTogglePin={(m) => pinMessage.mutate({ messageId: m.id, pinned: !m.is_pinned })}
            pinPending={pinMessage.isPending}
          />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-ethereal-ink/8 p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={t("messages.channel.composer", "Napisz do kanału…")}
              aria-label={t("messages.channel.composer", "Napisz do kanału…")}
            />
          </div>
          <Button
            type="button"
            onClick={handleSend}
            disabled={!body.trim()}
            className="mb-1 flex items-center gap-2"
          >
            <Send size={14} />
            {t("messages.channel.send", "Wyślij")}
          </Button>
        </div>
      </div>
    </div>
  );
};
