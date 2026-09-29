/**
 * @file MessagesPage.tsx
 * @description Two-pane messaging console. Left inbox: search + triage filter over two
 * sections — project channels (group) and 1:1 threads — with a manager's closed
 * threads behind an archive entry under the list; right pane shows the selected
 * conversation, or the conductor's briefing deck (Skrzynka dyrygenta) when idle.
 * Entry point for both roles.
 *
 * Two chassis, not one responsive layout. On `md+` the panes share a
 * viewport-locked row. On a phone an open conversation leaves the page entirely
 * and becomes `ConversationSurface` — a page header announcing "Wiadomości /
 * + NOWA" over the conversation you are reading is the chrome that made this
 * screen feel crowded, and the card it sat in cost another 45% of the width.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/MessagesPage
 */

import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  Inbox,
  Plus,
  RotateCw,
  Search,
  SearchX,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SegmentedTabs, type SegmentedTabItem } from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Caption, Eyebrow, Label } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { foldDiacritics } from "@/shared/lib/text";
import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager as resolveIsManager } from "@/shared/auth/rbac";

import { useChannels, useThreads } from "./api/messages.queries";
import { ThreadList } from "./components/ThreadList";
import { ThreadView } from "./components/ThreadView";
import { ChannelList } from "./components/ChannelList";
import { ChannelView } from "./components/ChannelView";
import { ConductorDeck } from "./components/ConductorDeck";
import { ConversationSurface } from "./components/ConversationSurface";
import { NewThreadModal } from "./components/NewThreadModal";
import { SectionLabel } from "./components/SectionLabel";
import type { ChannelSummary, ThreadSummary, UserBrief } from "./types/messages.dto";

type TriageFilter = "all" | "unread" | "unassigned" | "mine";

/** The width at which the two panes fit side by side — the `md:` classes below. */
const TWO_PANE_QUERY = "(min-width: 768px)";

/**
 * Filters whose size is WORK the reader has to do, so the figure earns its place on
 * the control. "Wszystkie" is the resting default, not a backlog, and a number on it
 * would put a chip on every segment.
 */
const COUNTED_FILTERS: ReadonlySet<TriageFilter> = new Set(["unread", "unassigned", "mine"]);

const MessagesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { threadId, channelId } = useParams<{ threadId?: string; channelId?: string }>();
  const { user } = useAuth();

  const isManager = resolveIsManager(user);
  const isTwoPane = useMediaQuery(TWO_PANE_QUERY);
  const threadsQuery = useThreads();
  const channelsQuery = useChannels();
  const { data: threads = [], isLoading: threadsLoading } = threadsQuery;
  const { data: channels = [], isLoading: channelsLoading } = channelsQuery;
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TriageFilter>("all");
  // Closed threads are an archive the manager visits, not a queue beside the
  // others, so they are reached from an entry under the list rather than a filter.
  const [showClosed, setShowClosed] = useState(false);

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
  /** The conversation owns the whole screen: a phone with one open. */
  const isImmersive = hasSelection && !isTwoPane;
  const isLoading = threadsLoading || channelsLoading;
  // Only a list that never arrived is a failure. A poll failing over an inbox
  // already on screen keeps it — the interval retries on its own. Either half
  // missing counts: an inbox without its channels would read as complete.
  const inboxFailed =
    (threadsQuery.isError && !threadsQuery.data) ||
    (channelsQuery.isError && !channelsQuery.data);
  const isRetryingInbox = threadsQuery.isFetching || channelsQuery.isFetching;
  const retryInbox = () => {
    if (!threadsQuery.data) void threadsQuery.refetch();
    if (!channelsQuery.data) void channelsQuery.refetch();
  };
  const isNarrowed = query.trim().length > 0 || filter !== "all" || showClosed;

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
      closed: () => threads.filter((th) => th.status === "RESOLVED" && threadMatchesQuery(th)),
    };
  }, [threads, channels, q, me.id]);

  const closedThreads = useMemo(() => select.closed(), [select]);
  const visibleThreads = useMemo(
    () => (showClosed ? closedThreads : select.threads(filter)),
    [select, filter, showClosed, closedThreads],
  );
  const visibleChannels = useMemo(
    () => (showClosed ? [] : select.channels(filter)),
    [select, filter, showClosed],
  );

  // No icons: four segments and their figures have to hold one row of the
  // 340px column, and the words are what tell the filters apart.
  const filterItems = useMemo<SegmentedTabItem<TriageFilter>[]>(() => {
    const defs: Array<{ id: TriageFilter; label: string }> = isManager
      ? [
          { id: "all", label: t("messages.filter.all", "Wszystkie") },
          { id: "unread", label: t("messages.filter.unread", "Nowe") },
          { id: "unassigned", label: t("messages.filter.unassigned", "Bez opieki") },
          { id: "mine", label: t("messages.filter.mine", "Moje") },
        ]
      : [
          { id: "all", label: t("messages.filter.all", "Wszystkie") },
          { id: "unread", label: t("messages.filter.unread", "Nowe") },
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
  // `replace`, not push: leaving a conversation by the in-app arrow used to
  // stack [list, thread, list], so the hardware back button re-opened the
  // conversation the member had just closed.
  const clearSelection = () => navigate("/panel/messages", { replace: true });
  const handleCreated = (id: string) => navigate(`/panel/messages/${id}`);
  const handleAnnounced = (id: string) => navigate(`/panel/messages/channel/${id}`);

  const resetView = () => {
    setQuery("");
    setFilter("all");
    setShowClosed(false);
  };

  const nothingToShow = !showChannels && visibleThreads.length === 0;

  // Built once and mounted in exactly ONE chassis: rendering it in the hidden
  // pane as well would put a second live conversation behind the surface —
  // two polls, and two components racing to mark the same thread read.
  const conversation = channelId ? (
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
  ) : null;

  return (
    // Bound to the viewport minus <main>'s own chrome — its vertical padding
    // (~3rem) plus, on touch, the mobile nav dock (--nav-dock-h, 0 on a fine
    // pointer). Everything above the panes lives INSIDE this box, so the header's
    // height is subtracted by flexbox instead of guessed: the constant it
    // replaces (13rem) was ~70px short on a phone and ~90px long on a desktop.
    <div className="mx-auto flex h-[calc(100dvh-var(--nav-dock-h)-3rem)] w-full max-w-300 flex-col">
      <PageHeader
        size="compact"
        roleText={t("messages.eyebrow", "Komunikacja")}
        title={t("messages.title", "Wiadomości")}
        className={cn("shrink-0", isImmersive && "hidden")}
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

      <div className={cn("flex min-h-0 flex-1 gap-4", isImmersive && "hidden")}>
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
          <div className="flex shrink-0 flex-col gap-2.5 border-b border-hairline-strong p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search />}
              placeholder={t("messages.search", "Szukaj rozmowy…")}
              aria-label={t("messages.search", "Szukaj rozmowy…")}
            />
            {showClosed ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="icon"
                  size="icon"
                  type="button"
                  onClick={() => setShowClosed(false)}
                  aria-label={t("messages.list.back_to_inbox", "Wróć do skrzynki")}
                  className="-ml-1 shrink-0"
                >
                  <ArrowLeft size={16} />
                </Button>
                <Eyebrow color="muted">{t("messages.list.closed_entry", "Zamknięte rozmowy")}</Eyebrow>
              </div>
            ) : (
              <SegmentedTabs
                items={filterItems}
                value={filter}
                onChange={setFilter}
                ariaLabel={t("messages.filter.aria", "Filtruj rozmowy")}
                compact
              />
            )}
          </div>

          {inboxFailed ? (
            <StatePanel
              variant="inline"
              tone="danger"
              icon={<CircleAlert size={24} strokeWidth={1.5} />}
              title={t("messages.list.load_failed", "Nie udało się wczytać skrzynki")}
              description={t(
                "messages.conversation.load_failed_desc",
                "Sprawdź połączenie i spróbuj ponownie.",
              )}
              actions={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retryInbox}
                  isLoading={isRetryingInbox}
                  leftIcon={<RotateCw size={14} />}
                >
                  {t("messages.conversation.retry", "Spróbuj ponownie")}
                </Button>
              }
              className="px-6"
            />
          ) : isLoading ? (
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
              {isManager && !showClosed && closedThreads.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClosed(true)}
                  className="flex w-full items-center gap-2 rounded-nested px-3 py-2.5 text-left text-ethereal-graphite transition-colors outline-none hover:bg-ethereal-ink/4 focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
                >
                  <Archive size={14} aria-hidden="true" className="shrink-0 opacity-60" />
                  <Label size="sm" color="inherit">
                    {t("messages.list.closed_entry", "Zamknięte rozmowy")}
                  </Label>
                  <Caption color="muted" className="tabular-nums">
                    {closedThreads.length}
                  </Caption>
                  <ChevronRight size={14} aria-hidden="true" className="ml-auto shrink-0 opacity-40" />
                </button>
              )}
            </div>
          )}
        </GlassCard>

        {/* Conversation / briefing deck — the desktop chassis. */}
        <GlassCard
          variant="ethereal"
          isHoverable={false}
          padding="none"
          className={cn(
            // min-w-0: without it the pane's width follows its own min-content
            // (header actions, composer) and the card grows past the row instead
            // of the conversation adapting to it.
            "h-full min-w-0 flex-1 overflow-hidden",
            hasSelection ? "flex" : "hidden md:flex",
          )}
          // The card is a ROW, so its content wrapper is a flex item sized by
          // its min-content: a truncated snippet or subject still reports its
          // full single-line width there, and the rows ran past the card edge.
          contentClassName="min-w-0"
        >
          {/* A failed inbox leaves the pane empty: the briefing would read the
              missing lists as "all clear", and the inbox beside it already
              carries the error and the retry. */}
          {isImmersive || inboxFailed ? null : (conversation ??
            (isLoading ? (
              <EtherealLoader fullHeight={false} />
            ) : (
              <ConductorDeck
                threads={threads}
                channels={channels}
                isManager={isManager}
                onSelectThread={selectThread}
                onSelectChannel={selectChannel}
              />
            )))}
        </GlassCard>
      </div>

      {isImmersive && <ConversationSurface>{conversation}</ConversationSurface>}

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
