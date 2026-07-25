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
  ClipboardCheck,
  MessageCircle,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

import type {
  BriefingItemMetadata,
  NotificationDTO,
} from "../types/notifications.dto";
import { useMarkNotificationRead } from "../api/notifications.queries";
import {
  briefingItemSummary,
  compactMetaLine,
  formatEventMoment,
  renderChanges,
  voiceLineLabel,
  type TFunc,
} from "../lib/notificationFormat";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";
import { cn } from "@/shared/lib/utils";

interface NotificationItemProps {
  notification: NotificationDTO;
  onClosePanel: () => void;
}

/** Localized label for a material kind ("score" | "recording"). Unknown/blank
 *  kinds yield no pill. */
const materialKindLabel = (t: TFunc, kind?: string): string =>
  kind === "score" || kind === "recording"
    ? t(`notifications.materialKinds.${kind}`)
    : "";

/** Verb phrase for a roster status code (attendance or RSVP). */
const statusPhrase = (
  t: TFunc,
  kind: "attendance" | "participation",
  code?: string,
): string => (code ? t(`notifications.status.${kind}.${code}`, code) : "");

/** How many briefing items the bell row lists before the rest becomes a count.
 *  The full account is in the email; this row exists to be scanned. */
const BRIEFING_BULLET_LIMIT = 5;

/** The briefing's items as bullet lines, capped so one busy publication can't
 *  turn a bell row into a page. */
const briefingBullets = (
  t: TFunc,
  lang: string,
  items: readonly BriefingItemMetadata[],
): string[] => {
  const lines = items
    .map((item) => briefingItemSummary(t, lang, item))
    .filter(Boolean);
  if (lines.length <= BRIEFING_BULLET_LIMIT) return lines;
  return [
    ...lines.slice(0, BRIEFING_BULLET_LIMIT),
    t("notifications.briefing.more", {
      count: lines.length - BRIEFING_BULLET_LIMIT,
    }),
  ];
};

interface RowContent {
  /** Line 1 — the subject (bold, ink). */
  title?: string;
  /** An accent pill rendered beside the title (e.g. the voice part). */
  pill?: string;
  /** Line 2 — muted secondary context (concert · date · venue, sender…). */
  context?: string;
  /** Line 3 — tertiary detail (focus, snippet, status phrase, removed copy). */
  detail?: string;
  /** Structured field-change chips. */
  changeChips?: string[];
  /** A briefing's items, one scannable line each. */
  bullets?: string[];
}

/**
 * Composes the in-app row's display parts from STRUCTURED metadata, localized to
 * the viewer's current UI language. Mirrors the backend message_content composer
 * so the bell, push and email all read consistently — without ever surfacing the
 * language-neutral codes stored on the row.
 */
