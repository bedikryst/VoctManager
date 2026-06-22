/**
 * @file NotificationCenter.tsx
 * @description Bell trigger + a responsive notification surface in the Ethereal
 * language. On a fine pointer it slides out as a left drawer beside the sidebar;
 * on touch it rises as a draggable bottom-sheet. Both share one body (header +
 * unread/earlier sections + empty/loading states). Real enter/exit animations:
 * the scrim and panel are direct `AnimatePresence` children (motion elements),
 * not wrapped in a static div, so closing animates instead of snapping.
 * @module features/notifications/components
 * @architecture Enterprise SaaS 2026
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  type PanInfo,
  type Transition,
} from "framer-motion";
import { useTranslation } from "react-i18next";
import { Bell, BellOff, BellRing, Check, ChevronDown, Info, X } from "lucide-react";

import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
  useMarkNotificationsSeen,
} from "../api/notifications.queries";
import type { NotificationDTO } from "../types/notifications.dto";
import { NotificationItem } from "./NotificationItem";
import { NotificationItemBoundary } from "./NotificationItemBoundary";

import { Heading, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/app/providers/AuthProvider";
import { useIsFinePointer } from "@/shared/lib/dom/useMediaQuery";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useCloseWatcher } from "@/shared/lib/dom/useCloseWatcher";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";

interface NotificationCenterProps {
  className?: string;
  /**
   * `"icon"` (default) = a square bell button that fills its container (sidebar
   * footer). `"tab"` = a labelled, full-height bottom-tab-bar cell with the bell
   * + count rendered inline — so notifications live on the always-visible bar.
   */
  variant?: "icon" | "tab";
  /** Tab label (only used by `variant="tab"`). */
  label?: string;
}

const DRAWER_SPRING: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 40,
  mass: 0.8,
};

const SHEET_SPRING: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 36,
  mass: 0.8,
};

const SCRIM_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

const SWIPE_OFFSET_THRESHOLD = 90;
const SWIPE_VELOCITY_THRESHOLD = 420;

type DayBucketKey = "today" | "yesterday" | "this_week" | "this_month" | "older";
const BUCKET_ORDER: readonly DayBucketKey[] = [
  "today",
  "yesterday",
  "this_week",
  "this_month",
  "older",
];

