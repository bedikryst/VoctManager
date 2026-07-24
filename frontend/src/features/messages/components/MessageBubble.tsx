/**
 * @file MessageBubble.tsx
 * @description A single message row. Calm, asymmetric alignment (mine right / theirs
 * left) using Ethereal tokens — deliberately NOT a loud chat-bubble aesthetic. Theirs
 * carry a small sender avatar in the gutter; an unconfirmed optimistic send shows a
 * quiet "sending…" cue instead of a timestamp.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";

import { Avatar } from "@/shared/ui/composites/Avatar";
import { Text, Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { clockStamp, isOptimisticId } from "../lib/time";
import type { MessageDTO } from "../types/messages.dto";

interface MessageBubbleProps {
  message: MessageDTO;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { t } = useTranslation();
  const mine = message.is_mine;
  const pending = mine && isOptimisticId(message.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex w-full items-end gap-2", mine ? "justify-end" : "justify-start")}
    >
      {!mine && (
        <Avatar
          size="xs"
          src={message.sender?.avatar_url}
          name={message.sender?.name}
          className="mb-0.5"
        />
      )}
      <div
        className={cn(
          // min-w-0 keeps the 78% cap honest: a flex item's automatic minimum is
          // its content, so one long word would otherwise widen the bubble past
          // the pane — off-screen on the right, since mine align to the end.
          "min-w-0 max-w-[78%] rounded-2xl border px-4 py-2.5",
          mine
            ? "bg-ethereal-gold/12 border-ethereal-gold/25"
            : "bg-ethereal-alabaster/70 border-ethereal-ink/8",
          pending && "opacity-70",
        )}
      >
        {!mine && message.sender && (
          <Label size="xs" color="muted" weight="semibold" className="mb-0.5 block">
            {message.sender.name}
          </Label>
        )}
        <Text
          size="sm"
          color="graphite"
          className="break-words whitespace-pre-line leading-relaxed"
        >
          {message.body}
          {/* Timestamp trails the last line so short messages stay a single row. */}
          <Label
            size="xs"
            color="muted"
            className="ml-2.5 inline-flex items-center gap-1 align-baseline tabular-nums opacity-60"
          >
            {pending && <Clock size={10} className="animate-pulse" aria-hidden="true" />}
            {pending ? t("messages.bubble.sending", "wysyłanie…") : clockStamp(message.created_at)}
          </Label>
        </Text>
      </div>
    </motion.div>
  );
};
