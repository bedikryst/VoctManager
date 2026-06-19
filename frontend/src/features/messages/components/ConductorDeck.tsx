/**
 * @file ConductorDeck.tsx
 * @description Idle-pane briefing — "Skrzynka dyrygenta". When no conversation is
 * selected this turns dead space into a triage console: a one-line status, headline
 * counts, and curated buckets (awaiting assignment / needs attention / active
 * channels) that jump straight into the conversation. Derived entirely client-side
 * from the already-loaded thread + channel lists — zero extra fetch.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Hash, Inbox, MailOpen, UserPlus } from "lucide-react";

import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import type { ChannelSummary, ThreadSummary, UserBrief } from "../types/messages.dto";
import { ThreadList } from "./ThreadList";
import { ChannelList } from "./ChannelList";

interface ConductorDeckProps {
  threads: ThreadSummary[];
  channels: ChannelSummary[];
  isManager: boolean;
  me: UserBrief;
  onSelectThread: (id: string) => void;
  onSelectChannel: (id: string) => void;
}

const byRecency = (a: { last_message_at: string | null }, b: { last_message_at: string | null }) =>
  (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "");

const StatChip: React.FC<{
  icon: React.ReactNode;
  value: number;
  label: string;
  alarm?: boolean;
}> = ({ icon, value, label, alarm = false }) => (
  <Caption color="muted" className="inline-flex items-center gap-1.5 tabular-nums">
    <span
      className={cn("shrink-0", alarm && value > 0 ? "text-ethereal-crimson" : "text-ethereal-gold/70")}
      aria-hidden="true"
    >
      {icon}
    </span>
    <Text
      as="span"
      size="sm"
      weight="semibold"
      className={alarm && value > 0 ? "text-ethereal-crimson" : "text-ethereal-ink"}
    >
      {value}
    </Text>
    {label}
  </Caption>
);

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  tone?: "default" | "alarm";
  children: React.ReactNode;
}> = ({ icon, title, tone = "default", children }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5 px-1">
      <span
        className={cn("shrink-0", tone === "alarm" ? "text-ethereal-crimson" : "text-ethereal-gold/70")}
        aria-hidden="true"
      >
        {icon}
      </span>
      <Eyebrow color="muted" size="caption" className="tracking-[0.12em]">
        {title}
      </Eyebrow>
    </div>
    {children}
  </div>
);

export const ConductorDeck: React.FC<ConductorDeckProps> = ({
  threads,
  channels,
  isManager,
  me,
  onSelectThread,
  onSelectChannel,
}) => {
  const { t } = useTranslation();

  const buckets = useMemo(() => {
    const open = threads.filter((th) => th.status === "OPEN");
    const needsAssignment = isManager
      ? open.filter((th) => !th.assignee).sort(byRecency)
      : [];
    const unreadThreads = threads.filter((th) => th.unread).sort(byRecency);
    const unreadChannels = channels.filter((ch) => ch.unread).sort(byRecency);
    const mineOpen = isManager
      ? open.filter((th) => th.assignee?.id === me.id && !th.unread).sort(byRecency)
      : open.filter((th) => !th.unread).sort(byRecency);
    const recentChannels = [...channels].sort(byRecency).slice(0, 6);
    return { needsAssignment, unreadThreads, unreadChannels, mineOpen, recentChannels, openCount: open.length };
  }, [threads, channels, isManager, me.id]);

  const unreadTotal = buckets.unreadThreads.length + buckets.unreadChannels.length;
  const isEmpty = threads.length === 0 && channels.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ethereal-ink/8 bg-black/5">
          <Inbox size={22} strokeWidth={1.5} className="text-ethereal-graphite/40" />
        </div>
        <Text size="sm" color="muted">
          {t("messages.deck.empty", "Brak rozmów. Zacznij nową wiadomością.")}
        </Text>
      </div>
    );
  }

  const summary = isManager
    ? buckets.needsAssignment.length > 0
      ? t("messages.deck.summary_assign", "{{count}} czeka na przydział", {
          count: buckets.needsAssignment.length,
        })
      : unreadTotal > 0
        ? t("messages.deck.summary_unread", "{{count}} nieprzeczytanych", { count: unreadTotal })
        : t("messages.deck.summary_clear", "Wszystko ogarnięte.")
    : unreadTotal > 0
      ? t("messages.deck.summary_unread", "{{count}} nieprzeczytanych", { count: unreadTotal })
      : t("messages.deck.summary_clear_artist", "Brak nowych wiadomości.");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 no-scrollbar">
      {/* Briefing header */}
      <div className="mb-4">
        <Eyebrow color="muted" size="caption" className="tracking-[0.12em]">
          {isManager
            ? t("messages.deck.eyebrow", "Skrzynka dyrygenta")
            : t("messages.deck.eyebrow_artist", "Twoja skrzynka")}
        </Eyebrow>
        <Heading as="h2" size="xl" color="graphite" className="mt-0.5">
          {summary}
        </Heading>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatChip icon={<MailOpen size={12} />} value={unreadTotal} label={t("messages.deck.stat_unread", "nieprzeczytane")} alarm />
          <StatChip icon={<Inbox size={12} />} value={buckets.openCount} label={t("messages.deck.stat_open", "otwarte")} />
          {isManager && (
            <StatChip
              icon={<UserPlus size={12} />}
              value={buckets.needsAssignment.length}
              label={t("messages.deck.stat_unassigned", "bez opieki")}
              alarm
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {buckets.needsAssignment.length > 0 && (
          <Section icon={<UserPlus size={12} />} title={t("messages.deck.needs_assignment", "Wymaga przydziału")} tone="alarm">
            <ThreadList threads={buckets.needsAssignment} isManager={isManager} onSelect={onSelectThread} />
          </Section>
        )}

        {(buckets.unreadThreads.length > 0 || buckets.unreadChannels.length > 0) && (
          <Section icon={<MailOpen size={12} />} title={t("messages.deck.needs_attention", "Wymaga uwagi")}>
            {buckets.unreadChannels.length > 0 && (
              <ChannelList channels={buckets.unreadChannels} onSelect={onSelectChannel} />
            )}
            {buckets.unreadThreads.length > 0 && (
              <ThreadList threads={buckets.unreadThreads} isManager={isManager} onSelect={onSelectThread} />
            )}
          </Section>
        )}

        {unreadTotal === 0 && buckets.needsAssignment.length === 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-ethereal-sage/20 bg-ethereal-sage/5 px-4 py-3">
            <CheckCircle2 size={16} className="shrink-0 text-ethereal-sage" aria-hidden="true" />
            <Text size="sm" color="muted">
              {t("messages.deck.all_clear", "Skrzynka czysta — wszystkie rozmowy obsłużone.")}
            </Text>
          </div>
        )}

        {buckets.recentChannels.length > 0 && (
          <Section icon={<Hash size={12} />} title={t("messages.deck.channels", "Kanały projektów")}>
            <ChannelList channels={buckets.recentChannels} onSelect={onSelectChannel} />
          </Section>
        )}
      </div>
    </div>
  );
};