const startOfDayMs = (date: Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const bucketFor = (iso: string, todayStart: number): DayBucketKey => {
  const DAY = 86_400_000;
  const created = startOfDayMs(new Date(iso));
  if (created >= todayStart) return "today";
  if (created >= todayStart - DAY) return "yesterday";
  if (created >= todayStart - 7 * DAY) return "this_week";
  if (created >= todayStart - 30 * DAY) return "this_month";
  return "older";
};

/** Buckets read notifications into ordered day groups, preserving newest-first
 *  order within each group and dropping any empty bucket. */
const groupByDay = (
  items: readonly NotificationDTO[],
): { key: DayBucketKey; items: NotificationDTO[] }[] => {
  const todayStart = startOfDayMs(new Date());
  const map = new Map<DayBucketKey, NotificationDTO[]>();
  for (const item of items) {
    const key = bucketFor(item.created_at, todayStart);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return BUCKET_ORDER.filter((key) => map.has(key)).map((key) => ({
    key,
    items: map.get(key)!,
  }));
};

/** Quiet placeholder shown when a single row fails to render (see boundary). */
const FallbackRow: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ethereal-graphite/10 text-ethereal-graphite/45">
        <Info size={16} strokeWidth={2} aria-hidden="true" />
      </div>
      <Text size="sm" color="muted">
        {t("notifications.render_error", "Nie udało się wyświetlić tego powiadomienia.")}
      </Text>
    </div>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  className,
  variant = "icon",
  label,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const isFinePointer = useIsFinePointer();

  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const y = useMotionValue(0);

  const { data: counts } = useUnreadNotificationCount(!!user);
  // `unreadCount` = true per-item unread (header + "mark all read"); `newCount` =
  // new-since-seen (the bell badge, cleared on open).
  const unreadCount = counts?.unread_count ?? 0;
  const newCount = counts?.new_count ?? 0;
  const {
    data: notifications = [],
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications(!!user);
  const { mutate: markAllRead } = useMarkAllNotificationsRead();
  const { mutate: markSeen } = useMarkNotificationsSeen();

  const close = useCallback(() => setIsOpen(false), []);

  useBodyScrollLock(isOpen);
  useCloseWatcher(isOpen, close);
  useFocusTrap(panelRef, isOpen);

  // Opening the centre "sees" everything currently new — clears the bell badge
  // without marking anything read (per-item unread state is untouched).
  useEffect(() => {
    if (isOpen && newCount > 0) markSeen();
  }, [isOpen, newCount, markSeen]);

  const { unread, read } = useMemo(() => {
    const unreadList: NotificationDTO[] = [];
    const readList: NotificationDTO[] = [];
    for (const item of notifications) {
      (item.is_read ? readList : unreadList).push(item);
    }
    return { unread: unreadList, read: readList };
  }, [notifications]);

  const readGroups = useMemo(() => groupByDay(read), [read]);

  const handleDragEnd = (
    _: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    if (
      info.offset.y > SWIPE_OFFSET_THRESHOLD ||
      info.velocity.y > SWIPE_VELOCITY_THRESHOLD
    ) {
      close();
    }
  };

  const renderSection = (
    label: string,
    items: readonly NotificationDTO[],
    withCount: boolean,
  ): React.JSX.Element => (
    <div className="mb-1.5 last:mb-0">
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-3">
        <Eyebrow
          size="caption"
          color="muted"
          weight="medium"
          className="tracking-[0.18em]"
        >
          {label}
        </Eyebrow>
        {withCount && (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-ethereal-gold/15 px-1 text-[10px] font-semibold text-ethereal-gold">
            {items.length}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NotificationItemBoundary key={item.id} fallback={<FallbackRow />}>
            <NotificationItem notification={item} onClosePanel={close} />
          </NotificationItemBoundary>
        ))}
      </div>
    </div>
  );

  const header = (
    <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ethereal-gold/30 bg-gradient-to-br from-ethereal-gold/20 to-transparent">
          <Bell size={17} strokeWidth={2} className="text-ethereal-gold" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col">
          <Heading size="lg" className="leading-tight text-ethereal-ink">
            {t("notifications.title")}
          </Heading>
          <Eyebrow size="caption" color="muted" className="mt-0.5 tracking-[0.1em]">
            {unreadCount > 0
              ? `${unreadCount} ${t("notifications.unread")}`
              : t("notifications.all_read", "Wszystko przeczytane")}
          </Eyebrow>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead()}
            title={t("notifications.mark_all_read")}
            aria-label={t("notifications.mark_all_read")}
            className="grid h-9 w-9 place-items-center rounded-lg text-ethereal-graphite/60 outline-none transition-colors hover:bg-ethereal-ink/[0.05] hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
          >
            <Check size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label={t("common.close", "Zamknij")}
          className="grid h-9 w-9 place-items-center rounded-lg text-ethereal-graphite/60 outline-none transition-colors hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
          >
            <BellRing size={22} className="text-ethereal-gold/40" aria-hidden="true" />
          </motion.div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-ethereal-gold/20 bg-ethereal-alabaster">
            <BellOff
              size={22}
              strokeWidth={1.5}
              className="text-ethereal-graphite/40"
              aria-hidden="true"
            />
          </div>
          <div>
            <Heading size="md" className="text-ethereal-ink">
              {t("notifications.empty_title")}
            </Heading>
            <Text size="sm" color="muted" className="mt-1">
              {t("notifications.empty_subtitle")}
            </Text>
          </div>
        </div>
      ) : (
        <>
          {unread.length > 0 &&
            renderSection(t("notifications.section_new", "Nowe"), unread, true)}

          {readGroups.map((group) => (
            <React.Fragment key={group.key}>
              {renderSection(
                t(`notifications.groups.${group.key}`),
                group.items,
                false,
              )}
            </React.Fragment>
          ))}

          {hasNextPage && (
            <div className="flex justify-center pb-2 pt-1">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ethereal-graphite/55 outline-none transition-colors hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronDown
                  size={14}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className={isFetchingNextPage ? "animate-bounce" : undefined}
                />
                {t("notifications.show_older", "Pokaż starsze")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const countBadge = newCount > 0 && (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className={cn(
        "absolute flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-ethereal-gold px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_10px_rgba(194,168,120,0.5)] ring-2 ring-ethereal-alabaster",
        variant === "tab" ? "-right-2 -top-1" : "right-1.5 top-1",
      )}
    >
      {newCount > 99 ? "99+" : newCount}
    </motion.span>
  );

  return (
    <>
      {variant === "tab" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={label ?? t("notifications.title")}
          aria-haspopup="dialog"
          className={cn(
            "relative flex flex-1 select-none flex-col items-center justify-center gap-1.5 rounded-xl pt-2 pb-1 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.95]",
            newCount > 0
              ? "text-ethereal-gold"
              : "text-ethereal-graphite/55 hover:text-ethereal-ink",
            className,
          )}
        >
          <span className="relative flex h-8 items-center justify-center">
            <Bell
              size={21}
              strokeWidth={newCount > 0 ? 2.25 : 1.75}
              aria-hidden="true"
            />
            <AnimatePresence>{countBadge}</AnimatePresence>
          </span>
          <span className="max-w-full truncate text-[10.5px] font-medium leading-none tracking-tight">
            {label ?? t("notifications.title")}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={t("notifications.title")}
          aria-haspopup="dialog"
          className={cn(
            "relative flex h-full w-full items-center justify-center rounded-[12px] text-ethereal-graphite/60 outline-none transition-colors hover:bg-ethereal-ink/[0.05] hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
            className,
          )}
        >
          <Bell size={18} strokeWidth={2} aria-hidden="true" />
          <AnimatePresence>{countBadge}</AnimatePresence>
        </button>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                key="notif-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={SCRIM_TRANSITION}
                onClick={close}
                aria-hidden="true"
                className={cn(
                  "fixed inset-0 z-[99]",
                  isFinePointer
                    ? "bg-ethereal-ink/10"
                    : "bg-ethereal-ink/45 backdrop-blur-[3px]",
                )}
              />
            )}

            {isOpen &&
              (isFinePointer ? (
                <motion.div
                  key="notif-drawer"
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("notifications.title")}
                  initial={{ opacity: 0, x: -16, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -16, scale: 0.98 }}
                  transition={DRAWER_SPRING}
                  style={{ originX: 0, originY: 0.5 }}
                  className="fixed bottom-4 left-4 top-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[26px] border border-ethereal-gold/20 bg-ethereal-alabaster shadow-[0_28px_70px_-20px_rgba(22,20,18,0.4)] outline-none"
                >
                  {header}
                  <div className="mx-3 h-px shrink-0 bg-ethereal-graphite/10" />
                  {body}
                </motion.div>
              ) : (
                <motion.div
                  key="notif-sheet"
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("notifications.title")}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%", transition: { duration: 0.2, ease: "circIn" } }}
                  transition={SHEET_SPRING}
                  style={{ y, contain: "paint" }}
                  drag="y"
                  dragControls={dragControls}
                  dragListener={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.05}
                  onDragEnd={handleDragEnd}
                  className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[26px] border-t border-glass-border bg-ethereal-alabaster shadow-[0_-12px_40px_-8px_rgba(22,20,18,0.2)] outline-none"
                >
                  <div
                    className="flex w-full shrink-0 cursor-grab justify-center py-3 touch-none active:cursor-grabbing"
                    onPointerDown={(event) => dragControls.start(event)}
                    aria-hidden="true"
                  >
                    <span className="block h-[3px] w-9 rounded-full bg-ethereal-graphite/15" />
                  </div>
                  {header}
                  <div className="mx-3 h-px shrink-0 bg-ethereal-graphite/10" />
                  {body}
                </motion.div>
              ))}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};
