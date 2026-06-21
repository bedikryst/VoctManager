/**
 * @file NotificationItem.tsx
 * @description A single notification row in the Ethereal language. Accent is
 * driven by type (gold=project, sage=schedule/positive, amethyst=content,
 * incense=message) and escalated to crimson only for genuine alarms
 * (URGENT level, cancellations, rejections) — crimson stays alarm-only.
 * @module features/notifications/components
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  Music,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Headphones,
  ChevronRight,
  ClipboardCheck,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

import type { FieldChange, NotificationDTO } from "../types/notifications.dto";
import { useMarkNotificationRead } from "../api/notifications.queries";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";
import { cn } from "@/shared/lib/utils";

type TFunc = ReturnType<typeof useTranslation>["t"];

interface NotificationItemProps {
  notification: NotificationDTO;
  onClosePanel: () => void;
}

/** Localized human label for a structured change field key. */
const changeLabel = (t: TFunc, fieldKey: string): string =>
  t(`notifications.changes.${fieldKey}`, fieldKey.replace(/_/g, " "));

/** A structured change rendered as a compact localized chip label. */
const renderChange = (t: TFunc, change: FieldChange): string => {
  const label = changeLabel(t, change.field);
  if (change.old && change.new) return `${label}: ${change.old} → ${change.new}`;
  if (change.new) return `${label}: ${change.new}`;
  return label;
};

/** Verb phrase for a roster status code (attendance or RSVP). */
const statusPhrase = (
  t: TFunc,
  kind: "attendance" | "participation",
  code?: string,
): string => (code ? t(`notifications.status.${kind}.${code}`, code) : "");

/**
 * Composes the in-app row's display parts from STRUCTURED metadata, localized to
 * the viewer's current UI language. Mirrors the backend message_content composer
 * so the bell, push and email all read consistently — without ever surfacing the
 * language-neutral codes stored on the row.
 */
const describe = (
  notification: NotificationDTO,
  t: TFunc,
): {
  headline?: string;
  subLabel?: string;
  detail?: string;
  changeChips?: string[];
} => {
  switch (notification.notification_type) {
    case "PROJECT_INVITATION":
      return { headline: notification.metadata.project_name };
    case "PROJECT_UPDATED":
      if (notification.metadata.event === "removed") {
        return {
          headline: notification.metadata.project_name,
          detail: t("notifications.inapp.project_removed"),
        };
      }
      return {
        headline: notification.metadata.project_name,
        changeChips: (notification.metadata.changes ?? []).map((c) => renderChange(t, c)),
      };
    case "PROJECT_CANCELLED":
      return {
        headline: notification.metadata.project_name as string | undefined,
        detail: t("notifications.inapp.project_cancelled"),
      };
    case "REHEARSAL_SCHEDULED":
      return { headline: notification.metadata.project_name };
    case "REHEARSAL_UPDATED":
      return {
        headline: notification.metadata.project_name,
        changeChips: (notification.metadata.changes ?? []).map((c) => renderChange(t, c)),
      };
    case "REHEARSAL_CANCELLED":
      return {
        headline: notification.metadata.project_name,
        detail: t("notifications.inapp.rehearsal_cancelled"),
      };
    case "REHEARSAL_REMINDER":
      return { headline: notification.metadata.project_name as string | undefined };
    case "PIECE_CASTING_ASSIGNED":
      return {
        headline: notification.metadata.piece_title,
        subLabel: notification.metadata.voice_line,
      };
    case "PIECE_CASTING_UPDATED":
      if (notification.metadata.event === "removed") {
        return {
          headline: notification.metadata.piece_title,
          detail: t("notifications.inapp.casting_removed"),
        };
      }
      return {
        headline: notification.metadata.piece_title,
        changeChips: (notification.metadata.changes ?? []).map((c) => renderChange(t, c)),
      };
    case "MATERIAL_UPLOADED":
      return { headline: notification.metadata.piece_title };
    case "ABSENCE_APPROVED":
      return {
        headline: notification.metadata.project_name,
        subLabel: notification.metadata.rehearsal_date,
        detail: t("notifications.inapp.absence_approved"),
      };
    case "ABSENCE_REJECTED":
      return {
        headline: notification.metadata.project_name,
        subLabel: notification.metadata.rehearsal_date,
        detail: t("notifications.inapp.absence_rejected"),
      };
    case "ABSENCE_REQUESTED":
      return {
        headline: notification.metadata.artist_name,
        subLabel: notification.metadata.project_name,
        detail: t("notifications.inapp.absence_requested"),
      };
    case "PARTICIPATION_RESPONSE":
      return {
        headline: notification.metadata.artist_name,
        subLabel: notification.metadata.project_name,
        detail: statusPhrase(t, "participation", notification.metadata.status),
      };
    case "ATTENDANCE_SUBMITTED":
      return {
        headline: notification.metadata.artist_name,
        subLabel: notification.metadata.project_name,
        detail: statusPhrase(t, "attendance", notification.metadata.status),
      };
    case "MESSAGE_RECEIVED":
      // Subject + snippet are user-authored content — passed through verbatim.
      return {
        headline: notification.metadata.title,
        subLabel: notification.metadata.sender_name,
        detail: notification.metadata.snippet,
      };
    case "CUSTOM_ADMIN_MESSAGE":
      return {
        headline: notification.metadata.title,
        detail: notification.metadata.message,
      };
    case "NOTIFICATION_READ_RECEIPT":
      return {
        headline: notification.metadata.artist_name,
        subLabel: notification.metadata.original_title,
        detail: t("notifications.inapp.read_receipt"),
      };
    case "CONTRACT_ISSUED":
      return { headline: notification.metadata.project_name as string | undefined };
    case "SYSTEM_ALERT":
      return {
        headline: notification.metadata.title as string | undefined,
        detail: notification.metadata.message as string | undefined,
      };
    default:
      return {};
  }
};

