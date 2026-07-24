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
  type LucideIcon,
} from "lucide-react";

import type { EventMomentMetadata, NotificationDTO } from "../types/notifications.dto";
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

/**
 * Localized label for a VoiceLine CODE (e.g. "B1" → "Bas 1"), rendered in the
 * viewer's current UI language. Falls back to the raw value so a legacy row that
 * still carries a pre-rendered label ("Bass 1") — or an unknown code — never
 * renders blank.
 */
const voiceLineLabel = (t: TFunc, code?: string): string =>
  code ? t(`notifications.voiceLines.${code}`, code) : "";

/** Localized label for a material kind ("score" | "recording"). Unknown/blank
 *  kinds yield no pill. */
const materialKindLabel = (t: TFunc, kind?: string): string =>
  kind === "score" || kind === "recording"
    ? t(`notifications.materialKinds.${kind}`)
    : "";

/**
 * Renders one change entry as a compact localized chip label. Tolerant of loose
 * or legacy metadata shapes — a change persisted before the structured-codes
 * refactor may arrive as a plain string, or as an object without a stable
 * `field` key. We never assume the shape, so a single stale row can't blank the
 * whole panel (the `field.replace` it used to crash on is now guarded).
 */
const renderChange = (t: TFunc, change: unknown): string => {
  if (typeof change === "string") return change;
  if (!change || typeof change !== "object") return "";

  const { field, old, new: next } = change as {
    field?: unknown;
    old?: unknown;
    new?: unknown;
  };
  const fieldKey = typeof field === "string" ? field : "";
  const label = fieldKey ? changeLabel(t, fieldKey) : "";
  // The voice line arrives as a language-neutral code — localize its values too,
  // not just the field label.
  const value = (raw: unknown): string =>
    raw == null ? "" : fieldKey === "voice_line" ? voiceLineLabel(t, String(raw)) : String(raw);
  const from = value(old);
  const to = value(next);

  if (from && to) return label ? `${label}: ${from} → ${to}` : `${from} → ${to}`;
  if (to) return label ? `${label}: ${to}` : to;
  return label;
};

/** Maps a (possibly legacy/loose) `changes` payload to chip labels, dropping
 *  any entry that can't be rendered. Never assumes an array of structured objects. */
const renderChanges = (t: TFunc, changes: unknown): string[] =>
  Array.isArray(changes)
    ? changes.map((change) => renderChange(t, change)).filter(Boolean)
    : [];

/** Verb phrase for a roster status code (attendance or RSVP). */
const statusPhrase = (
  t: TFunc,
  kind: "attendance" | "participation",
  code?: string,
): string => (code ? t(`notifications.status.${kind}.${code}`, code) : "");

const compactMetaLine = (...values: readonly unknown[]): string | undefined => {
  const parts = values
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
};

const firstText = (...values: readonly unknown[]): string | undefined =>
  values
    .map((value) => (value == null ? "" : String(value).trim()))
    .find(Boolean);

/**
 * Renders an event moment the way a person says it — "jutro o 19:00", "piątek,
 * 24 lipca o 19:00" — in the viewer's UI language and the event's own timezone.
 * Mirrors the backend `humanize_event_time()` so the bell, the push and the
 * email name the same moment the same way.
 *
 * The ISO timestamp outranks the stored `starts_at_display`, which is frozen at
 * emission time in whatever language was then active. Relative wording is
 * resolved against "now" on every render, so an old row never claims "tomorrow".
 */
const formatEventMoment = (
  metadata: EventMomentMetadata,
  lang: string,
  t: TFunc,
  ...legacyValues: readonly unknown[]
): string | undefined => {
  const startsAt = firstText(metadata.starts_at);
  const parsed = startsAt?.includes("T") ? new Date(startsAt) : null;

  if (parsed && !Number.isNaN(parsed.getTime())) {
    const locale = lang || "pl";
    const timeZone = firstText(metadata.timezone);
    const render = (options: Intl.DateTimeFormatOptions): string => {
      try {
        return new Intl.DateTimeFormat(
          locale,
          timeZone ? { ...options, timeZone } : options,
        ).format(parsed);
      } catch {
        // An unknown IANA zone must not blank the row — fall back to the viewer's.
        return new Intl.DateTimeFormat(locale, options).format(parsed);
      }
    };
    // The calendar-day comparison has to happen in the event's own timezone;
    // en-CA yields an ISO-shaped YYYY-MM-DD that subtracts cleanly.
    const dayKey = (value: Date): string => {
      try {
        return new Intl.DateTimeFormat("en-CA", timeZone ? { timeZone } : {}).format(value);
      } catch {
        return new Intl.DateTimeFormat("en-CA").format(value);
      }
    };

    const time = render({ hour: "2-digit", minute: "2-digit", hour12: false });
    const eventDay = dayKey(parsed);
    const today = dayKey(new Date());
    const daysAway = Math.round(
      (Date.parse(eventDay) - Date.parse(today)) / 86_400_000,
    );

    if (daysAway === 0) return t("notifications.time.today", { time });
    if (daysAway === 1) return t("notifications.time.tomorrow", { time });

    const sameYear = eventDay.slice(0, 4) === today.slice(0, 4);
    return t("notifications.time.absolute", {
      weekday: render({ weekday: "long" }),
      date: render(
        sameYear
          ? { day: "numeric", month: "long" }
          : { day: "numeric", month: "long", year: "numeric" },
      ),
      time,
    });
  }

  return firstText(metadata.starts_at_display, startsAt, ...legacyValues);
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

  const { title, pill, context, detail, changeChips } = describe(notification, t, i18n.language);
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
