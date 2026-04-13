/**
 * @file NotificationItem.tsx
 * @description Renders a single notification row with dynamic icons and styling.
 * Implements Enterprise Deep-Linking to route users directly to the affected entities.
 * Fully strictly typed using Discriminated Unions to prevent metadata access violations.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  Music,
  UserCheck,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Headphones,
  ChevronRight,
} from "lucide-react";

import type { NotificationDTO } from "../types/notifications.dto";
import { useMarkNotificationRead } from "../api/notifications.queries";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";

interface NotificationItemProps {
  notification: NotificationDTO;
  onClosePanel: () => void;
}

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

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClosePanel,
}) => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate: markAsRead } = useMarkNotificationRead();

  const isAdmin = isManager(user);

  const getUiConfig = () => {
    const level = String(notification.level || "INFO").toUpperCase();

    if (level === "URGENT") {
      return {
        icon: AlertTriangle,
        color: "text-red-600",
        bg: "bg-red-50 border-red-200",
        pillClass: "bg-red-100 text-red-700 border-red-200",
        readBg: "bg-white border-red-200/60 hover:bg-red-50/50",
      };
    }
    if (level === "WARNING") {
      return {
        icon: AlertTriangle,
        color: "text-amber-500",
        bg: "bg-amber-50 border-amber-200",
        pillClass: "bg-amber-100 text-amber-700 border-amber-200",
        readBg: "bg-white border-amber-200/60 hover:bg-amber-50/50",
      };
    }

    const infoPill = "bg-brand/10 text-brand border-brand/20";
    const infoReadBg =
      "border-transparent bg-transparent hover:bg-white hover:shadow-sm hover:border-stone-200/60";

    switch (notification.notification_type) {
      case "PROJECT_INVITATION":
        return {
          icon: Briefcase,
          color: "text-blue-600",
          bg: "bg-blue-50 border-blue-100",
          pillClass: infoPill,
          readBg: infoReadBg,
        };
      case "REHEARSAL_SCHEDULED":
      case "REHEARSAL_UPDATED":
        return {
          icon: Calendar,
          color: "text-emerald-600",
          bg: "bg-emerald-50 border-emerald-100",
          pillClass: infoPill,
          readBg: infoReadBg,
        };
      case "MATERIAL_UPLOADED":
        return {
          icon: Headphones,
          color: "text-purple-600",
          bg: "bg-purple-50 border-purple-100",
          pillClass: infoPill,
          readBg: infoReadBg,
        };
      case "PIECE_CASTING_ASSIGNED":
      case "PIECE_CASTING_UPDATED":
        return {
          icon: Music,
          color: "text-indigo-600",
          bg: "bg-indigo-50 border-indigo-100",
          pillClass: infoPill,
          readBg: infoReadBg,
        };
      case "ABSENCE_APPROVED":
        return {
          icon: CheckCircle,
          color: "text-emerald-500",
          bg: "bg-emerald-50 border-emerald-100",
          pillClass: infoPill,
          readBg: infoReadBg,
        };
      case "ABSENCE_REJECTED":
        return {
          icon: XCircle,
          color: "text-rose-500",
          bg: "bg-rose-50 border-rose-100",
          pillClass: infoPill,
          readBg: infoReadBg,
        };
      case "CREW_ASSIGNED":
        return {
          icon: UserCheck,
          color: "text-cyan-600",
          bg: "bg-cyan-50 border-cyan-100",
          pillClass: infoPill,
          readBg: infoReadBg,
        };
      default:
        return {
          icon: Info,
          color: "text-stone-500",
          bg: "bg-stone-50 border-stone-100",
          pillClass: infoPill,
          readBg: infoReadBg,
        };
    }
  };

  const { icon: Icon, color, bg, pillClass, readBg } = getUiConfig();
  const timeAgo = getRelativeTime(notification.created_at, i18n.language);

  const navigateToContext = () => {
    const type = notification.notification_type;

    if (type === "MATERIAL_UPLOADED") {
      return navigate(
        isAdmin ? "/panel/archive-management" : "/panel/materials",
      );
    }

    if (type.includes("REHEARSAL") || type.includes("ABSENCE")) {
      return navigate(isAdmin ? "/panel/rehearsals" : "/panel/schedule");
    }

    if (
      type.includes("PROJECT") ||
      type.includes("CASTING") ||
      type === "CREW_ASSIGNED"
    ) {
      return navigate(
        isAdmin ? "/panel/project-management" : "/panel/schedule",
      );
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

  let projectName: string | undefined;
  let pieceTitle: string | undefined;
  let message: string | undefined;
  let changes: string[] | undefined;

  switch (notification.notification_type) {
    case "PROJECT_INVITATION":
      projectName = notification.metadata.project_name;
      message = notification.metadata.message;
      break;
    case "PROJECT_UPDATED":
      projectName = notification.metadata.project_name;
      message = notification.metadata.message;
      changes = notification.metadata.changes;
      break;
    case "REHEARSAL_SCHEDULED":
      projectName = notification.metadata.project_name;
      break;
    case "REHEARSAL_UPDATED":
      projectName = notification.metadata.project_name;
      changes = notification.metadata.changes;
      break;
    case "REHEARSAL_CANCELLED":
      projectName = notification.metadata.project_name;
      message = notification.metadata.message;
      break;
    case "PIECE_CASTING_ASSIGNED":
    case "PIECE_CASTING_UPDATED":
      pieceTitle = notification.metadata.piece_title;
      message = notification.metadata.message;
      break;
    case "CREW_ASSIGNED":
      projectName = notification.metadata.project_name;
      message = t("notifications.crew_role", {
        defaultValue: "Przypisana rola: {{role}}",
        role: notification.metadata.role,
      });
      break;
    case "ABSENCE_APPROVED":
    case "ABSENCE_REJECTED":
    case "ABSENCE_REQUESTED":
      break;
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative flex cursor-pointer gap-4 rounded-2xl border p-4 transition-all duration-300 ${
        notification.is_read ? readBg : `shadow-sm ${bg} hover:shadow-md`
      }`}
    >
      {!notification.is_read && (
        <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
      )}

      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm transition-transform group-hover:scale-105 ${color}`}
      >
        <Icon size={18} strokeWidth={2.5} />
      </div>

      <div className="flex-1 min-w-0 pr-6">
        <p
          className={`text-xs font-bold uppercase tracking-wide transition-colors ${
            notification.is_read
              ? "text-stone-500 group-hover:text-stone-700"
              : "text-stone-900"
          }`}
        >
          {t(
            `notifications.types.${notification.notification_type}`,
            "Powiadomienie systemowe",
          )}
        </p>

        <div className="mt-1 text-sm text-stone-600 leading-snug">
          {projectName && (
            <span className="font-semibold text-stone-800">{projectName}</span>
          )}
          {pieceTitle && (
            <span className="font-semibold text-stone-800">{pieceTitle}</span>
          )}
          {message && (projectName || pieceTitle ? ` - ${message}` : message)}
        </div>

        {changes && changes.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mr-1">
              {t("notifications.changed", "Zmiany:")}
            </span>
            {changes.map((change, idx) => (
              <span
                key={idx}
                className={`px-1.5 py-0.5 rounded-[4px] border text-[9px] font-bold uppercase tracking-widest shadow-sm ${pillClass}`}
              >
                {change}
              </span>
            ))}
          </div>
        )}

        <p className="mt-2.5 text-[10px] font-medium text-stone-400">
          {timeAgo}
        </p>
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100 text-stone-300">
        <ChevronRight size={18} />
      </div>
    </div>
  );
};