type Accent = "gold" | "sage" | "amethyst" | "incense" | "crimson" | "neutral";

const ACCENT: Record<Accent, { tile: string; dot: string }> = {
  gold: { tile: "bg-ethereal-gold/12 text-ethereal-gold", dot: "bg-ethereal-gold" },
  sage: { tile: "bg-ethereal-sage/15 text-ethereal-sage", dot: "bg-ethereal-sage" },
  amethyst: {
    tile: "bg-ethereal-amethyst/15 text-ethereal-amethyst",
    dot: "bg-ethereal-amethyst",
  },
  incense: {
    tile: "bg-ethereal-incense/15 text-ethereal-incense",
    dot: "bg-ethereal-incense",
  },
  crimson: {
    tile: "bg-ethereal-crimson/12 text-ethereal-crimson",
    dot: "bg-ethereal-crimson",
  },
  neutral: {
    tile: "bg-ethereal-graphite/10 text-ethereal-graphite/70",
    dot: "bg-ethereal-graphite/45",
  },
};

const getRelativeTime = (dateString: string, lang: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.round((date.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(lang || "pl", { numeric: "auto" });

  const absDiff = Math.abs(diffInSeconds);
  if (absDiff < 60) return rtf.format(Math.round(diffInSeconds), "second");
  if (absDiff < 3600)
    return rtf.format(Math.round(diffInSeconds / 60), "minute");
  if (absDiff < 86400)
    return rtf.format(Math.round(diffInSeconds / 3600), "hour");
  if (absDiff < 2592000)
    return rtf.format(Math.round(diffInSeconds / 86400), "day");
  if (absDiff < 31536000)
    return rtf.format(Math.round(diffInSeconds / 2592000), "month");

  return rtf.format(Math.round(diffInSeconds / 31536000), "year");
};

const resolveVisual = (
  notification: NotificationDTO,
): { icon: LucideIcon; accent: Accent } => {
  if (String(notification.level || "INFO").toUpperCase() === "URGENT") {
    return { icon: AlertTriangle, accent: "crimson" };
  }

  switch (notification.notification_type) {
    case "PROJECT_INVITATION":
    case "PROJECT_UPDATED":
    case "PROJECT_REMINDER":
    case "PARTICIPATION_RESPONSE":
      return { icon: Briefcase, accent: "gold" };
    case "PROJECT_CANCELLED":
      return { icon: Briefcase, accent: "crimson" };
    case "REHEARSAL_SCHEDULED":
    case "REHEARSAL_UPDATED":
    case "REHEARSAL_REMINDER":
      return { icon: Calendar, accent: "sage" };
    case "REHEARSAL_CANCELLED":
      return { icon: Calendar, accent: "crimson" };
    case "MATERIAL_UPLOADED":
      return { icon: Headphones, accent: "amethyst" };
    case "PIECE_CASTING_ASSIGNED":
    case "PIECE_CASTING_UPDATED":
      return { icon: Music, accent: "amethyst" };
    case "ABSENCE_APPROVED":
      return { icon: CheckCircle, accent: "sage" };
    case "ABSENCE_REJECTED":
      return { icon: XCircle, accent: "crimson" };
    case "ATTENDANCE_SUBMITTED":
      return { icon: ClipboardCheck, accent: "sage" };
    case "MESSAGE_RECEIVED":
      return { icon: MessageCircle, accent: "incense" };
    case "NOTIFICATION_READ_RECEIPT":
      return { icon: CheckCircle, accent: "sage" };
    case "CONTRACT_ISSUED":
      return { icon: Briefcase, accent: "gold" };
    case "SYSTEM_ALERT":
      return { icon: AlertTriangle, accent: "neutral" };
    default:
      return { icon: Info, accent: "neutral" };
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClosePanel,
}) => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate: markAsRead } = useMarkNotificationRead();

  const isAdmin = isManager(user);
  const isRead = notification.is_read;

  const { icon: Icon, accent } = resolveVisual(notification);
  const accentStyle = ACCENT[accent];
  const timeAgo = getRelativeTime(notification.created_at, i18n.language);

  const navigateToContext = () => {
    const type = notification.notification_type;

    if (notification.notification_type === "MESSAGE_RECEIVED") {
      return navigate(`/panel/messages/${notification.metadata.thread_id}`);
    }
    if (type === "MATERIAL_UPLOADED") {
      return navigate(isAdmin ? "/panel/archive-management" : "/panel/materials");
    }
    if (type === "ATTENDANCE_SUBMITTED") {
      return navigate(isAdmin ? "/panel/rehearsals" : "/panel/schedule");
    }
    if (type === "PARTICIPATION_RESPONSE") {
      return navigate(isAdmin ? "/panel/projects" : "/panel/schedule");
    }
    if (type.includes("REHEARSAL") || type.includes("ABSENCE")) {
      return navigate(isAdmin ? "/panel/rehearsals" : "/panel/schedule");
    }
    if (type.includes("PROJECT") || type.includes("CASTING")) {
      return navigate(isAdmin ? "/panel/projects" : "/panel/schedule");
    }
    return navigate("/panel");
  };

  const handleClick = () => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    navigateToContext();
    onClosePanel();
  };

  const { headline, subLabel, detail, changeChips } = describe(notification, t);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer gap-3 rounded-2xl p-3 pr-8 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
        isRead
          ? "hover:bg-ethereal-ink/[0.035]"
          : "bg-ethereal-ink/[0.03] hover:bg-ethereal-ink/[0.055]",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-[1.03]",
          accentStyle.tile,
        )}
      >
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-sans text-[10px] font-semibold uppercase tracking-[0.14em]",
            isRead ? "text-ethereal-graphite/55" : "text-ethereal-graphite/80",
          )}
        >
          {t(
            `notifications.types.${notification.notification_type}`,
            "Powiadomienie systemowe",
          )}
        </p>

        <div className="mt-1 text-sm leading-snug text-ethereal-graphite/80">
          {headline && (
            <span className="font-semibold text-ethereal-ink">{headline}</span>
          )}
          {subLabel && <span className="text-ethereal-graphite/55"> · {subLabel}</span>}
          {detail && (headline ? ` — ${detail}` : detail)}
        </div>

        {changeChips && changeChips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {changeChips.map((change, index) => (
              <span
                key={index}
                className="rounded-md border border-ethereal-graphite/15 bg-ethereal-graphite/[0.05] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ethereal-graphite/65"
              >
                {change}
              </span>
            ))}
          </div>
        )}

        <p className="mt-2 text-[11px] font-medium text-ethereal-graphite/45">
          {timeAgo}
        </p>
      </div>

      {!isRead && (
        <span
          className={cn(
            "absolute right-3 top-3.5 h-2 w-2 rounded-full",
            accentStyle.dot,
          )}
          aria-hidden="true"
        />
      )}

      <ChevronRight
        size={16}
        strokeWidth={2}
        aria-hidden="true"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ethereal-graphite/25 opacity-0 transition-[transform,opacity] duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
      />
    </div>
  );
};
