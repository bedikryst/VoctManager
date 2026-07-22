/**
 * @file ArtistCard.tsx
 * @description Roster card for grid view. Click opens the artist dossier
 * (track record); inline quick actions — message, archive/restore — stop
 * propagation. In selection mode the whole card becomes a multi-select toggle
 * (checkbox + gold ring) and the inline actions step aside.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/ArtistCard
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Mail,
  MailWarning,
  MessageSquare,
  Music2,
  Phone,
  Send,
  Trash2,
  UserX,
} from "lucide-react";

import type { Artist } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { Badge } from "@/shared/ui/primitives/Badge";
import {
  Caption,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";
import { getSectionPresentation } from "../constants/voiceSections";
import { SightReadingStars } from "./SightReadingStars";

interface ArtistCardProps {
  artist: Artist;
  onOpen: (artist: Artist) => void;
  onMessage: (artist: Artist) => void;
  onToggleStatus: (id: string, willBeActive: boolean) => void;
  onResendActivation?: (artist: Artist) => void;
  isResending?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

// Compact "invited on" stamp (e.g. 22.07.2026, 23:50) — no timezone suffix, it
// only needs to read as "this went out recently / a while ago".
const INVITE_SENT_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export const ArtistCard = React.memo(
  ({
    artist,
    onOpen,
    onMessage,
    onToggleStatus,
    onResendActivation,
    isResending = false,
    selectionMode = false,
    selected = false,
    onToggleSelect,
  }: ArtistCardProps) => {
    const { t } = useTranslation();

    const section = getSectionPresentation(artist.voice_type);
    const isActive = artist.is_active;
    const hasAccount = Boolean(artist.user);
    // Activation status is manager-only (undefined otherwise): treat unknown as
    // neither state so we never raise a false "pending" flag on a partial DTO.
    const accountActivated = artist.account_activated === true;
    const accountPending = hasAccount && artist.account_activated === false;
    const inviteSentAt = artist.activation_email_sent_at
      ? formatLocalizedDateTime(artist.activation_email_sent_at, INVITE_SENT_FORMAT)
      : null;
    const fullName = `${artist.first_name} ${artist.last_name}`;
    const voiceLabel = artist.voice_type
      ? t(
          `dashboard.layout.roles.${artist.voice_type}`,
          artist.voice_type_display || artist.voice_type,
        )
      : artist.voice_type_display || "";
    const rangeText =
      artist.vocal_range_bottom || artist.vocal_range_top
        ? `${artist.vocal_range_bottom || "?"} – ${artist.vocal_range_top || "?"}`
        : null;

    const activate = () =>
      selectionMode ? onToggleSelect?.(artist.id) : onOpen(artist);

    return (
      <GlassCard
        variant={isActive ? "solid" : "light"}
        padding="none"
        isHoverable
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        }}
        aria-pressed={selectionMode ? selected : undefined}
        aria-label={
          selectionMode
            ? t("artists.bulk.select_aria", {
                defaultValue: "Zaznacz: {{name}}",
                name: fullName,
              })
            : t("artists.card.open_profile_aria", {
                defaultValue: "Otwórz profil: {{name}}",
                name: fullName,
              })
        }
        className={cn(
          "flex h-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
          !isActive && "opacity-75 saturate-[0.9]",
          selected && "ring-2 ring-ethereal-gold/70",
        )}
      >
        <div className="flex items-start gap-3.5 p-5 pb-4">
          <div className="relative shrink-0">
            <Avatar
              src={artist.avatar_thumb_url}
              name={fullName}
              size="md"
              shape="rounded"
              tone="neutral"
              className={cn(
                "border shadow-glass-solid",
                isActive
                  ? "border-ethereal-marble bg-ethereal-alabaster"
                  : "border-ethereal-incense/20 bg-ethereal-marble",
              )}
            />
            {isActive && accountActivated && (
              <span
                className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-ethereal-alabaster bg-ethereal-sage shadow-sm"
                title={t(
                  "artists.card.active_account_title",
                  "Konto aktywne i połączone z platformą",
                )}
              />
            )}
            {isActive && accountPending && (
              <span
                className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-ethereal-alabaster bg-ethereal-gold shadow-sm"
                title={t(
                  "artists.card.pending_activation_title",
                  "Zaproszenie wysłane — konto nie zostało jeszcze aktywowane",
                )}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <Heading as="h3" size="md" weight="bold" truncate>
              {fullName}
            </Heading>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                variant={isActive && section ? section.badge : "neutral"}
                icon={<Music2 size={9} aria-hidden="true" />}
              >
                {voiceLabel}
              </Badge>
              {!isActive && (
                <Badge variant="neutral">
                  {t("artists.card.archive_badge", "Archiwum")}
                </Badge>
              )}
            </div>
          </div>

          {selectionMode ? (
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                selected
                  ? "border-ethereal-gold bg-ethereal-gold text-ethereal-ink"
                  : "border-ethereal-ink/20 bg-ethereal-alabaster text-transparent",
              )}
            >
              <Check size={14} />
            </span>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                stop(event);
                onToggleStatus(artist.id, !isActive);
              }}
              title={
                isActive
                  ? t("artists.card.archive_action", "Archiwum")
                  : t("artists.card.activate_action", "Aktywuj")
              }
              aria-label={
                isActive
                  ? t("artists.card.archive_action", "Archiwum")
                  : t("artists.card.activate_action", "Aktywuj")
              }
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "text-ethereal-graphite/40 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
                  : "text-ethereal-sage hover:bg-ethereal-sage/10",
              )}
            >
              {isActive ? (
                <Trash2 size={14} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={14} aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        <div className="mx-5 grid grid-cols-2 overflow-hidden rounded-xl border border-ethereal-ink/6">
          <div className="flex flex-col gap-1 border-r border-ethereal-ink/6 bg-ethereal-alabaster/70 px-3.5 py-2.5">
            <Eyebrow color="muted">
              {t("artists.card.voice_range", "Skala Głosu")}
            </Eyebrow>
            {rangeText ? (
              <Text size="sm" weight="bold" className="tabular-nums">
                {rangeText}
              </Text>
            ) : (
              <Caption color="muted" className="italic">
                {t("artists.card.none", "Brak")}
              </Caption>
            )}
          </div>
          <div className="flex flex-col gap-1 bg-ethereal-alabaster/70 px-3.5 py-2.5">
            <Eyebrow color="muted">
              {t("artists.card.sight_reading", "A Vista")}
            </Eyebrow>
            <SightReadingStars level={artist.sight_reading_skill} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-5 pt-4">
          {artist.email && (
            <a
              href={`mailto:${artist.email}`}
              onClick={stop}
              className="inline-flex min-w-0 items-center gap-2 text-ethereal-graphite transition-colors hover:text-ethereal-ink"
            >
              <Mail
                size={14}
                className="shrink-0 text-ethereal-graphite/50"
                aria-hidden="true"
              />
              <Text size="sm" weight="medium" truncate>
                {artist.email}
              </Text>
            </a>
          )}
          {artist.phone_number ? (
            <a
              href={`tel:${artist.phone_number}`}
              onClick={stop}
              className="inline-flex min-w-0 items-center gap-2 text-ethereal-graphite transition-colors hover:text-ethereal-ink"
            >
              <Phone
                size={14}
                className="shrink-0 text-ethereal-graphite/50"
                aria-hidden="true"
              />
              <Text size="sm" weight="medium" truncate>
                {artist.phone_number}
              </Text>
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 text-ethereal-graphite/50">
              <Phone size={14} className="shrink-0" aria-hidden="true" />
              <Text size="sm" color="muted" className="italic">
                {t("artists.card.no_phone", "Brak telefonu")}
              </Text>
            </span>
          )}
          {accountPending && (
            <div className="mt-auto flex flex-col gap-2 rounded-lg border border-ethereal-gold/25 bg-ethereal-gold/[0.07] px-3 py-2.5">
              <div className="flex items-start gap-1.5 text-ethereal-gold">
                <MailWarning
                  size={13}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <Eyebrow color="gold">
                    {t("artists.card.pending_activation", "Nie aktywowano")}
                  </Eyebrow>
                  {inviteSentAt && (
                    <Caption
                      color="muted"
                      className="mt-0.5 block leading-tight tabular-nums"
                    >
                      {t("artists.card.invite_sent_at", {
                        defaultValue: "Wysłano {{when}}",
                        when: inviteSentAt,
                      })}
                    </Caption>
                  )}
                </div>
              </div>
              {onResendActivation && (
                <button
                  type="button"
                  onClick={(event) => {
                    stop(event);
                    onResendActivation(artist);
                  }}
                  disabled={isResending}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-ethereal-gold/30 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ethereal-gold transition-colors hover:bg-ethereal-gold/12 disabled:opacity-50"
                >
                  <Send size={11} aria-hidden="true" />
                  {isResending
                    ? t("artists.card.resending", "Wysyłanie…")
                    : t("artists.card.resend_activation_short", "Wyślij ponownie")}
                </button>
              )}
            </div>
          )}
          {!hasAccount && (
            <span className="inline-flex items-center gap-2 text-ethereal-crimson">
              <UserX size={14} className="shrink-0" aria-hidden="true" />
              <Eyebrow color="crimson">
                {t("artists.card.detached_account", "Konto odłączone")}
              </Eyebrow>
            </span>
          )}
        </div>

        {!selectionMode && (
          <div className="mt-auto flex items-center gap-2 border-t border-ethereal-ink/6 px-5 py-3">
            <button
              type="button"
              onClick={(event) => {
                stop(event);
                onMessage(artist);
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ethereal-amethyst/25 bg-ethereal-amethyst/5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ethereal-amethyst transition-colors hover:bg-ethereal-amethyst/10"
            >
              <MessageSquare size={13} aria-hidden="true" />
              {t("artists.card.message", "Napisz")}
            </button>
            <span className="inline-flex items-center gap-1 pr-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ethereal-graphite/55 transition-colors group-hover:text-ethereal-gold">
              {t("artists.card.details", "Dossier")}
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </div>
        )}
      </GlassCard>
    );
  },
  (previous, next) =>
    previous.artist === next.artist &&
    previous.selectionMode === next.selectionMode &&
    previous.selected === next.selected &&
    previous.isResending === next.isResending &&
    previous.onOpen === next.onOpen &&
    previous.onMessage === next.onMessage &&
    previous.onToggleStatus === next.onToggleStatus &&
    previous.onResendActivation === next.onResendActivation &&
    previous.onToggleSelect === next.onToggleSelect,
);

ArtistCard.displayName = "ArtistCard";
