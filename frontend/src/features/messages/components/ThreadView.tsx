/**
 * @file ThreadView.tsx
 * @description Active conversation pane: header + triage (managers), scrolling
 * message history, and a composer with optimistic send. Marks the thread read on
 * open. Async by design — no presence/typing indicators.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, Hand, Send } from "lucide-react";

import { Heading, Text, Label } from "@/shared/ui/primitives/typography";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Button } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/lib/utils";
import {
  useMarkThreadRead,
  usePostMessage,
  useThread,
  useUpdateThread,
} from "../api/messages.queries";
import type { UserBrief } from "../types/messages.dto";
import { MessageBubble } from "./MessageBubble";

interface ThreadViewProps {
  threadId: string;
  isManager: boolean;
  me: UserBrief;
  onBack?: () => void;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  threadId,
  isManager,
  me,
  onBack,
}) => {
  const { t } = useTranslation();
  const { data: thread, isLoading } = useThread(threadId);
  const markRead = useMarkThreadRead();
  const updateThread = useUpdateThread(threadId);
  const postMessage = usePostMessage(threadId, me);

  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark read once whenever the thread surfaces as unread.
  useEffect(() => {
    if (thread?.unread) {
      markRead.mutate(threadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, thread?.unread, threadId]);

  // Keep the latest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread?.messages.length]);

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

  if (isLoading || !thread) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Text size="sm" color="muted">
          {t("messages.thread.loading", "Ładowanie rozmowy…")}
        </Text>
      </div>
    );
  }

  const counterpart = isManager
    ? thread.artist.name
    : thread.assignee?.name ?? t("messages.list.management", "Zarząd");
  const isResolved = thread.status === "RESOLVED";
  const ownedByMe = thread.assignee?.id === me.id;

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
            {thread.subject}
          </Heading>
          <Label size="xs" color="muted" weight="medium">
            {counterpart}
          </Label>
        </div>

        {isManager && (
          <div className="flex shrink-0 items-center gap-2">
            {!ownedByMe && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => updateThread.mutate({ assignee_id: me.id })}
                disabled={updateThread.isPending}
                className="flex items-center gap-1.5 text-xs"
              >
                <Hand size={14} />
                {t("messages.thread.claim", "Przejmij")}
              </Button>
            )}
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                updateThread.mutate({ status: isResolved ? "OPEN" : "RESOLVED" })
              }
              disabled={updateThread.isPending}
              className="flex items-center gap-1.5 text-xs"
            >
              <Check size={14} />
              {isResolved
                ? t("messages.thread.reopen", "Otwórz ponownie")
                : t("messages.thread.resolve", "Zamknij")}
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4 no-scrollbar"
      >
        {thread.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-ethereal-ink/8 p-3">
        <div className={cn("flex items-end gap-2", isResolved && "opacity-60")}>
          <div className="flex-1">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={t("messages.thread.composer", "Napisz wiadomość…")}
              aria-label={t("messages.thread.composer", "Napisz wiadomość…")}
            />
          </div>
          <Button
            type="button"
            onClick={handleSend}
            disabled={!body.trim()}
            className="mb-1 flex items-center gap-2"
          >
            <Send size={14} />
            {t("messages.thread.send", "Wyślij")}
          </Button>
        </div>
      </div>
    </div>
  );
};
