/**
 * @file ConductorDeck.tsx
 * @description Idle-pane briefing — "Skrzynka dyrygenta". When no conversation is
 * selected this turns dead space into a triage console: a one-line lead and curated
 * buckets (awaiting assignment / needs attention / in your care / channels) that jump
 * straight into the conversation. Derived entirely client-side from the already-loaded
 * thread + channel lists — zero extra fetch.
 *
 * The deck carries no figures. It evaporates the moment a conversation is opened,
 * while the inbox filter tabs beside it never do, so the counts live there and the
 * deck states the work by listing it — the rows ARE the arithmetic.
 *
 * The buckets are a partition, not four independent queries: a thread that is both
 * unassigned and unread belongs to the first bucket that claims it, or the manager
 * reads the same row three times and triages none of them.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Hash, Inbox, MailOpen, MessagesSquare, UserPlus } from "lucide-react";

import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Caption, Eyebrow, Heading } from "@/shared/ui/primitives/typography";
import type { ChannelSummary, ThreadSummary, UserBrief } from "../types/messages.dto";
import { ThreadList } from "./ThreadList";
import { ChannelList } from "./ChannelList";

/**
 * A manager who sees every project channel would otherwise get a directory where a
 * briefing belongs. The cap is a narrowing, so the section states its own census.
 */
const CHANNEL_CAP = 6;

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

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  /** Census for a capped list — never a count the surface states elsewhere. */
  meta?: string;
  children: React.ReactNode;
}> = ({ icon, title, meta, children }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5 px-1">
      <span className="shrink-0 text-ethereal-gold/70" aria-hidden="true">
        {icon}
      </span>
      <Eyebrow color="muted">
        {title}
      </Eyebrow>
      {meta && (
        <Caption color="muted" className="ml-auto tabular-nums">
          {meta}
        </Caption>
      )}
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
    const live = threads.filter((th) => th.status !== "ARCHIVED");
    const open = live.filter((th) => th.status === "OPEN");

    // Precedence, highest first. Each thread lands in exactly one bucket.
    const needsAssignment = isManager
      ? open.filter((th) => !th.assignee).sort(byRecency)
      : [];
    const claimed = new Set(needsAssignment.map((th) => th.id));

    const unreadThreads = live
      .filter((th) => th.unread && !claimed.has(th.id))
      .sort(byRecency);
    unreadThreads.forEach((th) => claimed.add(th.id));

    const inMyCare = open
      .filter((th) => !claimed.has(th.id) && (!isManager || th.assignee?.id === me.id))
      .sort(byRecency);

    const unreadChannels = channels.filter((ch) => ch.unread).sort(byRecency);
    const restChannels = channels.filter((ch) => !ch.unread).sort(byRecency);

    return {
      needsAssignment,
      unreadThreads,
      unreadChannels,
      inMyCare,
      restChannels,
      unreadTotal: unreadThreads.length + unreadChannels.length,
    };
  }, [threads, channels, isManager, me.id]);

  if (threads.length === 0 && channels.length === 0) {
    return (
      <StatePanel
        variant="inline"
        icon={<Inbox size={26} strokeWidth={1.5} />}
        title={t("messages.deck.empty_title", "Cisza w skrzynce")}
        description={t(
          "messages.deck.empty",
          "Nie ma jeszcze żadnych rozmów. Zacznij nową wiadomością.",
        )}
        className="px-6"
      />
    );
  }

  const lead = isManager
    ? buckets.needsAssignment.length > 0
      ? t("messages.deck.lead_assign", "Zgłoszenia czekają na przydział.")
      : buckets.unreadTotal > 0
        ? t("messages.deck.lead_unread", "Są nowe wiadomości.")
        : t("messages.deck.summary_clear", "Wszystko ogarnięte.")
    : buckets.unreadTotal > 0
      ? t("messages.deck.lead_unread_artist", "Masz nowe wiadomości.")
      : t("messages.deck.summary_clear_artist", "Brak nowych wiadomości.");

  const visibleChannels = buckets.restChannels.slice(0, CHANNEL_CAP);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 no-scrollbar">
      <div className="mb-4">
        <Eyebrow color="muted">
          {isManager
            ? t("messages.deck.eyebrow", "Skrzynka dyrygenta")
            : t("messages.deck.eyebrow_artist", "Twoja skrzynka")}
        </Eyebrow>
        <Heading as="h2" size="xl" color="graphite" className="mt-0.5">
          {lead}
        </Heading>
      </div>

      <div className="flex flex-col gap-5">
        {buckets.needsAssignment.length > 0 && (
          <Section
            icon={<UserPlus size={12} />}
            title={t("messages.deck.needs_assignment", "Wymaga przydziału")}
          >
            <ThreadList
              threads={buckets.needsAssignment}
              isManager={isManager}
              onSelect={onSelectThread}
            />
          </Section>
        )}

        {buckets.unreadTotal > 0 && (
          <Section
            icon={<MailOpen size={12} />}
            title={t("messages.deck.needs_attention", "Wymaga uwagi")}
          >
            {buckets.unreadChannels.length > 0 && (
              <ChannelList channels={buckets.unreadChannels} onSelect={onSelectChannel} />
            )}
            {buckets.unreadThreads.length > 0 && (
              <ThreadList
                threads={buckets.unreadThreads}
                isManager={isManager}
                onSelect={onSelectThread}
              />
            )}
          </Section>
        )}

        {buckets.inMyCare.length > 0 && (
          <Section
            icon={<MessagesSquare size={12} />}
            title={
              isManager
                ? t("messages.deck.in_my_care", "Pod Twoją opieką")
                : t("messages.deck.my_threads", "Twoje rozmowy")
            }
          >
            <ThreadList
              threads={buckets.inMyCare}
              isManager={isManager}
              onSelect={onSelectThread}
            />
          </Section>
        )}

        {visibleChannels.length > 0 && (
          <Section
            icon={<Hash size={12} />}
            title={t("messages.deck.channels", "Kanały projektów")}
            meta={
              buckets.restChannels.length > visibleChannels.length
                ? t("messages.deck.channels_census", "{{visible}} z {{total}}", {
                    visible: visibleChannels.length,
                    total: buckets.restChannels.length,
                  })
                : undefined
            }
          >
            <ChannelList channels={visibleChannels} onSelect={onSelectChannel} />
          </Section>
        )}
      </div>
    </div>
  );
};
