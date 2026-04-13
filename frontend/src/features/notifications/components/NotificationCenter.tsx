/**
 * @file NotificationCenter.tsx
 * @description Global notification widget with smart polling and framer-motion drawer.
 * Seamlessly integrates into the Top Navigation or Sidebar.
 * @architecture Enterprise SaaS 2026
 */

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Bell, Check, X, BellRing } from "lucide-react";

import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
} from "../api/notifications.queries";
import { NotificationItem } from "./NotificationItem";

export const NotificationCenter: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: notifications = [], isLoading } = useNotifications();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200/80 bg-white/60 text-stone-600 shadow-sm transition-all hover:bg-white hover:text-brand active:scale-95"
        aria-label={t("notifications.title", "Powiadomienia")}
      >
        <Bell size={18} strokeWidth={2.5} />

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-stone-900/20 backdrop-blur-sm"
              aria-hidden="true"
            />

            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 right-0 top-0 z-[70] flex w-full max-w-sm flex-col bg-[#f8f7f5] shadow-2xl border-l border-white/60"
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-200/60 bg-white/80 p-5 backdrop-blur-xl">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">
                    {t("notifications.title", "Powiadomienia")}
                  </h3>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
                    {unreadCount} {t("notifications.unread", "nieprzeczytane")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead()}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-900"
                      title={t(
                        "notifications.mark_all_read",
                        "Oznacz wszystkie jako przeczytane",
                      )}
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-900"
                  >
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden">
                {isLoading ? (
                  <div className="flex h-32 items-center justify-center text-stone-400">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Infinity,
                        duration: 1,
                        ease: "linear",
                      }}
                    >
                      <BellRing size={20} className="opacity-50" />
                    </motion.div>
                  </div>
                ) : notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <NotificationItem
                      key={notif.id}
                      notification={notif}
                      onClosePanel={() => setIsOpen(false)}
                    />
                  ))
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-300">
                      <Bell size={24} />
                    </div>
                    <p className="mt-4 text-sm font-bold text-stone-500">
                      {t("notifications.empty_title", "Wszystko przeczytane")}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {t(
                        "notifications.empty_subtitle",
                        "Nie masz nowych powiadomień.",
                      )}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
