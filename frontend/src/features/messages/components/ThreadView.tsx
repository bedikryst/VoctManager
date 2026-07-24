/**
 * @file ThreadView.tsx
 * @description Active conversation pane: header (counterpart avatar) + triage
 * (managers), day-grouped scrolling message history, and a composer with optimistic
 * send. Marks the thread read on open. Async by design — no presence/typing indicators.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Hand, FolderOpen, RotateCcw, Send, Undo2 } from "lucide-react";

import { Avatar } from "@/shared/ui/composites/Avatar";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Heading, Text, Label } from "@/shared/ui/primitives/typography";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Button } from "@/shared/ui/primitives/Button";
import {
  useMarkThreadRead,
  usePostMessage,
  useThread,
  useUpdateThread,
} from "../api/messages.queries";
import { useProjectsLite } from "../api/projects.lite";
import { dayLabel, groupMessagesByDay } from "../lib/time";
import type { UserBrief } from "../types/messages.dto";
import { MessageBubble } from "./MessageBubble";
import { DayDivider } from "@/shared/ui/composites/DayDivider";

/**
 * Triage actions collapse to icon-only below `sm`: a phone-width pane cannot
 * carry two labelled buttons beside the counterpart's name, and the labels
 * survive as the accessible name + tooltip.
 */
const TRIAGE_ACTION_CLASS = "gap-0 px-3 sm:gap-2 sm:px-5";

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
  const { data: projects = [] } = useProjectsLite(thread?.context_type === "PROJECT");

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
    return <EtherealLoader fullHeight={false} message={t("messages.thread.loading", "Ładowanie rozmowy…")} />;
  }

  const counterpart = isManager ? thread.artist : thread.assignee;
  const counterpartName = counterpart?.name ?? t("messages.list.management", "Zarząd");
  const isResolved = thread.status === "RESOLVED";
  const ownedByMe = thread.assignee?.id === me.id;
  const groups = groupMessagesByDay(thread.messages);
  const claimLabel = t("messages.thread.claim", "Przejmij");
  const releaseLabel = t("messages.thread.release", "Do kolejki");
  const statusLabel = isResolved
    ? t("messages.thread.reopen", "Otwórz ponownie")
    : t("messages.thread.resolve", "Zamknij");

  const projectContext =
    thread.context_type === "PROJECT" && thread.context_id
      ? {
          id: thread.context_id,
          name:
            projects.find((p) => p.id === thread.context_id)?.title ??
            t("messages.context.project", "Projekt"),
        }
      : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-ethereal-ink/8 px-5 py-4">
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
        <Avatar
          size="md"
          src={counterpart?.avatar_url}
          name={counterpartName}
          tone={counterpart ? "gold" : "neutral"}
        />
        <div className="min-w-0 flex-1">
          <Heading as="h3" size="lg" color="graphite" className="truncate">
            {thread.subject}
          </Heading>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Label size="xs" color="muted" weight="medium">
              {counterpartName}
            </Label>
            {projectContext &&
              (isManager ? (
                <Link
                  to={`/panel/projects/${projectContext.id}`}
                  title={t("messages.context.view_project", "Otwórz projekt")}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-ethereal-gold/25 bg-ethereal-gold/10 px-2.5 py-0.5 transition-colors hover:border-ethereal-gold/50 hover:bg-ethereal-gold/15"
                >
                  <FolderOpen size={11} className="shrink-0 text-ethereal-gold" aria-hidden="true" />
                  <Label size="xs" color="graphite" weight="medium" className="truncate">
                    {projectContext.name}
                  </Label>
                </Link>
              ) : (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-ethereal-ink/10 bg-ethereal-alabaster px-2.5 py-0.5">
                  <FolderOpen size={11} className="shrink-0 text-ethereal-gold/70" aria-hidden="true" />
                  <Label size="xs" color="muted" weight="medium" className="truncate">
                    {projectContext.name}
                  </Label>
                </span>
              ))}
          </div>
        </div>

        {isManager && (
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {!ownedByMe && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => updateThread.mutate({ assignee_id: me.id })}
                disabled={updateThread.isPending}
                leftIcon={<Hand size={14} />}
                aria-label={claimLabel}
                title={claimLabel}
                className={TRIAGE_ACTION_CLASS}
              >
                <span className="hidden sm:inline">{claimLabel}</span>
              </Button>
            )}
            {ownedByMe && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => updateThread.mutate({ assignee_id: null })}
                disabled={updateThread.isPending}
                leftIcon={<Undo2 size={14} />}
                aria-label={releaseLabel}
                title={releaseLabel}
                className={TRIAGE_ACTION_CLASS}
              >
                <span className="hidden sm:inline">{releaseLabel}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                updateThread.mutate({ status: isResolved ? "OPEN" : "RESOLVED" })
              }
              disabled={updateThread.isPending}
              leftIcon={isResolved ? <RotateCcw size={14} /> : <Check size={14} />}
              aria-label={statusLabel}
              title={statusLabel}
              className={TRIAGE_ACTION_CLASS}
            >
              <span className="hidden sm:inline">{statusLabel}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4 no-scrollbar"
      >
        {groups.map((group) => (
          <React.Fragment key={group.key}>
            <DayDivider label={dayLabel(group.iso, t)} />
            {group.items.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-ethereal-ink/8 p-3">
        {isResolved && (
          <Text size="xs" color="muted" className="mb-2 px-1">
            {t(
              "messages.thread.resolved_hint",
              "Wątek zamknięty — wysłanie odpowiedzi otworzy go ponownie.",
            )}
          </Text>
        )}
        <div className="flex items-end gap-2">
          {/* min-w-0 defeats the textarea's intrinsic `cols` width, which would
              otherwise keep the composer wider than a phone. */}
          <div className="min-w-0 flex-1">
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
            leftIcon={<Send size={14} />}
            className="mb-1"
          >
            {t("messages.thread.send", "Wyślij")}
          </Button>
        </div>
      </div>
    </div>
  );
};
