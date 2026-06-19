/**
 * @file ThreadList.tsx
 * @description Inbox column. One row per conversation: counterpart avatar, an unread
 * gold marker, name, snippet, relative stamp, and (for non-OPEN) a status pill.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";

import { Avatar } from "@/shared/ui/composites/Avatar";
import { Text, Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { relativeStamp } from "../lib/time";
import type { ThreadStatus, ThreadSummary } from "../types/messages.dto";

const STATUS_LABEL: Record<ThreadStatus, string | null> = {
  OPEN: null,
  RESOLVED: "messages.status.resolved",
  ARCHIVED: "messages.status.archived",
};

const STATUS_FALLBACK: Record<ThreadStatus, string> = {
  OPEN: "",
  RESOLVED: "Zamknięte",
  ARCHIVED: "Archiwum",
};

interface ThreadListProps {
  threads: ThreadSummary[];
  activeId?: string;
  isManager: boolean;
  onSelect: (id: string) => void;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  threads,
  activeId,
  isManager,
  onSelect,
}) => {
  const { t } = useTranslation();

  if (threads.length === 0) {
    return (
      <div className="px-2 py-6 text-center">
        <Text size="xs" color="muted">
          {t("messages.list.empty", "Brak rozmów.")}
        </Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {threads.map((thread) => {
        const counterpart = isManager
          ? thread.artist
          : thread.assignee;
        const counterpartName =
          counterpart?.name ?? t("messages.list.management", "Zarząd");
        const isActive = thread.id === activeId;
        const statusKey = STATUS_LABEL[thread.status];

        return (
          <motion.button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            whileTap={{ scale: 0.99 }}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              isActive
                ? "border-ethereal-gold/40 bg-ethereal-gold/10"
                : "border-ethereal-ink/8 bg-ethereal-alabaster/40 hover:bg-ethereal-alabaster/70",
            )}
          >
            <Avatar
              size="sm"
              src={counterpart?.avatar_url}
              name={counterpartName}
              tone={counterpart ? "gold" : "neutral"}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                {thread.unread && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-ethereal-gold"
                    aria-label={t("messages.list.unread", "Nieprzeczytane")}
                  />
                )}
                {thread.context_type === "PROJECT" && (
                  <FolderOpen
                    size={11}
                    className="shrink-0 text-ethereal-gold/70"
                    aria-label={t("messages.context.project", "Projekt")}
                  />
                )}
                <Text
                  size="sm"
                  color="graphite"
                  weight={thread.unread ? "semibold" : "medium"}
                  className="flex-1 truncate"
                >
                  {thread.subject}
                </Text>
                <Label size="xs" color="muted" className="shrink-0 tabular-nums opacity-60">
                  {relativeStamp(thread.last_message_at, t)}
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Label size="xs" color="muted" weight="medium" className="shrink-0">
                  {counterpartName}
                </Label>
                {thread.snippet && (
                  <Text size="xs" color="muted" className="flex-1 truncate opacity-70">
                    {thread.snippet}
                  </Text>
                )}
                {statusKey && (
                  <Label
                    size="xs"
                    className="shrink-0 rounded-full border border-ethereal-ink/10 bg-ethereal-marble px-2 py-0.5 text-ethereal-graphite/70"
                  >
                    {t(statusKey, STATUS_FALLBACK[thread.status])}
                  </Label>
                )}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
