/**
 * @file PinnedAnnouncements.tsx
 * @description The pinned band at the top of a project channel.
 *
 * Folded, it costs two lines whatever the number of pins: the newest
 * announcement, cut to one line, and how many there are. Unfolded, every pin
 * reads in full, newest first, inside a band that scrolls on its own, so a
 * channel with ten announcements still leaves room for the conversation.
 *
 * It is also where a manager unpins. An announcement pinned in March is outside
 * the stream's window, so its bubble, and the pin toggle on it, may never be on
 * screen.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Pin, PinOff } from "lucide-react";

import { Label, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { relativeStamp } from "../lib/time";
import type { ChannelMessageDTO } from "../types/messages.dto";

/** The stream's pin-toggle geometry: 36px under a thumb, 28px on a pointer. */
const UNPIN_BUTTON_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ethereal-graphite/40 transition-colors hover:text-ethereal-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:opacity-40 fine-pointer:h-7 fine-pointer:w-7";

interface PinnedAnnouncementsProps {
  /** Oldest first, as the channel serves them. */
  pinned: readonly ChannelMessageDTO[];
  isOpen: boolean;
  onToggle: () => void;
  /** Present for managers only; the band has no pin control otherwise. */
  onUnpin?: (messageId: string) => void;
  isUnpinning?: boolean;
}

export const PinnedAnnouncements: React.FC<PinnedAnnouncementsProps> = ({
  pinned,
  isOpen,
  onToggle,
  onUnpin,
  isUnpinning = false,
}) => {
  const { t } = useTranslation();
  const listId = useId();

  const newestFirst = [...pinned].reverse();
  const newest = newestFirst[0];
  if (!newest) return null;

  const senderOf = (message: ChannelMessageDTO): string =>
    message.sender?.name ?? t("messages.channel.unknown_sender", "—");
  const unpinLabel = t("messages.channel.unpin", "Odepnij");

  return (
    <div className="shrink-0 border-b border-ethereal-gold/20 bg-ethereal-gold/6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        className="block w-full px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40 sm:px-5 sm:py-3"
      >
        <span className="flex items-center gap-1.5">
          <Pin size={12} className="text-ethereal-gold" aria-hidden="true" />
          <Label size="xs" color="muted" weight="semibold">
            {t("messages.channel.pinned", "Przypięte")}
          </Label>
          <Label size="xs" color="muted" className="tabular-nums">
            {pinned.length}
          </Label>
          <span className="ml-auto flex items-center gap-1">
            <Label size="xs" color="muted">
              {isOpen
                ? t("messages.channel.pinned_collapse", "Zwiń")
                : t("messages.channel.pinned_expand", "Rozwiń")}
            </Label>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={cn(
                "text-ethereal-graphite/50 transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
          </span>
        </span>
        {!isOpen && (
          <Text as="span" size="xs" color="graphite" className="mt-1 block truncate opacity-80">
            <span className="font-semibold">{senderOf(newest)}:</span> {newest.body}
          </Text>
        )}
      </button>

      {isOpen && (
        <ul
          id={listId}
          className="flex max-h-[40dvh] flex-col divide-y divide-ethereal-gold/15 overflow-y-auto overscroll-contain px-3 pb-2 no-scrollbar sm:px-5"
        >
          {newestFirst.map((message) => (
            <li key={message.id} className="flex items-start gap-2 py-2">
              <div className="min-w-0 flex-1">
                <Label size="xs" color="muted">
                  <span className="font-semibold">{senderOf(message)}</span>
                  {" · "}
                  {relativeStamp(message.created_at, t)}
                </Label>
                <Text size="sm" color="graphite" className="whitespace-pre-wrap wrap-break-word">
                  {message.body}
                </Text>
              </div>
              {onUnpin && (
                <button
                  type="button"
                  onClick={() => onUnpin(message.id)}
                  disabled={isUnpinning}
                  className={UNPIN_BUTTON_CLASS}
                  title={unpinLabel}
                  aria-label={unpinLabel}
                >
                  <PinOff size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
