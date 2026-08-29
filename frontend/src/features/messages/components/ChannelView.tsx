/**
 * @file ChannelView.tsx
 * @description Active project-channel pane: header (project, member count, per-user push
 * toggle, overflow menu), pinned-announcements banner, day-grouped group message stream,
 * and a composer everyone can post to. Marks read on open. Async by design — no
 * presence/typing.
 *
 * The stream renders the same `MessageBubble` a 1:1 thread does. It used to draw
 * a private row — full width, bordered, an avatar on every message, `is_mine`
 * distinguished only by fill — so one object had two shapes inside one feature.
 * What a group genuinely adds is the sender, and that is drawn once per run of
 * consecutive messages rather than on all twelve.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Bell, BellOff, MoreVertical, Pin, PinOff } from "lucide-react";

import { Avatar } from "@/shared/ui/composites/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { Heading, Text, Label } from "@/shared/ui/primitives/typography";
import { Button } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/lib/utils";
import {
  useChannel,
  useMarkChannelRead,
  useOlderChannelMessages,
  usePinChannelMessage,
  usePostChannelMessage,
  useSetChannelPush,
} from "../api/messages.queries";
import { startsSenderRun } from "../lib/messageRuns";
import { useMessageTextStep, useMessageTextStyle } from "../lib/messageTextScale";
import { dayLabel, groupMessagesByDay, isOptimisticId } from "../lib/time";
import { useStickyScroll } from "../lib/useStickyScroll";
import type { ChannelMessageDTO, UserBrief } from "../types/messages.dto";
import { ConversationGate } from "./ConversationGate";
import { EarlierMessages } from "./EarlierMessages";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { MessageTextSizeControl } from "./MessageTextSizeControl";
import { DayDivider } from "@/shared/ui/composites/DayDivider";

/**
 * A secondary per-message edit: 28px on a pointer, 36px under a thumb — the
 * density rule for a row control. Quiet at rest and never hidden behind hover,
 * which on touch would be no control at all.
 */
const PIN_BUTTON_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ethereal-graphite/30 transition-colors hover:text-ethereal-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:opacity-40 fine-pointer:h-7 fine-pointer:w-7";

interface ChannelViewProps {
  channelId: string;
  isManager: boolean;
  me: UserBrief;
  onBack?: () => void;
}

