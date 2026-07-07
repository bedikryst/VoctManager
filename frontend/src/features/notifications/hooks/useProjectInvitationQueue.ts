/**
 * @file useProjectInvitationQueue.ts
 * @description Session queue of undecided PROJECT_INVITATION notifications, with
 * accept / decline / defer decisions. Extracted from ProjectInvitationToasts so
 * both the standalone modal AND the first-run Welcome Moment present the same
 * invitation from a single source of truth. Accept/decline call
 * updateParticipationStatus + markAsRead and advance the queue; defer skips the
 * current one for this session only — it stays unread server-side and returns on
 * the next load. The success/error toasts live in the mutation callbacks, so both
 * consumers get them for free.
 * @module features/notifications/hooks/useProjectInvitationQueue
 */

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/app/providers/AuthProvider";
import { ProjectService } from "@/features/projects/api/project.service";
import {
  useNotifications,
  useMarkNotificationRead,
} from "../api/notifications.queries";
import type { ProjectInvitationMetadata } from "../types/notifications.dto";

export interface ProjectInvitationQueueItem {
  readonly notificationId: string;
  readonly metadata: ProjectInvitationMetadata;
}

export interface ProjectInvitationQueue {
  /** First undecided, non-deferred invitation, or null. */
  readonly current: ProjectInvitationQueueItem | null;
  /** Total undecided (incl. current) — for the "1 / N" chip. */
  readonly pendingCount: number;
  readonly accept: () => void; // CON + markAsRead + advance
  readonly decline: () => void; // DEC + markAsRead + advance
  readonly defer: () => void; // session-only skip; stays unread server-side
}

export const useProjectInvitationQueue = (): ProjectInvitationQueue => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: notifications = [] } = useNotifications(!!user);
  const { mutate: markAsRead } = useMarkNotificationRead();
  const queryClient = useQueryClient();
  // Session-local: invitations skipped without deciding. They stay unread
  // server-side, so they return on the next load.
  const [deferredIds, setDeferredIds] = useState<Set<string>>(new Set());

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "CON" | "DEC" }) =>
      ProjectService.updateParticipationStatus(id, status),
    onSuccess: () => {
      toast.success(t("notifications.invitation_toast.status_updated"));
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["participations"] });
    },
    onError: () => {
      toast.error(t("notifications.invitation_toast.status_error"));
    },
  });

  const pending = useMemo(
    () =>
      notifications.filter(
        (n) =>
          n.notification_type === "PROJECT_INVITATION" &&
          !n.is_read &&
          !deferredIds.has(n.id),
      ),
    [notifications, deferredIds],
  );

  const currentRaw = pending[0];

  const defer = useCallback(() => {
    if (!currentRaw) return;
    setDeferredIds((prev) => new Set(prev).add(currentRaw.id));
  }, [currentRaw]);

  const respond = useCallback(
    (status: "CON" | "DEC") => {
      if (!currentRaw) return;
      const metadata = currentRaw.metadata as ProjectInvitationMetadata;
      updateStatusMutation.mutate({ id: metadata.participation_id, status });
      markAsRead(currentRaw.id);
      // Advance the queue immediately; the mutation/refetch settle in the background.
      setDeferredIds((prev) => new Set(prev).add(currentRaw.id));
    },
    [currentRaw, updateStatusMutation, markAsRead],
  );

  const accept = useCallback(() => respond("CON"), [respond]);
  const decline = useCallback(() => respond("DEC"), [respond]);

  const current = useMemo<ProjectInvitationQueueItem | null>(
    () =>
      currentRaw
        ? {
            notificationId: currentRaw.id,
            metadata: currentRaw.metadata as ProjectInvitationMetadata,
          }
        : null,
    [currentRaw],
  );

  return { current, pendingCount: pending.length, accept, decline, defer };
};
