/**
 * @file ThreadList.tsx
 * @description Inbox column. One row per conversation with an unread gold marker,
 * counterpart name, snippet, and (for non-OPEN) a status pill.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

import { Text, Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import type { ThreadStatus, ThreadSummary } from "../types/messages.dto";

const formatStamp = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_LABEL: Record<ThreadStatus, string | null> = {
  OPEN: null,
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
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <Text size="sm" color="muted">
          {t("messages.list.empty", "Brak rozmów. Zacznij nową wiadomością.")}
        </Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {threads.map((thread) => {
        const counterpart = isManager
          ? thread.artist.name
          : thread.assignee?.name ?? t("messages.list.management", "Zarząd");
        const isActive = thread.id === activeId;
        const statusLabel = STATUS_LABEL[thread.status];

        return (
          <motion.button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            whileTap={{ scale: 0.99 }}
            className={cn(
              "flex w-full flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              isActive
                ? "border-ethereal-gold/40 bg-ethereal-gold/10"
                : "border-ethereal-ink/8 bg-ethereal-alabaster/40 hover:bg-ethereal-alabaster/70",
            )}
          >
            <div className="flex items-center gap-2">
              {thread.unread && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-ethereal-gold"
                  aria-label={t("messages.list.unread", "Nieprzeczytane")}
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
              <Label size="xs" color="muted" className="shrink-0 opacity-60">
                {formatStamp(thread.last_message_at)}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Label size="xs" color="muted" weight="medium" className="shrink-0">
                {counterpart}
              </Label>
              {thread.snippet && (
                <Text size="xs" color="muted" className="flex-1 truncate opacity-70">
                  {thread.snippet}
                </Text>
              )}
              {statusLabel && (
                <Label
                  size="xs"
                  className="shrink-0 rounded-full border border-ethereal-ink/10 bg-ethereal-marble px-2 py-0.5 text-ethereal-graphite/70"
                >
                  {statusLabel}
                </Label>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
