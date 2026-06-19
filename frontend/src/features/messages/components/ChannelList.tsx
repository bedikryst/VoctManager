/**
 * @file ChannelList.tsx
 * @description Inbox section listing project channels the user belongs to. One row per
 * channel: a rounded project glyph (square = group, vs. circular person avatars), an
 * unread gold marker, project name, member count, snippet, and a relative stamp.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

import { Avatar } from "@/shared/ui/composites/Avatar";
import { Text, Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { relativeStamp } from "../lib/time";
import type { ChannelSummary } from "../types/messages.dto";

interface ChannelListProps {
  channels: ChannelSummary[];
  activeId?: string;
  onSelect: (id: string) => void;
}

export const ChannelList: React.FC<ChannelListProps> = ({ channels, activeId, onSelect }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5">
      {channels.map((channel) => {
        const isActive = channel.id === activeId;
        return (
          <motion.button
            key={channel.id}
            type="button"
            onClick={() => onSelect(channel.id)}
            whileTap={{ scale: 0.99 }}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              isActive
                ? "border-ethereal-gold/40 bg-ethereal-gold/10"
                : "border-ethereal-ink/8 bg-ethereal-alabaster/40 hover:bg-ethereal-alabaster/70",
            )}
          >
            <Avatar size="sm" shape="rounded" tone="neutral" name={channel.project_name} />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                {channel.unread && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-ethereal-gold"
                    aria-label={t("messages.list.unread", "Nieprzeczytane")}
                  />
                )}
                <Text
                  size="sm"
                  color="graphite"
                  weight={channel.unread ? "semibold" : "medium"}
                  className="flex-1 truncate"
                >
                  {channel.project_name}
                </Text>
                {channel.last_message_at && (
                  <Label size="xs" color="muted" className="shrink-0 tabular-nums opacity-60">
                    {relativeStamp(channel.last_message_at, t)}
                  </Label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label size="xs" color="muted" weight="medium" className="shrink-0">
                  {t("messages.channel.members", "{{count}} uczestników", {
                    count: channel.member_count,
                  })}
                </Label>
                {channel.snippet && (
                  <Text size="xs" color="muted" className="flex-1 truncate opacity-70">
                    {channel.snippet}
                  </Text>
                )}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
