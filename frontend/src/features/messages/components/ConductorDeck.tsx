/**
 * @file ConductorDeck.tsx
 * @description Idle-pane briefing — "Skrzynka dyrygenta". When no conversation is
 * selected the pane lists what asks for action and nothing else: threads awaiting
 * assignment, then unread channels and threads, each row jumping straight into the
 * conversation. When nothing asks, it says so in one short state. Derived entirely
 * client-side from the already-loaded thread + channel lists — zero extra fetch.
 *
 * It does not relist the inbox. Every conversation already sits one glance to the
 * left, so a section of the reader's own threads or of the project channels here
 * is a second directory of the same rows.
 *
 * The deck carries no figures. It evaporates the moment a conversation is opened,
 * while the inbox filter tabs beside it never do, so the counts live there and the
 * deck states the work by listing it — the rows ARE the arithmetic.
 *
 * The two buckets are a partition: a thread that is both unassigned and unread
 * appears under assignment only, or the manager reads the same row twice.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCheck, Inbox } from "lucide-react";

import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Eyebrow, Heading } from "@/shared/ui/primitives/typography";
import type { ChannelSummary, ThreadSummary } from "../types/messages.dto";
import { ThreadList } from "./ThreadList";
import { ChannelList } from "./ChannelList";
import { SectionLabel } from "./SectionLabel";

interface ConductorDeckProps {
  threads: ThreadSummary[];
  channels: ChannelSummary[];
  isManager: boolean;
  onSelectThread: (id: string) => void;
  onSelectChannel: (id: string) => void;
}

const byRecency = (a: { last_message_at: string | null }, b: { last_message_at: string | null }) =>
  (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "");

export const ConductorDeck: React.FC<ConductorDeckProps> = ({
  threads,
  channels,
  isManager,
  onSelectThread,
  onSelectChannel,
}) => {
  const { t } = useTranslation();

  const buckets = useMemo(() => {
    const live = threads.filter((th) => th.status !== "ARCHIVED");

    const needsAssignment = isManager
      ? live.filter((th) => th.status === "OPEN" && !th.assignee).sort(byRecency)
      : [];
    const claimed = new Set(needsAssignment.map((th) => th.id));

    const unreadThreads = live
      .filter((th) => th.unread && !claimed.has(th.id))
      .sort(byRecency);
    const unreadChannels = channels.filter((ch) => ch.unread).sort(byRecency);

    return { needsAssignment, unreadThreads, unreadChannels };
  }, [threads, channels, isManager]);

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

  const hasUnread = buckets.unreadThreads.length + buckets.unreadChannels.length > 0;

  if (buckets.needsAssignment.length === 0 && !hasUnread) {
    return (
      <StatePanel
        variant="inline"
        icon={<CheckCheck size={26} strokeWidth={1.5} />}
        title={
          isManager
            ? t("messages.deck.summary_clear", "Wszystko ogarnięte.")
            : t("messages.deck.summary_clear_artist", "Brak nowych wiadomości.")
        }
        description={
          isManager
            ? t(
                "messages.deck.clear_hint",
                "Tu pojawią się nowe wiadomości i zgłoszenia bez przydziału.",
              )
            : t("messages.deck.clear_hint_artist", "Tu pojawią się nowe wiadomości.")
        }
        className="px-6"
      />
    );
  }

  const lead = isManager
    ? buckets.needsAssignment.length > 0
      ? t("messages.deck.lead_assign", "Zgłoszenia czekają na przydział.")
      : t("messages.deck.lead_unread", "Są nowe wiadomości.")
    : t("messages.deck.lead_unread_artist", "Masz nowe wiadomości.");

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
          <div className="flex flex-col gap-1.5">
            <SectionLabel>{t("messages.deck.needs_assignment", "Wymaga przydziału")}</SectionLabel>
            <ThreadList
              threads={buckets.needsAssignment}
              isManager={isManager}
              onSelect={onSelectThread}
            />
          </div>
        )}

        {hasUnread && (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>{t("messages.deck.needs_attention", "Wymaga uwagi")}</SectionLabel>
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
          </div>
        )}
      </div>
    </div>
  );
};
