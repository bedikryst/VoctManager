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
import { Check, Inbox, MailOpen, Plus, Search, SearchX, User, UserPlus } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SegmentedTabs, type SegmentedTabItem } from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { foldDiacritics } from "@/shared/lib/text";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager as resolveIsManager } from "@/shared/auth/rbac";

import { useChannels, useThreads } from "./api/messages.queries";
import { ThreadList } from "./components/ThreadList";
import { ThreadView } from "./components/ThreadView";
import { ChannelList } from "./components/ChannelList";
import { ChannelView } from "./components/ChannelView";
import { ConductorDeck } from "./components/ConductorDeck";
import { NewThreadModal } from "./components/NewThreadModal";
import type { ChannelSummary, ThreadSummary, UserBrief } from "./types/messages.dto";

type TriageFilter = "all" | "unread" | "unassigned" | "mine" | "resolved";

/**
 * Filters whose size is WORK the reader has to do, so the figure earns its place on
 * the control. "Wszystkie" is the resting default and "Zamknięte" is an archive —
 * neither is a backlog, and a number on both would put a chip on every segment.
 */
const COUNTED_FILTERS: ReadonlySet<TriageFilter> = new Set(["unread", "unassigned", "mine"]);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Eyebrow color="muted" size="caption" className="px-2">
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
  const isNarrowed = query.trim().length > 0 || filter !== "all";

  const q = foldDiacritics(query.trim());

  /**
   * One predicate per axis, shared by the visible list and by the tab counts. A
   * count computed on its own copy of the rules is a count that eventually
   * disagrees with the rows it promises — and it disagrees silently.
   */
  const select = useMemo(() => {
    const matchesThread = (th: ThreadSummary, f: TriageFilter): boolean => {
      switch (f) {
        // ARCHIVED is out of every live view, "Moje" included: a thread the
        // default hides must not reappear under a sibling filter.
        case "all":
          return th.status !== "ARCHIVED";
        case "unread":
          return th.unread && th.status !== "ARCHIVED";
        case "unassigned":
          return !th.assignee && th.status === "OPEN";
        case "mine":
          return th.assignee?.id === me.id && th.status !== "ARCHIVED";
        case "resolved":
          return th.status === "RESOLVED";
      }
    };
    const threadMatchesQuery = (th: ThreadSummary): boolean =>
      !q ||
      foldDiacritics(
        `${th.subject} ${th.snippet} ${th.artist.name} ${th.assignee?.name ?? ""}`,
      ).includes(q);
    const channelMatchesQuery = (ch: ChannelSummary): boolean =>
      !q || foldDiacritics(`${ch.project_name} ${ch.snippet}`).includes(q);

    // Channels only belong to the views that do not talk about assignment or
    // thread status — a group channel has neither.
    const showsChannels = (f: TriageFilter): boolean => f === "all" || f === "unread";

    return {
      threads: (f: TriageFilter) =>
        threads.filter((th) => matchesThread(th, f) && threadMatchesQuery(th)),
      channels: (f: TriageFilter) =>
        showsChannels(f)
          ? channels.filter((ch) => (f !== "unread" || ch.unread) && channelMatchesQuery(ch))
          : [],
    };
  }, [threads, channels, q, me.id]);

  const visibleThreads = useMemo(() => select.threads(filter), [select, filter]);
  const visibleChannels = useMemo(() => select.channels(filter), [select, filter]);

  const filterItems = useMemo<SegmentedTabItem<TriageFilter>[]>(() => {
    const defs: Array<{ id: TriageFilter; label: string; Icon: typeof Inbox }> = isManager
      ? [
          { id: "all", label: t("messages.filter.all", "Wszystkie"), Icon: Inbox },
          { id: "unread", label: t("messages.filter.unread", "Nowe"), Icon: MailOpen },
          { id: "unassigned", label: t("messages.filter.unassigned", "Bez opieki"), Icon: UserPlus },
          { id: "mine", label: t("messages.filter.mine", "Moje"), Icon: User },
          { id: "resolved", label: t("messages.filter.resolved", "Zamknięte"), Icon: Check },
        ]
      : [
          { id: "all", label: t("messages.filter.all", "Wszystkie"), Icon: Inbox },
          { id: "unread", label: t("messages.filter.unread", "Nowe"), Icon: MailOpen },
        ];

    return defs.map((def) => {
      if (!COUNTED_FILTERS.has(def.id)) return def;
      const size = select.threads(def.id).length + select.channels(def.id).length;
      // Zero is the resting state and says nothing; the segment keeps its label.
      return size > 0 ? { ...def, count: size } : def;
    });
  }, [isManager, select, t]);

  const showChannels = visibleChannels.length > 0;

  const selectThread = (id: string) => navigate(`/panel/messages/${id}`);
  const selectChannel = (id: string) => navigate(`/panel/messages/channel/${id}`);
  const clearSelection = () => navigate("/panel/messages");
  const handleCreated = (id: string) => navigate(`/panel/messages/${id}`);
  const handleAnnounced = (id: string) => navigate(`/panel/messages/channel/${id}`);

  const resetView = () => {
    setQuery("");
    setFilter("all");
  };

  const nothingToShow = !showChannels && visibleThreads.length === 0;

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
            "h-full w-full min-w-0 flex-col overflow-hidden md:w-85 md:shrink-0",
            hasSelection ? "hidden md:flex" : "flex",
          )}
        >
          {/* Inbox toolbar */}
          <div className="flex flex-col gap-2.5 border-b border-hairline-strong p-3">
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
              wrap
            />
          </div>

          {isLoading ? (
            <EtherealLoader fullHeight={false} message={t("messages.list.loading", "Ładowanie…")} />
          ) : nothingToShow ? (
            isNarrowed ? (
              <StatePanel
                variant="inline"
                icon={<SearchX size={24} strokeWidth={1.5} />}
                title={t("messages.list.no_match", "Brak rozmów dla tego filtra.")}
                actions={
                  <Button type="button" variant="ghost" size="sm" onClick={resetView}>
                    {t("messages.list.reset", "Pokaż wszystkie")}
                  </Button>
                }
                className="px-6"
              />
            ) : (
              <StatePanel
                variant="inline"
                icon={<Inbox size={24} strokeWidth={1.5} />}
                title={t("messages.list.empty_title", "Cisza w skrzynce")}
                description={t(
                  "messages.list.empty",
                  "Nie ma jeszcze żadnych rozmów. Zacznij nową wiadomością.",
                )}
                className="px-6"
              />
            )
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2 no-scrollbar">
              {showChannels && (
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
            // min-w-0: without it the pane's width follows its own min-content
            // (header actions, composer) and on a phone the card grows past the
            // viewport instead of the conversation adapting to it.
            "h-full min-w-0 flex-1 overflow-hidden",
            hasSelection ? "flex" : "hidden md:flex",
          )}
        >
          {/* Keyed per conversation: only this pane re-instantiates on selection,
              so the draft in the composer and the scroll position never bleed
              from one conversation into the next. */}
          {channelId ? (
            <ChannelView
              key={channelId}
              channelId={channelId}
              isManager={isManager}
              me={me}
              onBack={clearSelection}
            />
          ) : threadId ? (
            <ThreadView
              key={threadId}
              threadId={threadId}
              isManager={isManager}
              me={me}
              onBack={clearSelection}
            />
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