export const ChannelView: React.FC<ChannelViewProps> = ({ channelId, isManager, me, onBack }) => {
  const { t } = useTranslation();
  const { data: channel, isError, refetch } = useChannel(channelId);
  const markRead = useMarkChannelRead();
  const postMessage = usePostChannelMessage(channelId, me);
  const setPush = useSetChannelPush(channelId);
  const pinMessage = usePinChannelMessage(channelId);
  const olderMessages = useOlderChannelMessages(channelId);

  const [body, setBody] = React.useState("");
  const textStep = useMessageTextStep();
  const textStyle = useMessageTextStyle();
  const stream = useStickyScroll(channel?.messages.length ?? 0, textStep);

  React.useEffect(() => {
    if (channel?.unread) {
      markRead.mutate(channelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id, channel?.unread, channelId]);

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    stream.pinToBottom();
    postMessage.mutate(trimmed);
  };

  const handleLoadOlder = () => {
    const oldest = channel?.messages[0];
    if (!oldest || olderMessages.isPending) return;
    olderMessages.mutate(oldest.id, { onSuccess: stream.anchorTop });
  };

  // Only the empty hand opens the gate: a failed poll over a stream already on
  // screen leaves the stream, because the interval will try again by itself.
  if (!channel) {
    return (
      <ConversationGate
        status={isError ? "failed" : "checking"}
        loadingMessage={t("messages.channel.loading", "Ładowanie kanału…")}
        onRetry={() => void refetch()}
        onBack={onBack}
      />
    );
  }

  // Served as its own list: an announcement pinned in March is what the banner
  // is for, and the stream now carries only the window around the newest message.
  const pinned = channel.pinned_messages;
  const groups = groupMessagesByDay(channel.messages);
  const menuLabel = t("messages.conversation.actions", "Opcje rozmowy");

  const renderPinToggle = (message: ChannelMessageDTO): React.ReactNode => {
    if (!isManager || isOptimisticId(message.id)) return undefined;
    return (
      <button
        type="button"
        onClick={() =>
          pinMessage.mutate({ messageId: message.id, pinned: !message.is_pinned })
        }
        disabled={pinMessage.isPending}
        className={PIN_BUTTON_CLASS}
        title={
          message.is_pinned
            ? t("messages.channel.unpin", "Odepnij")
            : t("messages.channel.pin", "Przypnij")
        }
        aria-label={
          message.is_pinned
            ? t("messages.channel.unpin", "Odepnij")
            : t("messages.channel.pin", "Przypnij")
        }
      >
        {message.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
    );
  };

  return (
    // The reading size is scoped to the conversation and set on its root, so
    // the bubbles and the composer inside it move together and nothing else does.
    <div className="flex h-full min-h-0 flex-col" style={textStyle}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-hairline-strong px-3 py-3 sm:px-5 sm:py-4">
        {onBack && (
          <Button
            variant="icon"
            size="icon"
            type="button"
            onClick={onBack}
            aria-label={t("common.back", "Wstecz")}
            className="-ml-2 shrink-0 md:hidden"
          >
            <ArrowLeft size={18} />
          </Button>
        )}
        <Avatar size="md" shape="rounded" tone="neutral" name={channel.project_name} />
        <div className="min-w-0 flex-1">
          <Heading as="h3" size="lg" color="graphite" className="truncate">
            {channel.project_name}
          </Heading>
          <Label size="xs" color="muted" weight="medium" className="truncate">
            {t("messages.channel.members", "{{count}} uczestników", {
              count: channel.member_count,
            })}
          </Label>
        </div>
        {/* Channel push is opt-in per member: this control is the whole opt-in,
            so its state has to read from across the header. */}
        <Button
          variant="icon"
          size="icon"
          type="button"
          onClick={() => setPush.mutate(!channel.my_push_enabled)}
          disabled={setPush.isPending}
          aria-label={t("messages.channel.toggle_push", "Powiadomienia push")}
          aria-pressed={channel.my_push_enabled}
          className={cn(
            "shrink-0",
            channel.my_push_enabled && "bg-ethereal-gold/15 text-ethereal-gold",
          )}
          title={
            channel.my_push_enabled
              ? t("messages.channel.push_on", "Push włączony")
              : t("messages.channel.push_off", "Push wyłączony")
          }
        >
          {channel.my_push_enabled ? <Bell size={16} /> : <BellOff size={16} />}
        </Button>

        {/* The thread's overflow menu, minus the triage a channel has none of.
            A channel is the longer read of the two, so the reading size has to
            be reachable from inside it as well. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="icon"
              size="icon"
              type="button"
              className="shrink-0"
              aria-label={menuLabel}
              title={menuLabel}
            >
              <MoreVertical size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <MessageTextSizeControl />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pinned banner */}
      {pinned.length > 0 && (
        <div className="shrink-0 border-b border-ethereal-gold/20 bg-ethereal-gold/6 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Pin size={12} className="text-ethereal-gold" aria-hidden="true" />
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
      <div
        ref={stream.ref}
        onScroll={stream.onScroll}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 no-scrollbar sm:px-5 sm:py-4"
      >
        {channel.messages_page.has_older && (
          <EarlierMessages isLoading={olderMessages.isPending} onLoad={handleLoadOlder} />
        )}
        {groups.map((group) => (
          <React.Fragment key={group.key}>
            <DayDivider label={dayLabel(group.iso, t)} />
            {group.items.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                group={{ startsRun: startsSenderRun(group.items, index) }}
                isPinned={message.is_pinned}
                action={renderPinToggle(message)}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      <MessageComposer
        value={body}
        onChange={setBody}
        onSend={handleSend}
        placeholder={t("messages.channel.composer", "Napisz do kanału…")}
      />
    </div>
  );
};
