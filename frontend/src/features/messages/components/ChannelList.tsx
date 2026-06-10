/**
 * @file ChannelList.tsx
 * @description Inbox section listing project channels the user belongs to. One row per
 * channel with an unread gold marker, project name, member count, and snippet.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

import { Text, Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import type { ChannelSummary } from "../types/messages.dto";

const formatStamp = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

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
              "flex w-full flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              isActive
                ? "border-ethereal-gold/40 bg-ethereal-gold/10"
                : "border-ethereal-ink/8 bg-ethereal-alabaster/40 hover:bg-ethereal-alabaster/70",
            )}
          >
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
                <Label size="xs" color="muted" className="shrink-0 opacity-60">
                  {formatStamp(channel.last_message_at)}
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
          </motion.button>
        );
      })}
    </div>
  );
};