const describe = (
  notification: NotificationDTO,
  t: TFunc,
  lang: string,
): RowContent => {
  switch (notification.notification_type) {
    case "PROJECT_INVITATION":
      // Who is asking is half of what an invitation means, and the push and the
      // email both say it — the bell was the only surface that dropped it.
      return {
        title: notification.metadata.project_name,
        context: compactMetaLine(
          formatEventMoment(notification.metadata, lang, t, notification.metadata.date_range),
          notification.metadata.location,
        ),
        detail: notification.metadata.inviter_name
          ? t("notifications.inapp.invited_by", {
              name: notification.metadata.inviter_name,
            })
          : undefined,
      };
    case "PROJECT_UPDATED":
      if (notification.metadata.event === "removed") {
        return {
          title: notification.metadata.project_name,
          detail: t("notifications.inapp.project_removed"),
        };
      }
      return {
        title: notification.metadata.project_name,
        changeChips: renderChanges(t, notification.metadata.changes),
      };
    case "PROJECT_BRIEFING": {
      // Everything one singer has not been told about one project. The row lists
      // the items rather than counting them: "3 changes" tells nobody whether one
      // of them is their own part.
      const items = notification.metadata.items ?? [];
      return {
        title: notification.metadata.project_name,
        context: t("notifications.briefing.count", { count: items.length }),
        // The conductor's own words, if they wrote any — authored text, verbatim.
        detail: notification.metadata.note || undefined,
        bullets: briefingBullets(t, lang, items),
      };
    }
    case "PROJECT_CANCELLED":
      // The type eyebrow already reads "Project cancelled" — don't echo it in the
      // body. The project name under that eyebrow is unambiguous on its own.
      return { title: notification.metadata.project_name as string | undefined };
    case "REHEARSAL_SCHEDULED":
      return {
        title: notification.metadata.project_name,
        context: compactMetaLine(
          formatEventMoment(notification.metadata, lang, t),
          notification.metadata.location,
        ),
        detail: notification.metadata.focus || undefined,
      };
    case "REHEARSAL_UPDATED":
      return {
        title: notification.metadata.project_name,
        context: compactMetaLine(
          formatEventMoment(notification.metadata, lang, t),
          notification.metadata.location,
        ),
        detail: notification.metadata.focus || undefined,
        changeChips: renderChanges(t, notification.metadata.changes),
      };
    case "REHEARSAL_CANCELLED":
      // "Rehearsal cancelled" is already the eyebrow — show only the project.
      return {
        title: notification.metadata.project_name,
        context: compactMetaLine(
          formatEventMoment(notification.metadata, lang, t),
          notification.metadata.location,
        ),
        detail: notification.metadata.focus || undefined,
      };
    case "REHEARSAL_REMINDER":
      return {
        title: notification.metadata.project_name as string | undefined,
        context: compactMetaLine(
          formatEventMoment(notification.metadata, lang, t, notification.metadata.rehearsal_date),
          notification.metadata.location,
        ),
        detail: notification.metadata.focus || undefined,
      };
    case "PROJECT_REMINDER":
      return {
        title: notification.metadata.project_name as string | undefined,
        context: compactMetaLine(
          formatEventMoment(notification.metadata, lang, t, notification.metadata.date_range),
          notification.metadata.location,
        ),
      };
    case "PIECE_CASTING_ASSIGNED":
      // The premium casting row: the piece as the title, the voice part as an
      // accent pill, and the concert (name · date) as the muted context line so
      // the singer sees exactly which programme this part is for.
      return {
        title: notification.metadata.piece_title,
        pill: voiceLineLabel(t, notification.metadata.voice_line),
        context: compactMetaLine(
          notification.metadata.project_name,
          formatEventMoment(notification.metadata, lang, t),
        ),
      };
    case "PIECE_CASTING_UPDATED":
      if (notification.metadata.event === "removed") {
        return {
          title: notification.metadata.piece_title,
          context: notification.metadata.project_name,
          detail: t("notifications.inapp.casting_removed"),
        };
      }
      return {
        title: notification.metadata.piece_title,
        pill: voiceLineLabel(t, notification.metadata.voice_line),
        context: notification.metadata.project_name,
        changeChips: renderChanges(t, notification.metadata.changes),
      };
    case "MATERIAL_UPLOADED":
      // Piece-scoped (fans out across every concert programming it), so there's no
      // single project — the kind (score/recording) is the pill, the composer the
      // context.
      return {
        title: notification.metadata.piece_title,
        pill: materialKindLabel(t, notification.metadata.material_kind),
        context: notification.metadata.composer_name || undefined,
      };
    case "ABSENCE_APPROVED":
      return {
        title: notification.metadata.project_name,
        context: formatEventMoment(
          notification.metadata, lang, t, notification.metadata.rehearsal_date,
        ),
        detail: t("notifications.inapp.absence_approved"),
      };
    case "ABSENCE_REJECTED":
      // Eyebrow carries "Absence not approved"; the project + rehearsal date say
      // which one. Echoing "not approved" in the body added nothing.
      return {
        title: notification.metadata.project_name,
        context: formatEventMoment(
          notification.metadata, lang, t, notification.metadata.rehearsal_date,
        ),
      };
    case "ABSENCE_REQUESTED":
      return {
        title: notification.metadata.artist_name,
        context: compactMetaLine(
          notification.metadata.project_name,
          formatEventMoment(
            notification.metadata, lang, t, notification.metadata.rehearsal_date,
          ),
        ),
        detail: t("notifications.inapp.absence_requested"),
      };
    case "PARTICIPATION_RESPONSE":
      return {
        title: notification.metadata.artist_name,
        context: notification.metadata.project_name,
        detail: statusPhrase(t, "participation", notification.metadata.status),
      };
    case "ATTENDANCE_SUBMITTED":
      // Which rehearsal matters here: a manager triaging the bell needs to know
      // whether this absence lands tonight or in three weeks.
      return {
        title: notification.metadata.artist_name,
        context: compactMetaLine(
          notification.metadata.project_name,
          formatEventMoment(
            notification.metadata, lang, t, notification.metadata.rehearsal_date,
          ),
        ),
        detail: statusPhrase(t, "attendance", notification.metadata.status),
      };
    case "ANNOUNCEMENT_PENDING": {
      // The queue's safety net. The project is the title because it is what the
      // manager has to act on; the counts sit under it as the reason to bother.
      const waiting = notification.metadata.waiting_hours ?? 0;
      return {
        title: notification.metadata.project_name,
        context: compactMetaLine(
          t("notifications.inapp.announcement_pending_changes", {
            count: notification.metadata.change_count ?? 0,
          }),
          waiting >= 48
            ? t("notifications.inapp.announcement_pending_days", {
                count: Math.floor(waiting / 24),
              })
            : t("notifications.inapp.announcement_pending_hours", {
                count: Math.max(waiting, 1),
              }),
        ),
        detail: notification.metadata.recipient_count
          ? t("notifications.inapp.announcement_pending_unaware", {
              count: notification.metadata.recipient_count,
            })
          : undefined,
      };
    }
    case "MESSAGE_RECEIVED":
      // Subject + snippet are user-authored content — passed through verbatim.
      return {
        title: notification.metadata.title,
        context: notification.metadata.sender_name,
        detail: notification.metadata.snippet,
      };
    case "CHANNEL_MESSAGE":
      return {
        title: notification.metadata.project_name,
        context: notification.metadata.sender_name,
        detail: notification.metadata.snippet || undefined,
      };
    case "CUSTOM_ADMIN_MESSAGE":
      return {
        title: notification.metadata.title,
        detail: notification.metadata.message,
      };
    case "NOTIFICATION_READ_RECEIPT":
      return {
        title: notification.metadata.artist_name,
        context: notification.metadata.original_title,
        detail: t("notifications.inapp.read_receipt"),
      };
    case "CONTRACT_ISSUED":
      // The eyebrow says "Contract"; only the row can say it needs signing.
      return {
        title: notification.metadata.project_name as string | undefined,
        detail: t("notifications.inapp.contract_issued"),
      };
    case "SYSTEM_ALERT":
      return {
        title: notification.metadata.title as string | undefined,
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

/** Full, localized date+time — surfaced on hover/long-press so the relative
 *  label ("2 days ago") never costs the reader the actual moment. */
const getAbsoluteTime = (dateString: string, lang: string): string => {
  try {
    return new Intl.DateTimeFormat(lang || "pl", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(dateString));
  } catch {
    return "";
  }
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
    case "PROJECT_BRIEFING":
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
    case "ANNOUNCEMENT_PENDING":
      // Gold, not crimson: a queue waiting to be sent is a decision the conductor
      // has not made yet, not a fault. A queue holding a reschedule arrives at
      // URGENT and is escalated to crimson above, by level rather than by type.
      return { icon: Megaphone, accent: "gold" };
    case "MESSAGE_RECEIVED":
    case "CHANNEL_MESSAGE":
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
  const absoluteTime = getAbsoluteTime(notification.created_at, i18n.language);
  // Genuine alarms (cancellations, rejections, URGENT) resolve to crimson — give
  // those rows a left accent so they're triaged at a glance, not just by icon hue.
  const isAlarm = accent === "crimson";

  const navigateToContext = () => {
    const type = notification.notification_type;

    if (notification.notification_type === "MESSAGE_RECEIVED") {
      const threadId = notification.metadata.thread_id;
      return navigate(threadId ? `/panel/messages/${threadId}` : "/panel/messages");
    }
    if (notification.notification_type === "CHANNEL_MESSAGE") {
      const channelId = notification.metadata.channel_id;
      return navigate(channelId ? `/panel/messages/channel/${channelId}` : "/panel/messages");
    }
    if (notification.notification_type === "ANNOUNCEMENT_PENDING") {
      // Straight to the review sheet, not to the project: a nudge that lands the
      // reader somewhere they still have to go looking is the same silence with
      // extra steps. `?announce=1` is the hub's contract for opening it.
      const projectId = notification.metadata.project_id;
      return navigate(
        projectId ? `/panel/projects/${projectId}?announce=1` : "/panel/projects",
      );
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

  const { title, pill, context, detail, changeChips, bullets } = describe(
    notification, t, i18n.language,
  );
  // The fallback covers a type the client doesn't know yet (a backend deploy
  // ahead of the app); it has to be localized like everything else.
  const typeLabel = t(`notifications.types.${notification.notification_type}`, {
    defaultValue: t("notifications.types.fallback"),
  });

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
        "group relative flex cursor-pointer gap-3 rounded-2xl p-3 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
        isRead
          ? "hover:bg-ethereal-ink/[0.035]"
          : "bg-ethereal-ink/[0.03] hover:bg-ethereal-ink/[0.055]",
      )}
    >
      {isAlarm && (
        <span
          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-ethereal-crimson/70"
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-[1.03]",
          accentStyle.tile,
        )}
      >
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Kicker + timestamp on one baseline — the unread state reads as an inline
            accent dot rather than a floating corner dot. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {!isRead && (
              <span
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accentStyle.dot)}
                aria-hidden="true"
              />
            )}
            <p
              className={cn(
                "truncate font-sans text-[10px] font-semibold uppercase tracking-[0.14em]",
                isRead ? "text-ethereal-graphite/55" : "text-ethereal-graphite/85",
              )}
            >
              {typeLabel}
            </p>
          </div>
          <time
            dateTime={notification.created_at}
            title={absoluteTime}
            className="shrink-0 text-[10.5px] font-medium text-ethereal-graphite/45"
          >
            {timeAgo}
          </time>
        </div>

        {title && (
          <div className="mt-1.5 flex items-start justify-between gap-2">
            <span className="min-w-0 text-[13.5px] font-semibold leading-snug text-ethereal-ink">
              {title}
            </span>
            {pill && (
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  accentStyle.tile,
                )}
              >
                {pill}
              </span>
            )}
          </div>
        )}

        {context && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ethereal-graphite/60">
            {context}
          </p>
        )}

        {detail && (
          <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-ethereal-graphite/75">
            {detail}
          </p>
        )}

        {bullets && bullets.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {bullets.map((line, index) => (
              <li
                key={index}
                className="flex gap-1.5 text-[12px] leading-snug text-ethereal-graphite/70"
              >
                <span
                  className="mt-1.75 h-1 w-1 shrink-0 rounded-full bg-ethereal-gold/60"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">{line}</span>
              </li>
            ))}
          </ul>
        )}

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
      </div>
    </div>
  );
};
