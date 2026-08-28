/**
 * @file MessageBubble.tsx
 * @description A single message, in the one shape a message has — a 1:1 thread
 * and a project channel both render this. Calm, asymmetric alignment (mine right
 * / theirs left) using Ethereal tokens, deliberately NOT a loud chat-bubble
 * aesthetic. An unconfirmed optimistic send shows a quiet "sending…" cue instead
 * of a timestamp.
 *
 * A 1:1 thread carries no avatar and no sender name: the header names the one
 * other person and the alignment already says who spoke, so both were the same
 * fact stated a third time — and on a phone they cost 36px of the reading width
 * that was the complaint.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Clock, Pin } from "lucide-react";

import { Avatar } from "@/shared/ui/composites/Avatar";
import { Text, Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { clockStamp, isOptimisticId } from "../lib/time";
import type { MessageDTO } from "../types/messages.dto";

/**
 * The type scale a message BODY uses, and the only one it may use. 16px on
 * touch, the panel's dense 14px behind `fine-pointer:` — the same shape as
 * `FIELD_TEXT_SCALE` and for a related reason: the composer that produced this
 * text is 16px on a phone, so anything smaller here means reading a message at a
 * size you were not allowed to write it at. It rides over `Text`'s own default
 * rather than replacing it, so losing the class falls back to 14px, not to the
 * 12px this feature shipped with.
 */
export const MESSAGE_BODY_TEXT = "text-base fine-pointer:text-sm";

/** Matches `Avatar size="xs"`, so a continuation lines up with the run it joins. */
const GUTTER_CLASS = "h-7 w-7 shrink-0";

interface MessageBubbleProps {
  message: MessageDTO;
  /**
   * Set by a GROUP conversation, where the sender is a real question. The
   * identity is drawn once per run of consecutive messages: twelve rows naming
   * the same person is noise, and the gutter still holds the column open so the
   * run reads as one block.
   */
  group?: { readonly startsRun: boolean };
  isPinned?: boolean;
  /** Per-message control (a channel's pin toggle), on the row's outer edge. */
  action?: React.ReactNode;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  group,
  isPinned = false,
  action,
}) => {
  const { t } = useTranslation();
  const mine = message.is_mine;
  const pending = mine && isOptimisticId(message.id);
  const showIdentity = !!group && !mine;

  const bubble = (
    <div
      className={cn(
        // min-w-0 keeps the width cap honest: a flex item's automatic minimum is
        // its content, so one long word would otherwise widen the bubble past
        // the pane — off-screen on the right, since mine align to the end.
        // 78% is a desktop rule (it stops a bubble becoming a band across a wide
        // pane); on a phone it would spend a fifth of the screen on nothing.
        "min-w-0 max-w-[86%] rounded-nested border px-4 py-2.5 sm:max-w-[78%]",
        mine
          ? "bg-ethereal-gold/12 border-ethereal-gold/25"
          : "bg-ethereal-alabaster/70 border-hairline",
        pending && "opacity-70",
      )}
    >
      {showIdentity && group.startsRun && message.sender && (
        <Label size="xs" color="muted" weight="semibold" className="mb-0.5 block">
          {message.sender.name}
        </Label>
      )}
      <Text
        color="graphite"
        className={cn(
          MESSAGE_BODY_TEXT,
          "break-words whitespace-pre-line leading-relaxed",
        )}
      >
        {message.body}
        {/* Timestamp trails the last line so short messages stay a single row. */}
        <Label
          size="xs"
          color="muted"
          className="ml-2.5 inline-flex items-center gap-1 align-baseline tabular-nums opacity-60"
        >
          {isPinned && <Pin size={10} className="text-ethereal-gold" aria-hidden="true" />}
          {pending && <Clock size={10} className="animate-pulse" aria-hidden="true" />}
          {pending ? t("messages.bubble.sending", "wysyłanie…") : clockStamp(message.created_at)}
        </Label>
      </Text>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex w-full items-end gap-2", mine ? "justify-end" : "justify-start")}
    >
      {mine && action}
      {showIdentity &&
        (group.startsRun ? (
          <Avatar
            size="xs"
            src={message.sender?.avatar_url}
            name={message.sender?.name}
            className="mb-0.5"
          />
        ) : (
          <span className={GUTTER_CLASS} aria-hidden="true" />
        ))}
      {bubble}
      {!mine && action}
    </motion.div>
  );
};
