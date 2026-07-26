/**
 * @file ArtistCard.tsx
 * @description Roster card for grid view. Click opens the artist dossier
 * (track record); inline quick actions — message, archive/restore — stop
 * propagation. In selection mode the whole card becomes a multi-select toggle
 * (checkbox + gold ring) and the inline actions step aside.
 *
 * An unanswered invitation is stated once, in the panel that also carries the
 * resend — the avatar used to wear a second mark for the same fact, and a sage
 * one for the ordinary case of an account that works.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/ArtistCard
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
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
import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { ACCENT_BADGE } from "@/shared/ui/primitives/accents";
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
    const accountPending = hasAccount && artist.account_activated === false;
    // Past its ~3-day validity window: the last link is dead, a resend is required.
    const linkExpired = accountPending && artist.activation_link_expired === true;
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
          <Avatar
            src={artist.avatar_thumb_url}
            name={fullName}
            size="md"
            shape="rounded"
            tone="neutral"
            className={cn(
              "shrink-0 border shadow-glass-solid",
              isActive
                ? "border-ethereal-marble bg-ethereal-alabaster"
                : "border-ethereal-incense/20 bg-ethereal-marble",
            )}
          />

          <div className="min-w-0 flex-1">
            <Heading as="h3" size="md" weight="bold" truncate>
              {fullName}
            </Heading>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                variant={
                  isActive && section ? ACCENT_BADGE[section.accent] : "neutral"
                }
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
            <Checkbox
              size="md"
              checked={selected}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none"
            />
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
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-chip transition-colors",
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

        <div className="mx-5 grid grid-cols-2 overflow-hidden rounded-control border border-hairline">
          <div className="flex flex-col gap-1 border-r border-hairline bg-ethereal-alabaster/70 px-3.5 py-2.5">
            <Eyebrow color="muted">
              {t("artists.card.voice_range", "Skala Głosu")}
            </Eyebrow>
            {rangeText ? (
              <Text size="sm" weight="bold" className="tabular-nums">
                {rangeText}
              </Text>
            ) : (
              <Text size="sm" color="muted">
                —
              </Text>
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
            <div
              className={cn(
                "mt-auto flex flex-col gap-2 rounded-chip border px-3 py-2.5",
                linkExpired
                  ? "border-ethereal-crimson/25 bg-ethereal-crimson/[0.06]"
                  : "border-ethereal-gold/25 bg-ethereal-gold/[0.07]",
              )}
            >
              <div
                className={cn(
                  "flex items-start gap-1.5",
                  linkExpired ? "text-ethereal-crimson" : "text-ethereal-gold",
                )}
              >
                <MailWarning
                  size={13}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <Eyebrow color={linkExpired ? "crimson" : "gold"}>
                    {linkExpired
                      ? t("artists.card.link_expired", "Link wygasł")
                      : t("artists.card.pending_activation", "Nie aktywowano")}
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
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={(event) => {
                    stop(event);
                    onResendActivation(artist);
                  }}
                  isLoading={isResending}
                  leftIcon={<Send size={12} aria-hidden="true" />}
                  className={cn(
                    linkExpired
                      ? "border-ethereal-crimson/30 text-ethereal-crimson hover:border-ethereal-crimson hover:text-ethereal-crimson"
                      : "border-ethereal-gold/30 text-ethereal-gold hover:border-ethereal-gold hover:text-ethereal-gold",
                  )}
                >
                  {t("artists.card.resend_activation_short", "Wyślij ponownie")}
                </Button>
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
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-hairline px-5 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                stop(event);
                onMessage(artist);
              }}
              leftIcon={<MessageSquare size={13} aria-hidden="true" />}
              className="text-ethereal-amethyst hover:text-ethereal-amethyst"
            >
              {t("artists.card.message", "Napisz")}
            </Button>
            <span className="inline-flex items-center gap-1 pr-1 text-ethereal-graphite/55 transition-colors group-hover:text-ethereal-gold">
              <Eyebrow color="inherit">
                {t("artists.card.details", "Dossier")}
              </Eyebrow>
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
