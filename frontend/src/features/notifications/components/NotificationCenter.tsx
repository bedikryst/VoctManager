/**
 * @file NotificationCenter.tsx
 * @description Synchronized Overlay Notification Widget.
 * Perfected Chiaroscuro glassmorphism via isolated Stacking Contexts and
 * direct Polymorphic Tweening to prevent browser backdrop-filter culling.
 * @architecture Enterprise SaaS 2026
 */

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Bell, Check, X, BellRing } from "lucide-react";

import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
} from "../api/notifications.queries";
import { NotificationItem } from "./NotificationItem";

import { Heading, Text, Label } from "@/shared/ui/primitives/typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Divider } from "@/shared/ui/primitives/Divider";
import { cn } from "@/shared/lib/utils";

import { useAuth } from "@/app/providers/AuthProvider";

interface NotificationCenterProps {
  className?: string;
}

const ETHEREAL_SPRING: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 40,
  mass: 0.8,
};

const BACKDROP_TRANSITION: Transition = {
  duration: 0.4,
  ease: [0.16, 1, 0.3, 1],
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useUnreadNotificationCount(!!user);
  const { data: notifications = [], isLoading } = useNotifications(!!user);
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    drawerRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsOpen(false);
  };

  const renderSynchronizedPortal = () => {
    if (typeof document === "undefined") return null;

    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(2px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              transition={BACKDROP_TRANSITION}
              onClick={handleClose}
              className="absolute inset-0 bg-ethereal-ink/5 pointer-events-auto cursor-pointer"
              aria-hidden="true"
            />

            <GlassCard
              as={motion.div}
              ref={drawerRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={t("notifications.title")}
              variant="ethereal"
              withNoise={true}
              isHoverable={false}
              glow={false}
              padding="none"
              initial={{
                x: -16,
                scale: 0.96,
                opacity: 0,
                backdropFilter: "blur(0px)",
              }}
              animate={{
                x: 0,
                scale: 1,
                opacity: 1,
                backdropFilter: "blur(32px)",
              }}
              exit={{
                x: -16,
                scale: 0.96,
                opacity: 0,
                backdropFilter: "blur(0px)",
              }}
              transition={ETHEREAL_SPRING}
              style={{ originX: 0, originY: 0.5 }}
              className="absolute bottom-4 left-4 top-4 w-[280px] z-10 pointer-events-auto flex flex-col rounded-[24px] border border-white/40 shadow-[var(--shadow-ethereal-deep)] outline-none"
            >
              {/* Header Stratum */}
              <div className="relative flex flex-col p-5 pb-4 flex-shrink-0 bg-white/5 rounded-t-[24px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-ethereal-gold/20 to-transparent border border-ethereal-gold/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                      <Bell
                        className="text-ethereal-gold"
                        size={18}
                        strokeWidth={2}
                      />
                    </div>
                    <Heading
                      size="xl"
                      className="leading-tight text-ethereal-ink"
                    >
                      {t("notifications.title")}
                    </Heading>
                  </div>

                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead()}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-black/5 text-ethereal-graphite/60 transition-colors hover:bg-black/10 hover:text-ethereal-ink outline-none"
                        title={t("notifications.mark_all_read")}
                      >
                        <Check size={16} strokeWidth={2} />
                      </button>
                    )}
                    <button
                      onClick={handleClose}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-black/5 text-ethereal-graphite/60 transition-colors hover:bg-red-500/10 hover:text-red-500 outline-none"
                      aria-label={t("common.close")}
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-1 pt-5">
                  <span className="relative flex h-2 w-2">
                    {unreadCount > 0 && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ethereal-gold opacity-75" />
                    )}
                    <span
                      className={cn(
                        "relative inline-flex rounded-full h-2 w-2",
                        unreadCount > 0 ? "bg-ethereal-gold" : "",
                      )}
                    />
                  </span>
                  <Text size="xs" color="muted" weight="medium">
                    {unreadCount > 0
                      ? `${unreadCount} ${t("notifications.unread")}`
                      : ""}
                  </Text>
                </div>
                <Divider
                  variant="fade"
                  position="absolute-bottom"
                  className="opacity-40"
                />
              </div>

              {/* List Stratum */}
              <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-2 [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden rounded-b-[24px]">
                {isLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Infinity,
                        duration: 3,
                        ease: "linear",
                      }}
                    >
                      <BellRing
                        size={24}
                        className="text-ethereal-gold opacity-40"
                      />
                    </motion.div>
                  </div>
                ) : notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <NotificationItem
                      key={notif.id}
                      notification={notif}
                      onClosePanel={handleClose}
                    />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="flex h-full min-h-[200px] flex-col items-center justify-center px-4"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/5 border border-black/5 mb-3 shadow-[var(--shadow-ethereal-soft)]">
                      <Bell
                        size={20}
                        strokeWidth={1.5}
                        className="text-ethereal-graphite/40"
                      />
                    </div>
                    <Heading
                      size="lg"
                      color="default"
                      className="opacity-80 text-center"
                    >
                      {t("notifications.empty_title")}
                    </Heading>
                    <Text
                      size="base"
                      color="muted"
                      className="mt-1 text-center"
                    >
                      {t("notifications.empty_subtitle")}
                    </Text>
                  </motion.div>
                )}
              </div>
            </GlassCard>
          </div>
        )}
      </AnimatePresence>,
      document.body,
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "relative flex h-full w-full items-center justify-center rounded-[12px] text-ethereal-graphite/60 transition-colors outline-none hover:bg-white/10 hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
          className,
        )}
      >
        <Bell size={18} strokeWidth={2} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute right-2 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ethereal-gold px-1 shadow-[0_0_10px_rgba(194,168,120,0.5)] ring-2 ring-white/10"
            >
              <Label
                size="xs"
                color="white"
                weight="bold"
                className="text-[10px] leading-none"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Label>
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {renderSynchronizedPortal()}
    </>
  );
};
