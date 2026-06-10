/**
 * @file UnreadMessagesAlert.tsx
 * @description Slim dashboard banner surfacing unread conversation threads. Self-gating:
 * renders nothing when the inbox is clear, so it never leaves an empty grid cell.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/UnreadMessagesAlert
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";

import { Heading, Label } from "@/shared/ui/primitives/typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { KineticActionCue } from "@/shared/ui/kinematics/KineticActionCue";
import { cn } from "@/shared/lib/utils";
import { useUnreadThreadCount } from "@/features/messages/api/messages.queries";

interface UnreadMessagesAlertProps {
  className?: string;
}

export const UnreadMessagesAlert: React.FC<UnreadMessagesAlertProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  const { data: unread = 0 } = useUnreadThreadCount();

  if (unread <= 0) return null;

  return (
    <GlassCard
      variant="ethereal"
      padding="none"
      isHoverable={false}
      className={cn(
        "group/msg relative hover:border-ethereal-gold/30 hover:shadow-glass-ethereal-hover",
        className,
      )}
    >
      <Link
        to="/panel/messages"
        className="absolute inset-0 z-10 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/50"
        aria-label={t("messages.alert.aria", "Otwórz wiadomości")}
      />
      <div className="pointer-events-none relative z-20 flex items-center gap-4 px-6 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ethereal-gold/30 bg-gradient-to-br from-ethereal-gold/20 to-transparent">
          <MessageCircle size={20} strokeWidth={2} className="text-ethereal-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <Heading as="h3" size="lg" color="default">
            {t("messages.alert.title", "Nieprzeczytane wiadomości")}
          </Heading>
          <Label size="sm" color="muted">
            {t("messages.alert.count", "Masz {{count}} nieprzeczytanych rozmów", {
              count: unread,
            })}
          </Label>
        </div>
        <KineticActionCue direction="right" />
      </div>
    </GlassCard>
  );
};
