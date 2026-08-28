/**
 * @file ThreadView.tsx
 * @description Active 1:1 conversation: header (counterpart + a triage menu for
 * managers), day-grouped scrolling history, and a composer with optimistic send.
 * Marks the thread read on open. Async by design — no presence/typing indicators.
 *
 * It fills whatever chassis it is handed and knows about neither: a `GlassCard`
 * pane on a desktop, `ConversationSurface` on a phone. Both give it a bounded
 * height, so the stream is the only band that scrolls.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Hand,
  FolderOpen,
  MoreVertical,
  RotateCcw,
  Undo2,
} from "lucide-react";

import { Avatar } from "@/shared/ui/composites/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { Heading, Label } from "@/shared/ui/primitives/typography";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import {
  useMarkThreadRead,
  usePostMessage,
  useThread,
  useUpdateThread,
} from "../api/messages.queries";
import { useProjectsLite } from "../api/projects.lite";
import { hasSeveralCounterparts, startsSenderRun } from "../lib/messageRuns";
import { dayLabel, groupMessagesByDay } from "../lib/time";
import { useStickyScroll } from "../lib/useStickyScroll";
import type { UserBrief } from "../types/messages.dto";
import { ConversationLoading } from "./ConversationLoading";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { DayDivider } from "@/shared/ui/composites/DayDivider";

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

  const [body, setBody] = React.useState("");
  const stream = useStickyScroll(thread?.messages.length ?? 0);

  // Mark read once whenever the thread surfaces as unread.
  React.useEffect(() => {
    if (thread?.unread) {
      markRead.mutate(threadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, thread?.unread, threadId]);

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    // The reader may have scrolled back through the history before replying;
    // their own message is the one thing that always has to land in view.
    stream.pinToBottom();
    postMessage.mutate(trimmed);
  };

  if (isLoading || !thread) {
    return (
      <ConversationLoading
        message={t("messages.thread.loading", "Ładowanie rozmowy…")}
        onBack={onBack}
      />
    );
  }

  const counterpart = isManager ? thread.artist : thread.assignee;
  const counterpartName = counterpart?.name ?? t("messages.list.management", "Zarząd");
  const isResolved = thread.status === "RESOLVED";
  const ownedByMe = thread.assignee?.id === me.id;
  const groups = groupMessagesByDay(thread.messages);
  // A thread left in the management queue can be answered by several conductors,
  // and then "who wrote this" is a real question the header cannot answer — so it
  // borrows the channel's identity treatment. With one counterpart it stays off.
  const namesSenders = hasSeveralCounterparts(thread.messages);
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
    <div className="flex h-full min-h-0 flex-col">
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
          {/* One line, and it stays one: wrapping put the counterpart's name on a
              second row the moment a project chip or a narrow phone joined it. */}
          <div className="flex min-w-0 items-center gap-x-2 overflow-hidden">
            <Label size="xs" color="muted" weight="medium" className="truncate">
              {counterpartName}
            </Label>
            {/* One chip for one fact. Only a manager can open the project, so the
                link — not a second colour — is what marks it as reachable. */}
            {projectContext &&
              (isManager ? (
                <Link
                  to={`/panel/projects/${projectContext.id}`}
                  title={t("messages.context.view_project", "Otwórz projekt")}
                  className="min-w-0"
                >
                  <Badge
                    casing="natural"
                    variant="neutral"
                    icon={<FolderOpen size={11} className="text-ethereal-gold" />}
                    className="min-w-0 max-w-full py-0.5 transition-colors hover:border-ethereal-gold/50 hover:bg-ethereal-gold/10"
                  >
                    <span className="truncate">{projectContext.name}</span>
                  </Badge>
                </Link>
              ) : (
                <Badge
                  casing="natural"
                  variant="neutral"
                  icon={<FolderOpen size={11} className="text-ethereal-gold/70" />}
                  className="min-w-0 max-w-full py-0.5"
                >
                  <span className="truncate">{projectContext.name}</span>
                </Badge>
              ))}
          </div>
        </div>

        {/* Triage is two or three occasional actions on a conversation, which is
            what an overflow menu is for. As labelled buttons they were ~100px of
            the ~230px the name beside them had to live in. */}
        {isManager && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="icon"
                size="icon"
                type="button"
                className="shrink-0"
                aria-label={t("messages.thread.actions", "Akcje wątku")}
                title={t("messages.thread.actions", "Akcje wątku")}
              >
                <MoreVertical size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {ownedByMe ? (
                <DropdownMenuItem
                  icon={<Undo2 size={15} />}
                  disabled={updateThread.isPending}
                  onSelect={() => updateThread.mutate({ assignee_id: null })}
                >
                  {releaseLabel}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  icon={<Hand size={15} />}
                  disabled={updateThread.isPending}
                  onSelect={() => updateThread.mutate({ assignee_id: me.id })}
                >
                  {claimLabel}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                icon={isResolved ? <RotateCcw size={15} /> : <Check size={15} />}
                disabled={updateThread.isPending}
                onSelect={() =>
                  updateThread.mutate({ status: isResolved ? "OPEN" : "RESOLVED" })
                }
              >
                {statusLabel}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Messages */}
      <div
        ref={stream.ref}
        onScroll={stream.onScroll}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3 no-scrollbar sm:px-5 sm:py-4"
      >
        {groups.map((group) => (
          <React.Fragment key={group.key}>
            <DayDivider label={dayLabel(group.iso, t)} />
            {group.items.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                group={
                  namesSenders
                    ? { startsRun: startsSenderRun(group.items, index) }
                    : undefined
                }
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      <MessageComposer
        value={body}
        onChange={setBody}
        onSend={handleSend}
        placeholder={t("messages.thread.composer", "Napisz wiadomość…")}
        hint={
          isResolved
            ? t(
                "messages.thread.resolved_hint",
                "Wątek zamknięty — wysłanie odpowiedzi otworzy go ponownie.",
              )
            : undefined
        }
      />
    </div>
  );
};
