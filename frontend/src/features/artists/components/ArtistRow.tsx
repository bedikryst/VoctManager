/**
 * @file ArtistRow.tsx
 * @description Dense, click-to-open roster row — the list-view counterpart to
 * ArtistCard. Click opens the dossier; inline message / archive actions stop
 * propagation. In selection mode a leading checkbox appears and the whole row
 * toggles multi-selection instead.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/ArtistRow
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
  Phone,
  Send,
  Trash2,
  UserX,
} from "lucide-react";

import type { Artist } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { getSectionPresentation } from "../constants/voiceSections";
import { SightReadingStars } from "./SightReadingStars";

interface ArtistRowProps {
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

export const ArtistRow = React.memo(
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
  }: ArtistRowProps) => {
    const { t } = useTranslation();

    const section = getSectionPresentation(artist.voice_type);
    const isActive = artist.is_active;
    const hasAccount = Boolean(artist.user);
    // Manager-only flag (undefined otherwise): unknown counts as neither state.
    const accountActivated = artist.account_activated === true;
    const accountPending = hasAccount && artist.account_activated === false;
    const inviteSentAt = artist.activation_email_sent_at
      ? formatLocalizedDateTime(artist.activation_email_sent_at, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
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
      <div
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(event) => {
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
          "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-ethereal-ink/8 bg-ethereal-alabaster px-4 py-3 transition-colors hover:border-ethereal-gold/30 hover:bg-ethereal-parchment/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 focus-visible:ring-inset",
          !isActive && "opacity-65 saturate-[0.85]",
          selected && "border-ethereal-gold/60 bg-ethereal-gold/[0.04] ring-1 ring-ethereal-gold/40",
        )}
      >
        {selectionMode && (
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
        )}

        <div className="relative shrink-0">
          <Avatar
            src={artist.avatar_thumb_url}
            name={fullName}
            size="sm"
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
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ethereal-alabaster bg-ethereal-sage"
              title={t(
                "artists.card.active_account_title",
                "Konto aktywne i połączone z platformą",
              )}
            />
          )}
          {isActive && accountPending && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ethereal-alabaster bg-ethereal-gold"
              title={t(
                "artists.card.pending_activation_title",
                "Zaproszenie wysłane — konto nie zostało jeszcze aktywowane",
              )}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Text weight="semibold" truncate className="text-ethereal-ink">
              {fullName}
            </Text>
            <Badge
              variant={isActive && section ? section.badge : "neutral"}
              className="shrink-0"
            >
              {voiceLabel}
            </Badge>
            {!isActive && (
              <Badge variant="neutral" className="hidden shrink-0 sm:inline-flex">
                {t("artists.card.archive_badge", "Archiwum")}
              </Badge>
            )}
            {accountPending && (
              <Badge variant="warning" className="hidden shrink-0 sm:inline-flex">
                {t("artists.card.pending_activation", "Nie aktywowano")}
              </Badge>
            )}
            {isActive && !hasAccount && (
              <span
                className="shrink-0 text-ethereal-crimson/70"
                title={t("artists.card.detached_account", "Konto odłączone")}
              >
                <UserX size={13} aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {artist.email && (
              <Caption
                color="muted"
                className="inline-flex max-w-[16rem] items-center gap-1 truncate"
              >
                <Mail size={11} aria-hidden="true" />
                <span className="truncate">{artist.email}</span>
              </Caption>
            )}
            {artist.phone_number && (
              <Caption color="muted" className="inline-flex items-center gap-1">
                <Phone size={11} aria-hidden="true" />
                {artist.phone_number}
              </Caption>
            )}
            {accountPending && inviteSentAt && (
              <Caption
                className="inline-flex items-center gap-1 text-ethereal-gold/90 tabular-nums"
              >
                <MailWarning size={11} aria-hidden="true" />
                {t("artists.card.invite_sent_at", {
                  defaultValue: "Wysłano {{when}}",
                  when: inviteSentAt,
                })}
              </Caption>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-5 md:flex">
          <div className="flex flex-col items-end gap-0.5">
            <Eyebrow color="muted">
              {t("artists.card.voice_range_short", "Skala")}
            </Eyebrow>
            {rangeText ? (
              <Caption weight="bold" className="text-ethereal-ink tabular-nums">
                {rangeText}
              </Caption>
            ) : (
              <Caption color="muted" className="italic">
                —
              </Caption>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Eyebrow color="muted">
              {t("artists.card.sight_reading", "A Vista")}
            </Eyebrow>
            <SightReadingStars level={artist.sight_reading_skill} size={10} />
          </div>
        </div>

        {!selectionMode && (
          <div className="flex shrink-0 items-center gap-1">
            {accountPending && onResendActivation && (
              <button
                type="button"
                onClick={(event) => {
                  stop(event);
                  onResendActivation(artist);
                }}
                disabled={isResending}
                title={t(
                  "artists.card.resend_activation",
                  "Wyślij ponownie zaproszenie",
                )}
                aria-label={t(
                  "artists.card.resend_activation",
                  "Wyślij ponownie zaproszenie",
                )}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ethereal-gold transition-colors hover:bg-ethereal-gold/12 disabled:opacity-50"
              >
                <Send size={14} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={(event) => {
                stop(event);
                onMessage(artist);
              }}
              title={t("artists.card.message_title", "Napisz wiadomość")}
              aria-label={t("artists.card.message_title", "Napisz wiadomość")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ethereal-graphite/60 transition-colors hover:bg-ethereal-amethyst/10 hover:text-ethereal-amethyst"
            >
              <MessageSquare size={14} aria-hidden="true" />
            </button>
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
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "text-ethereal-graphite/50 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
                  : "text-ethereal-sage hover:bg-ethereal-sage/10",
              )}
            >
              {isActive ? (
                <Trash2 size={13} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={14} aria-hidden="true" />
              )}
            </button>
            <ChevronRight
              size={16}
              aria-hidden="true"
              className="shrink-0 text-ethereal-graphite/50 transition-transform group-hover:translate-x-0.5 group-hover:text-ethereal-gold"
            />
          </div>
        )}
      </div>
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

ArtistRow.displayName = "ArtistRow";
