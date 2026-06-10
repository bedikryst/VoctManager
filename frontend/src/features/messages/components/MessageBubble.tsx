/**
 * @file MessageBubble.tsx
 * @description A single message row. Calm, asymmetric alignment (mine right / theirs
 * left) using Ethereal tokens — deliberately NOT a loud chat-bubble aesthetic.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { motion } from "framer-motion";

import { Text, Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import type { MessageDTO } from "../types/messages.dto";

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

interface MessageBubbleProps {
  message: MessageDTO;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const mine = message.is_mine;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex w-full", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl border px-4 py-2.5",
          mine
            ? "bg-ethereal-gold/12 border-ethereal-gold/25"
            : "bg-ethereal-alabaster/70 border-ethereal-ink/8",
        )}
      >
        {!mine && message.sender && (
          <Label size="xs" color="muted" weight="semibold" className="mb-0.5 block">
            {message.sender.name}
          </Label>
        )}
        <Text size="sm" color="graphite" className="whitespace-pre-line leading-relaxed">
          {message.body}
        </Text>
        <Label size="xs" color="muted" className="mt-1 block text-right opacity-60">
          {formatTime(message.created_at)}
        </Label>
      </div>
    </motion.div>
  );
};
