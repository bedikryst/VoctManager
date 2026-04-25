import React, { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { MessageSquare, ExternalLink, AlertTriangle, Info } from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
} from "../api/notifications.queries";
import type { CustomAdminMessageMetadata } from "../types/notifications.dto";
import { Text, Heading } from "@/shared/ui/primitives/typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { useAuth } from "@/app/providers/AuthProvider";

const LEVEL_ICON = {
  INFO: <Info size={15} className="text-ethereal-amethyst shrink-0" />,
  WARNING: <AlertTriangle size={15} className="text-ethereal-gold shrink-0" />,
  URGENT: <AlertTriangle size={15} className="text-ethereal-crimson shrink-0" />,
};

const LEVEL_BORDER = {
  INFO: "border-l-ethereal-amethyst",
  WARNING: "border-l-ethereal-gold",
  URGENT: "border-l-ethereal-crimson",
};

export const CustomAdminMessageToast: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: notifications = [] } = useNotifications(!!user);
  const { mutate: markAsRead } = useMarkNotificationRead();
  const shownToastsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = notifications.filter(
      (n) => n.notification_type === "CUSTOM_ADMIN_MESSAGE" && !n.is_read,
    );

    pending.forEach((notification) => {
      if (shownToastsRef.current.has(notification.id)) return;
      shownToastsRef.current.add(notification.id);

      const meta = notification.metadata as CustomAdminMessageMetadata;
      const level = notification.level;
      const borderClass = LEVEL_BORDER[level] ?? LEVEL_BORDER.INFO;

      toast.custom(
        (toastId) => (
          <GlassCard
            className={`p-4 flex flex-col gap-3 w-full min-w-[320px] max-w-[420px] border-l-2 ${borderClass}`}
          >
            <div className="flex items-start gap-2">
              {LEVEL_ICON[level] ?? LEVEL_ICON.INFO}
              <div className="flex-1 min-w-0">
                <Heading as="h5" size="lg" color="graphite" className="leading-tight">
                  {meta.title}
                </Heading>
                <Text size="xs" color="graphite" className="opacity-60 mt-0.5">
                  {t("notifications.custom_message.from", {
                    name: meta.sender_name,
                  })}
                </Text>
              </div>
            </div>

            <Text
              size="sm"
              color="graphite"
              className="whitespace-pre-line leading-relaxed opacity-80"
            >
              {meta.message}
            </Text>

            <div className="flex items-center justify-between gap-2 mt-1">
              {meta.cta_url ? (
                <a
                  href={meta.cta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-ethereal-amethyst hover:underline"
                >
                  <ExternalLink size={12} />
                  {meta.cta_label ?? t("notifications.custom_message.open_link")}
                </a>
              ) : (
                <span />
              )}
              <button
                onClick={() => {
                  toast.dismiss(toastId);
                  markAsRead(notification.id);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-ethereal-sage text-white hover:bg-emerald-600 transition-colors shadow-sm"
              >
                {t("notifications.custom_message.mark_read")}
              </button>
            </div>
          </GlassCard>
        ),
        {
          duration: Infinity,
          id: notification.id,
          position: "top-center",
          icon: <MessageSquare size={16} />,
        },
      );
    });
  }, [notifications, markAsRead, t]);

  return null;
};
