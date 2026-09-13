/**
 * @file useDelegationBriefingQueue.ts
 * @description The undismissed "you are running these rehearsals" briefings,
 * one at a time.
 *
 * Shaped like `useProjectInvitationQueue` and deliberately NOT the same thing:
 * an invitation waits for a decision, so it has accept and decline and comes
 * back until one of them is given. A delegation is not offered, it is handed
 * over — there is nothing to answer. So this queue has one exit, `acknowledge`,
 * which marks the row read and does not come back. What it carries instead is
 * an INSTRUCTION, and the reader has to be able to find it again: the row stays
 * in the bell and the e-mail stays in their inbox.
 * @module features/notifications/hooks
 */

import { useCallback, useMemo, useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";

import {
  useNotifications,
  useMarkNotificationRead,
} from "../api/notifications.queries";
import type { RehearsalDelegationMetadata } from "../types/notifications.dto";

export interface DelegationBriefingItem {
  readonly notificationId: string;
  readonly metadata: RehearsalDelegationMetadata;
}

export interface DelegationBriefingQueue {
  /** First unread, non-deferred briefing, or null. */
  readonly current: DelegationBriefingItem | null;
  /** Total unread (incl. current) — for the "1 / N" chip. */
  readonly pendingCount: number;
  /** Read and done: the modal does not return for this one. */
  readonly acknowledge: () => void;
  /** Session-only skip; stays unread server-side and returns on the next load. */
  readonly defer: () => void;
}

export const useDelegationBriefingQueue = (): DelegationBriefingQueue => {
  const { user } = useAuth();
  const { data: notifications = [] } = useNotifications(!!user);
  const { mutate: markAsRead } = useMarkNotificationRead();
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());

  const pending = useMemo(
    () =>
      notifications.filter(
        (n) =>
          n.notification_type === "REHEARSAL_DELEGATED" &&
          !n.is_read &&
          !handledIds.has(n.id),
      ),
    [notifications, handledIds],
  );

  const currentRaw = pending[0];

  const defer = useCallback(() => {
    if (!currentRaw) return;
    setHandledIds((prev) => new Set(prev).add(currentRaw.id));
  }, [currentRaw]);

  const acknowledge = useCallback(() => {
    if (!currentRaw) return;
    markAsRead(currentRaw.id);
    // Advance immediately; the refetch settles behind it.
    setHandledIds((prev) => new Set(prev).add(currentRaw.id));
  }, [currentRaw, markAsRead]);

  const current = useMemo<DelegationBriefingItem | null>(
    () =>
      currentRaw
        ? {
            notificationId: currentRaw.id,
            metadata: currentRaw.metadata as RehearsalDelegationMetadata,
          }
        : null,
    [currentRaw],
  );

  return { current, pendingCount: pending.length, acknowledge, defer };
};
