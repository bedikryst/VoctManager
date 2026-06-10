/**
 * @file MessagesPage.tsx
 * @description Two-pane messaging console. Left inbox holds two sections — project
 * channels (group) and 1:1 threads; right pane shows the selected channel or thread.
 * Responsive: single-pane with back navigation on phones. Entry point for both roles.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/MessagesPage
 */

import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle, Plus } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager as resolveIsManager } from "@/shared/auth/rbac";

import { useChannels, useThreads } from "./api/messages.queries";
import { ThreadList } from "./components/ThreadList";
import { ThreadView } from "./components/ThreadView";
import { ChannelList } from "./components/ChannelList";
import { ChannelView } from "./components/ChannelView";
import { NewThreadModal } from "./components/NewThreadModal";
import type { UserBrief } from "./types/messages.dto";

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Eyebrow color="muted" size="caption" className="px-2 tracking-[0.12em]">
    {children}
  </Eyebrow>
);

const MessagesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { threadId, channelId } = useParams<{ threadId?: string; channelId?: string }>();
  const { user } = useAuth();

  const isManager = resolveIsManager(user);
  const { data: threads = [], isLoading: threadsLoading } = useThreads();
  const { data: channels = [], isLoading: channelsLoading } = useChannels();
  const [isComposerOpen, setComposerOpen] = useState(false);

  const me = useMemo<UserBrief>(
    () => ({
      id: Number(user?.id ?? 0),
      name:
        [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
        user?.email ||
        "",
    }),
    [user],
  );

  const hasSelection = !!(threadId || channelId);
  const isLoading = threadsLoading || channelsLoading;

  const selectThread = (id: string) => navigate(`/panel/messages/${id}`);
  const selectChannel = (id: string) => navigate(`/panel/messages/channel/${id}`);
  const clearSelection = () => navigate("/panel/messages");
  const handleCreated = (id: string) => navigate(`/panel/messages/${id}`);

  return (
    <div className="mx-auto flex w-full max-w-300 flex-col gap-4">
      <div className="flex items-center justify-between gap-4 px-1">
        <div>
          <Eyebrow color="muted" size="caption" className="tracking-[0.12em]">
            {t("messages.eyebrow", "Komunikacja")}
          </Eyebrow>
          <Heading as="h1" size="3xl" color="graphite">
            {t("messages.title", "Wiadomości")}
          </Heading>
        </div>
        <Button type="button" onClick={() => setComposerOpen(true)} className="flex items-center gap-2">
          <Plus size={16} />
          {t("messages.new", "Nowa")}
        </Button>
      </div>

      <div className="flex h-[calc(100dvh-11rem)] min-h-115 gap-4">
        {/* Inbox */}
        <GlassCard
          variant="ethereal"
          isHoverable={false}
          padding="none"
          className={cn(
            "h-full w-full flex-col overflow-hidden md:w-85 md:shrink-0",
            hasSelection ? "hidden md:flex" : "flex",
          )}
        >
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Text size="sm" color="muted">
                {t("messages.list.loading", "Ładowanie…")}
              </Text>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2 no-scrollbar">
              {channels.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <SectionLabel>{t("messages.section.channels", "Kanały projektów")}</SectionLabel>
                  <ChannelList channels={channels} activeId={channelId} onSelect={selectChannel} />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <SectionLabel>{t("messages.section.threads", "Wątki")}</SectionLabel>
                <ThreadList
                  threads={threads}
                  activeId={threadId}
                  isManager={isManager}
                  onSelect={selectThread}
                />
              </div>
            </div>
          )}
        </GlassCard>

        {/* Conversation */}
        <GlassCard
          variant="ethereal"
          isHoverable={false}
          padding="none"
          className={cn(
            "h-full flex-1 overflow-hidden",
            hasSelection ? "flex" : "hidden md:flex",
          )}
        >
          {channelId ? (
            <ChannelView channelId={channelId} isManager={isManager} me={me} onBack={clearSelection} />
          ) : threadId ? (
            <ThreadView threadId={threadId} isManager={isManager} me={me} onBack={clearSelection} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ethereal-ink/8 bg-black/5">
                <MessageCircle size={22} strokeWidth={1.5} className="text-ethereal-graphite/40" />
              </div>
              <Text size="sm" color="muted">
                {t("messages.empty", "Wybierz rozmowę lub zacznij nową.")}
              </Text>
            </div>
          )}
        </GlassCard>
      </div>

      <NewThreadModal
        isOpen={isComposerOpen}
        onClose={() => setComposerOpen(false)}
        isManager={isManager}
        onCreated={handleCreated}
      />
    </div>
  );
};

export default MessagesPage;
