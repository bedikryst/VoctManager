import React, { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Calendar, MapPin, User as UserIcon } from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
} from "../api/notifications.queries";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProjectService } from "@/features/projects/api/project.service";
import type { ProjectInvitationMetadata } from "../types/notifications.dto";
import { Text, Heading } from "@/shared/ui/primitives/typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { useAuth } from "@/app/providers/AuthProvider";

export const ProjectInvitationToasts: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: notifications = [] } = useNotifications(!!user);
  const { mutate: markAsRead } = useMarkNotificationRead();
  const queryClient = useQueryClient();
  const shownToastsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    const pendingInvitations = notifications.filter(
      (n) => n.notification_type === "PROJECT_INVITATION" && !n.is_read
    );

    pendingInvitations.forEach((notification) => {
      if (shownToastsRef.current.has(notification.id)) {
        return;
      }
      shownToastsRef.current.add(notification.id);

      const metadata = notification.metadata as ProjectInvitationMetadata;

      toast.custom(
        (toastId) => (
          <GlassCard className="p-4 flex flex-col gap-3 w-full min-w-[320px] max-w-[400px]">
            <div>
              <Heading as="h5" size="lg" className="text-ethereal-graphite dark:text-ethereal-parchment">
                {metadata.project_name}
              </Heading>
              <Text size="sm" className="text-ethereal-graphite/60 dark:text-white/60 mb-2">
                {t("notifications.invitation_toast.title")}
              </Text>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-ethereal-graphite/80 dark:text-white/80">
                <UserIcon size={14} className="text-ethereal-amethyst" />
                <Text size="sm">
                  {t("notifications.invitation_toast.invites", {
                    name: metadata.inviter_name || t("common.management", "Zarząd"),
                  })}
                </Text>
              </div>
              <div className="flex items-center gap-2 text-ethereal-graphite/80 dark:text-white/80">
                <Calendar size={14} className="text-ethereal-sage" />
                <Text size="sm">{metadata.date_range}</Text>
              </div>
              <div className="flex items-center gap-2 text-ethereal-graphite/80 dark:text-white/80">
                <MapPin size={14} className="text-ethereal-gold" />
                <Text size="sm" className="truncate">{metadata.location}</Text>
              </div>
              {metadata.description && (
                <Text size="xs" className="mt-1 text-ethereal-graphite/60 dark:text-white/60 italic line-clamp-2">
                  {metadata.description}
                </Text>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  toast.dismiss(toastId);
                  updateStatusMutation.mutate({
                    id: metadata.participation_id,
                    status: "DEC",
                  });
                  markAsRead(notification.id);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-ethereal-crimson hover:bg-red-500/10 transition-colors"
              >
                {t("notifications.invitation_toast.decline")}
              </button>
              <button
                onClick={() => {
                  toast.dismiss(toastId);
                  updateStatusMutation.mutate({
                    id: metadata.participation_id,
                    status: "CON",
                  });
                  markAsRead(notification.id);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-ethereal-sage text-white hover:bg-emerald-600 transition-colors shadow-sm"
              >
                {t("notifications.invitation_toast.accept")}
              </button>
            </div>
          </GlassCard>
        ),
        {
          duration: Infinity,
          id: notification.id,
          position: "top-center",
        }
      );
    });
  }, [notifications, markAsRead, updateStatusMutation, t]);

  return null;
};
