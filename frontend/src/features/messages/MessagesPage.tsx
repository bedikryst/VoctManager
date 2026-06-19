/**
 * @file MessagesPage.tsx
 * @description Two-pane messaging console. Left inbox: search + triage filter over two
 * sections — project channels (group) and 1:1 threads; right pane shows the selected
 * conversation, or the conductor's briefing deck (Skrzynka dyrygenta) when idle.
 * Responsive: single-pane with back navigation on phones. Entry point for both roles.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/MessagesPage
 */

import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Inbox, MailOpen, Plus, Search, User, UserPlus } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SegmentedTabs, type SegmentedTabItem } from "@/shared/ui/composites/SegmentedTabs";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager as resolveIsManager } from "@/shared/auth/rbac";

import { useChannels, useThreads } from "./api/messages.queries";
import { ThreadList } from "./components/ThreadList";
import { ThreadView } from "./components/ThreadView";
import { ChannelList } from "./components/ChannelList";
import { ChannelView } from "./components/ChannelView";
import { ConductorDeck } from "./components/ConductorDeck";
import { NewThreadModal } from "./components/NewThreadModal";
import type { UserBrief } from "./types/messages.dto";

type TriageFilter = "all" | "unread" | "unassigned" | "mine" | "resolved";

/** Diacritic-insensitive haystack normaliser for the inbox search. */
const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TriageFilter>("all");

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

  const filterItems = useMemo<SegmentedTabItem<TriageFilter>[]>(() => {
    if (!isManager) {
      return [
        { id: "all", label: t("messages.filter.all", "Wszystkie"), Icon: Inbox },
        { id: "unread", label: t("messages.filter.unread", "Nowe"), Icon: MailOpen },
      ];
    }
    return [
      { id: "all", label: t("messages.filter.all", "Wszystkie"), Icon: Inbox },
      { id: "unread", label: t("messages.filter.unread", "Nowe"), Icon: MailOpen },
      { id: "unassigned", label: t("messages.filter.unassigned", "Bez opieki"), Icon: UserPlus },
      { id: "mine", label: t("messages.filter.mine", "Moje"), Icon: User },
      { id: "resolved", label: t("messages.filter.resolved", "Zamknięte"), Icon: Check },
    ];
  }, [isManager, t]);

  const q = norm(query.trim());

  const visibleThreads = useMemo(
    () =>
      threads.filter((th) => {
        if (filter === "unread" && !th.unread) return false;
        if (filter === "unassigned" && (th.assignee || th.status !== "OPEN")) return false;
        if (filter === "mine" && th.assignee?.id !== me.id) return false;
        if (filter === "resolved" && th.status !== "RESOLVED") return false;
        if (filter === "all" && th.status === "ARCHIVED") return false;
        if (q) {
          const counterpart = isManager ? th.artist.name : th.assignee?.name ?? "";
          if (!norm(`${th.subject} ${th.snippet} ${counterpart}`).includes(q)) return false;
        }
        return true;
      }),
    [threads, filter, q, isManager, me.id],
  );

  const showChannels = filter === "all" || filter === "unread";
  const visibleChannels = useMemo(
    () =>
      channels.filter((ch) => {
        if (filter === "unread" && !ch.unread) return false;
        if (q && !norm(ch.project_name).includes(q)) return false;
        return true;
      }),
    [channels, filter, q],
  );

  const selectThread = (id: string) => navigate(`/panel/messages/${id}`);
  const selectChannel = (id: string) => navigate(`/panel/messages/channel/${id}`);
  const clearSelection = () => navigate("/panel/messages");
  const handleCreated = (id: string) => navigate(`/panel/messages/${id}`);
  const handleAnnounced = (id: string) => navigate(`/panel/messages/channel/${id}`);

  const nothingToShow =
    (!showChannels || visibleChannels.length === 0) && visibleThreads.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-300 flex-col">
      <PageHeader
        roleText={t("messages.eyebrow", "Komunikacja")}
        title={t("messages.title", "Wiadomości")}
        rightContent={
          <Button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-2"
            leftIcon={<Plus size={16} />}
          >
            {t("messages.new", "Nowa")}
          </Button>
        }
      />

      <div className="flex h-[calc(100dvh-13rem)] min-h-115 gap-4">
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
          {/* Inbox toolbar */}
          <div className="flex flex-col gap-2.5 border-b border-ethereal-ink/8 p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search />}
              placeholder={t("messages.search", "Szukaj rozmowy…")}
              aria-label={t("messages.search", "Szukaj rozmowy…")}
            />
            <SegmentedTabs
              items={filterItems}
              value={filter}
              onChange={setFilter}
              ariaLabel={t("messages.filter.aria", "Filtruj rozmowy")}
              className="text-xs"
            />
          </div>

          {isLoading ? (
            <EtherealLoader fullHeight={false} message={t("messages.list.loading", "Ładowanie…")} />
          ) : nothingToShow ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <Text size="sm" color="muted">
                {query || filter !== "all"
                  ? t("messages.list.no_match", "Brak rozmów dla tego filtra.")
                  : t("messages.list.empty", "Brak rozmów. Zacznij nową wiadomością.")}
              </Text>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2 no-scrollbar">
              {showChannels && visibleChannels.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <SectionLabel>{t("messages.section.channels", "Kanały projektów")}</SectionLabel>
                  <ChannelList channels={visibleChannels} activeId={channelId} onSelect={selectChannel} />
                </div>
              )}
              {visibleThreads.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <SectionLabel>{t("messages.section.threads", "Wątki")}</SectionLabel>
                  <ThreadList
                    threads={visibleThreads}
                    activeId={threadId}
                    isManager={isManager}
                    onSelect={selectThread}
                  />
                </div>
              )}
            </div>
          )}
        </GlassCard>

        {/* Conversation / briefing deck */}
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
          ) : isLoading ? (
            <EtherealLoader fullHeight={false} />
          ) : (
            <ConductorDeck
              threads={threads}
              channels={channels}
              isManager={isManager}
              me={me}
              onSelectThread={selectThread}
              onSelectChannel={selectChannel}
            />
          )}
        </GlassCard>
      </div>

      <NewThreadModal
        isOpen={isComposerOpen}
        onClose={() => setComposerOpen(false)}
        isManager={isManager}
        onCreated={handleCreated}
        onAnnounced={handleAnnounced}
      />
    </div>
  );
};

export default MessagesPage;
