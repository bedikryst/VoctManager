/**
 * @file NotificationItem.tsx
 * @description Renders a single notification row with dynamic icons and styling.
 * Implements Enterprise Deep-Linking to route users directly to the affected entities.
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
import { useAuth } from "../../../app/providers/AuthProvider";

interface NotificationItemProps {
  notification: NotificationDTO;
  onClosePanel: () => void;
}

// Zero-dependency native relative time formatter
const getRelativeTime = (dateString: string, lang: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.round((date.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(lang || "en", { numeric: "auto" });

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
  const { user } = useAuth() as any;
  const { mutate: markAsRead } = useMarkNotificationRead();

  const isAdmin = user?.is_admin;

  const getUiConfig = () => {
    if (notification.level === "URGENT") {
      return {
        icon: AlertTriangle,
        color: "text-red-500",
        bg: "bg-red-50 border-red-100",
      };
    }
    if (notification.level === "WARNING") {
      return {
        icon: AlertTriangle,
        color: "text-amber-500",
        bg: "bg-amber-50 border-amber-100",
      };
    }

    switch (notification.notification_type) {
      case "PROJECT_INVITATION":
        return {
          icon: Briefcase,
          color: "text-blue-600",
          bg: "bg-blue-50 border-blue-100",
        };
      case "REHEARSAL_SCHEDULED":
      case "REHEARSAL_UPDATED":
        return {
          icon: Calendar,
          color: "text-emerald-600",
          bg: "bg-emerald-50 border-emerald-100",
        };
      case "MATERIAL_UPLOADED":
        return {
          icon: Headphones,
          color: "text-purple-600",
          bg: "bg-purple-50 border-purple-100",
        };
      case "PIECE_CASTING_ASSIGNED":
        return {
          icon: Music,
          color: "text-indigo-600",
          bg: "bg-indigo-50 border-indigo-100",
        };
      case "ABSENCE_APPROVED":
        return {
          icon: CheckCircle,
          color: "text-emerald-500",
          bg: "bg-emerald-50 border-emerald-100",
        };
      case "ABSENCE_REJECTED":
        return {
          icon: XCircle,
          color: "text-rose-500",
          bg: "bg-rose-50 border-rose-100",
        };
      case "CREW_ASSIGNED":
        return {
          icon: UserCheck,
          color: "text-cyan-600",
          bg: "bg-cyan-50 border-cyan-100",
        };
      default:
        return {
          icon: Info,
          color: "text-stone-500",
          bg: "bg-stone-50 border-stone-100",
        };
    }
  };

  const { icon: Icon, color, bg } = getUiConfig();
  const timeAgo = getRelativeTime(notification.created_at, i18n.language);

  // --- SMART ROUTING LOGIC ---
  const navigateToContext = () => {
    const type = notification.notification_type;

    // Nuty i pliki audio
    if (type === "MATERIAL_UPLOADED") {
      return navigate(
        isAdmin ? "/panel/archive-management" : "/panel/materials",
      );
    }

    // Próby i frekwencja
    if (type.includes("REHEARSAL") || type.includes("ABSENCE")) {
      return navigate(isAdmin ? "/panel/rehearsals" : "/panel/schedule");
    }

    // Projekty, umowy i obsady
    if (
      type.includes("PROJECT") ||
      type.includes("CASTING") ||
      type === "CREW_ASSIGNED"
    ) {
      return navigate(
        isAdmin ? "/panel/project-management" : "/panel/schedule",
      );
    }

    // Fallback dla systemu
    return navigate("/panel");
  };

  const handleClick = () => {
    // 1. Oznacz jako przeczytane, jeśli jeszcze nie jest
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    // 2. Przenieś użytkownika do odpowiedniego widoku
    navigateToContext();

    // 3. Zamknij szufladę
    onClosePanel();
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative flex cursor-pointer gap-4 rounded-2xl border p-4 transition-all duration-300 ${
        notification.is_read
          ? "border-transparent bg-transparent hover:bg-white hover:shadow-sm hover:border-stone-200/60"
          : `shadow-sm ${bg} hover:shadow-md`
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
        {" "}
        {/* Zwiększony prawy padding, żeby nie nachodziło na kropkę/strzałkę */}
        <p
          className={`text-xs font-bold uppercase tracking-wide transition-colors ${notification.is_read ? "text-stone-500 group-hover:text-stone-700" : "text-stone-900"}`}
        >
          {t(
            `notifications.types.${notification.notification_type}`,
            notification.notification_type.replace(/_/g, " "),
          )}
        </p>
        {/* USUNIĘTO line-clamp-2 - tekst będzie naturalnie zwijał się do nowych linijek */}
        <div className="mt-1 text-sm text-stone-600 leading-snug">
          {notification.metadata.project_name && (
            <span className="font-semibold text-stone-800">
              {notification.metadata.project_name}
            </span>
          )}
          {notification.metadata.piece_title &&
            ` - ${notification.metadata.piece_title}`}
          {notification.metadata.message &&
            ` - ${notification.metadata.message}`}
        </div>
        <p className="mt-2 text-[10px] font-medium text-stone-400">{timeAgo}</p>
      </div>

      {/* Subtelna strzałka pokazująca się po najechaniu (hover) wskazująca, że to jest link */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100 text-stone-300">
        <ChevronRight size={18} />
      </div>
    </div>
  );
};
