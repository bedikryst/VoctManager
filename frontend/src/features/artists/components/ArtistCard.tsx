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

import type { Artist } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import {
  Heading,
  Text,
  Caption,
  Eyebrow,
} from "@/shared/ui/primitives/typography";

interface ArtistCardProps {
  artist: Artist;
  onEdit: (artist: Artist) => void;
  onToggleStatus: (id: string, willBeActive: boolean) => void;
}

export const getVoiceColorVariant = (
  voiceType?: string | null,
): "danger" | "amethyst" | "brand" | "success" | "neutral" => {
  if (!voiceType) return "neutral";
  if (voiceType.startsWith("S")) return "danger";
  if (voiceType.startsWith("A") || voiceType === "MEZ") return "amethyst";
  if (voiceType.startsWith("T") || voiceType === "CT") return "brand";
  if (voiceType.startsWith("B")) return "success";
  return "neutral";
};

const renderStars = (
  t: ReturnType<typeof useTranslation>["t"],
  level?: number | null,
) => {
  if (!level) {
    return (
      <Caption color="muted" className="italic font-bold">
        {t("artists.card.unverified", "Brak weryfikacji")}
      </Caption>
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
            star <= level
              ? "text-ethereal-gold fill-ethereal-gold"
              : "text-ethereal-marble"
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
    const voiceVariant = getVoiceColorVariant(artist.voice_type);

    return (
      <GlassCard
        variant={!artist.is_active ? "light" : "solid"}
        className="flex flex-col justify-between h-full "
      >
        <div className="relative z-10 flex-1">
          <div className="flex items-start gap-4 mb-5">
            <div className="relative">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-glass-solid border ${artist.is_active ? "bg-ethereal-alabaster border-ethereal-marble" : "bg-ethereal-marble border-ethereal-incense/20"}`}
              >
                <Text
                  weight="bold"
                  color={artist.is_active ? "default" : "graphite"}
                  className="tracking-widest"
                >
                  {initials}
                </Text>
              </div>
              {artist.user && artist.is_active && (
                <span
                  className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-ethereal-sage border-2 border-ethereal-alabaster rounded-full shadow-sm"
                  title={t(
                    "artists.card.active_account_title",
                    "Konto aktywne i połączone z platformą",
                  )}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Heading as="h3" size="sm" weight="bold" className="truncate">
                {artist.first_name} {artist.last_name}
              </Heading>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant={artist.is_active ? voiceVariant : "neutral"}>
                  {artist.voice_type
                    ? t(`dashboard.layout.roles.${artist.voice_type}`)
                    : artist.voice_type_display || artist.voice_type}
                </Badge>

                {!artist.is_active && (
                  <Badge variant="neutral">
                    {t("artists.card.archive_badge", "Archiwum")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="bg-ethereal-alabaster/80 border border-ethereal-incense/15 rounded-xl p-3.5 mb-5 shadow-glass-ethereal">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-ethereal-incense/10">
              <div className="flex items-center gap-1.5 text-ethereal-graphite">
                <Activity size={10} />
                <Eyebrow color="graphite">
                  {t("artists.card.voice_range", "Skala Głosu")}
                </Eyebrow>
              </div>
              <div className="bg-white border border-ethereal-incense/10 rounded shadow-sm px-2 py-0.5">
                {artist.vocal_range_bottom || artist.vocal_range_top ? (
                  <Caption color="default" weight="bold">
                    {artist.vocal_range_bottom || "?"} –{" "}
                    {artist.vocal_range_top || "?"}
                  </Caption>
                ) : (
                  <Caption color="muted" className="italic">
                    {t("artists.card.none", "Brak")}
                  </Caption>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-ethereal-graphite">
                <Star size={10} />
                <Eyebrow color="graphite">
                  {t("artists.card.sight_reading", "A Vista")}
                </Eyebrow>
              </div>
              {renderStars(t, artist.sight_reading_skill)}
            </div>
          </div>

          <div className="space-y-2.5 mb-6 overflow-hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <Mail
                size={14}
                className="text-ethereal-graphite/60 shrink-0"
                aria-hidden="true"
              />
              <a
                href={`mailto:${artist.email}`}
                className="hover:text-ethereal-ink transition-colors truncate min-w-0 block"
              >
                <Text
                  size="sm"
                  color="graphite"
                  weight="medium"
                  className="truncate"
                >
                  {artist.email}
                </Text>
              </a>
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <Phone
                size={14}
                className="text-ethereal-graphite/60 shrink-0"
                aria-hidden="true"
              />
              {artist.phone_number ? (
                <a
                  href={`tel:${artist.phone_number}`}
                  className="hover:text-ethereal-ink transition-colors truncate min-w-0 block"
                >
                  <Text
                    size="sm"
                    color="graphite"
                    weight="medium"
                    className="truncate"
                  >
                    {artist.phone_number}
                  </Text>
                </a>
              ) : (
                <Text
                  size="sm"
                  color="muted"
                  className="italic font-normal truncate"
                >
                  {t("artists.card.no_phone", "Brak telefonu")}
                </Text>
              )}
            </div>
            {!artist.user && (
              <div className="flex items-center gap-2.5 text-ethereal-crimson mt-1 shrink-0">
                <User size={14} aria-hidden="true" className="shrink-0" />
                <Eyebrow color="crimson" className="truncate">
                  {t("artists.card.inactive_account", "Konto nieaktywne")}
                </Eyebrow>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-ethereal-incense/10 pt-5 relative z-10">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onEdit(artist)}
            leftIcon={<Edit2 size={14} aria-hidden="true" />}
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
            className={`w-full ${
              artist.is_active
                ? "text-ethereal-crimson border-ethereal-crimson/20 hover:bg-ethereal-crimson/5 hover:border-ethereal-crimson/30"
                : "text-ethereal-sage border-ethereal-sage/20 hover:bg-ethereal-sage/5 hover:border-ethereal-sage/30"
            }`}
          >
            {artist.is_active
              ? t("artists.card.archive_action", "Archiwum")
              : t("artists.card.activate_action", "Aktywuj")}
          </Button>
        </div>
      </GlassCard>
    );
  },
  (previousProps, nextProps) =>
    previousProps.artist.id === nextProps.artist.id &&
    previousProps.artist.is_active === nextProps.artist.is_active,
);

ArtistCard.displayName = "ArtistCard";
