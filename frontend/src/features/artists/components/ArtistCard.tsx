/**
 * @file ArtistCard.tsx
 * @description Memoized card component for a single artist profile.
 * Presents the most important roster data with dense, scannable UI.
 * @module panel/artists/ArtistCard
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Mail,
  Phone,
  Edit2,
  Trash2,
  CheckCircle2,
  Activity,
  Star,
  User,
} from "lucide-react";

import type { Artist } from "../../../shared/types";
import { GlassCard } from "../../../shared/ui/GlassCard";
import { Button } from "../../../shared/ui/Button";

interface ArtistCardProps {
  artist: Artist;
  onEdit: (artist: Artist) => void;
  onToggleStatus: (id: string, willBeActive: boolean) => void;
}

export const getVoiceColorConfig = (voiceType?: string | null) => {
  if (!voiceType) {
    return {
      bg: "bg-stone-50",
      text: "text-stone-600",
      border: "border-stone-200",
    };
  }
  if (voiceType.startsWith("S")) {
    return {
      bg: "bg-rose-50/80",
      text: "text-rose-700",
      border: "border-rose-200",
    };
  }
  if (voiceType.startsWith("A") || voiceType === "MEZ") {
    return {
      bg: "bg-purple-50/80",
      text: "text-purple-700",
      border: "border-purple-200",
    };
  }
  if (voiceType.startsWith("T") || voiceType === "CT") {
    return {
      bg: "bg-sky-50/80",
      text: "text-sky-700",
      border: "border-sky-200",
    };
  }
  if (voiceType.startsWith("B")) {
    return {
      bg: "bg-emerald-50/80",
      text: "text-emerald-700",
      border: "border-emerald-200",
    };
  }
  return {
    bg: "bg-stone-50",
    text: "text-stone-600",
    border: "border-stone-200",
  };
};

const renderStars = (
  t: ReturnType<typeof useTranslation>["t"],
  level?: number | null,
) => {
  if (!level) {
    return (
      <span className="text-stone-400 italic text-[10px] font-bold">
        {t("artists.card.unverified", "Brak weryfikacji")}
      </span>
    );
  }

  return (
    <div
      className="flex gap-0.5 items-center"
      title={t("artists.card.sight_reading_title", {
        defaultValue: "Czytanie a vista: {{level}}/5",
        level,
      })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={10}
          className={
            star <= level ? "text-amber-400 fill-amber-400" : "text-stone-200"
          }
          aria-hidden="true"
        />
      ))}
    </div>
  );
};

export const ArtistCard = React.memo(
  ({ artist, onEdit, onToggleStatus }: ArtistCardProps) => {
    const { t } = useTranslation();
    const initials =
      `${artist.first_name?.charAt(0) || ""}${artist.last_name?.charAt(0) || ""}`.toUpperCase();
    const voiceColor = getVoiceColorConfig(artist.voice_type);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`transition-all duration-300 group ${!artist.is_active ? "opacity-70 grayscale-[0.5] hover:grayscale-0" : "hover:-translate-y-0.5 hover:shadow-lg"}`}
      >
        <GlassCard
          className={`flex flex-col justify-between h-full ${!artist.is_active ? "bg-stone-50/30" : ""}`}
        >
          <div className="relative z-10 flex-1">
            <div className="flex items-start gap-4 mb-5">
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold tracking-widest text-xs shadow-sm border ${artist.is_active ? "bg-white border-stone-100 text-[#002395]" : "bg-stone-100 border-stone-200 text-stone-400"}`}
                >
                  {initials}
                </div>
                {artist.user && artist.is_active && (
                  <span
                    className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"
                    title={t(
                      "artists.card.active_account_title",
                      "Konto aktywne i połączone z platformą",
                    )}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-stone-900 tracking-tight leading-tight truncate">
                  {artist.first_name} {artist.last_name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span
                    className={`px-2 py-0.5 text-[8px] font-bold antialiased uppercase tracking-widest rounded-md border shadow-sm ${artist.is_active ? `${voiceColor.bg} ${voiceColor.text} ${voiceColor.border}` : "bg-stone-100 text-stone-400 border-stone-200"}`}
                  >
                    {artist.voice_type_display || artist.voice_type}
                  </span>
                  {!artist.is_active && (
                    <span className="px-2 py-0.5 bg-stone-200 text-stone-600 text-[8px] antialiased uppercase tracking-widest font-bold rounded-md border border-stone-300 shadow-sm">
                      {t("artists.card.archive_badge", "Archiwum")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-stone-50/80 border border-stone-200/60 rounded-xl p-3.5 mb-5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-stone-200/60">
                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                  <Activity size={10} />{" "}
                  {t("artists.card.voice_range", "Skala Głosu")}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded bg-white border shadow-sm ${voiceColor.border} ${voiceColor.text}`}
                >
                  {artist.vocal_range_bottom || artist.vocal_range_top ? (
                    `${artist.vocal_range_bottom || "?"} – ${artist.vocal_range_top || "?"}`
                  ) : (
                    <span className="text-stone-400 italic">
                      {t("artists.card.none", "Brak")}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                  <Star size={10} />{" "}
                  {t("artists.card.sight_reading", "A Vista")}
                </span>
                {renderStars(t, artist.sight_reading_skill)}
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-stone-600 mb-6 font-medium">
              <p className="flex items-center gap-2.5">
                <Mail size={14} className="text-stone-400" aria-hidden="true" />
                <a
                  href={`mailto:${artist.email}`}
                  className="hover:text-[#002395] transition-colors truncate"
                >
                  {artist.email}
                </a>
              </p>
              <p className="flex items-center gap-2.5">
                <Phone
                  size={14}
                  className="text-stone-400"
                  aria-hidden="true"
                />
                {artist.phone_number ? (
                  <a
                    href={`tel:${artist.phone_number}`}
                    className="hover:text-[#002395] transition-colors"
                  >
                    {artist.phone_number}
                  </a>
                ) : (
                  <span className="text-stone-400 italic text-[11px] font-normal">
                    {t("artists.card.no_phone", "Brak telefonu")}
                  </span>
                )}
              </p>
              {!artist.user && (
                <p className="flex items-center gap-2.5 text-orange-500/80 mt-1">
                  <User size={14} aria-hidden="true" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">
                    {t("artists.card.inactive_account", "Konto nieaktywne")}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 border-t border-stone-100/50 pt-5 relative z-10">
            <Button
              variant="outline"
              onClick={() => onEdit(artist)}
              leftIcon={<Edit2 size={14} aria-hidden="true" />}
              className="flex-1"
            >
              {t("artists.card.edit", "Edytuj")}
            </Button>

            <Button
              variant="outline"
              onClick={() => onToggleStatus(artist.id, !artist.is_active)}
              leftIcon={
                artist.is_active ? (
                  <Trash2 size={14} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={14} aria-hidden="true" />
                )
              }
              className={`flex-1 ${artist.is_active ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"}`}
            >
              {artist.is_active
                ? t("artists.card.archive_action", "Archiwum")
                : t("artists.card.activate_action", "Aktywuj")}
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    );
  },
  (previousProps, nextProps) =>
    previousProps.artist.id === nextProps.artist.id &&
    previousProps.artist.is_active === nextProps.artist.is_active,
);

ArtistCard.displayName = "ArtistCard";
