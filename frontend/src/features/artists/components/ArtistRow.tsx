/**
 * @file ArtistRow.tsx
 * @description Dense, click-to-open roster row — the list-view counterpart to
 * ArtistCard. Click opens the dossier; inline message / archive actions stop
 * propagation. In selection mode a leading checkbox appears and the whole row
 * toggles multi-selection instead.
 *
 * The row states an account problem ONCE: a chip when the invitation is still
 * unanswered, plus the resend it needs. There is no "account is fine" mark —
 * that is the resting case for every singer on a healthy roster, and painting
 * it forty times is what buried the one row that needed a hand. Range and
 * a-vista are the singer's own facts, so they read as plain type and simply
 * vanish when nobody has recorded them.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/ArtistRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
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
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { ACCENT_BADGE } from "@/shared/ui/primitives/accents";
import { Caption, Text } from "@/shared/ui/primitives/typography";
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
    const accountPending = hasAccount && artist.account_activated === false;
    const linkExpired = accountPending && artist.activation_link_expired === true;
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
          "group flex w-full cursor-pointer items-center gap-3 rounded-nested border border-hairline-strong bg-ethereal-alabaster px-4 py-3 transition-colors hover:border-ethereal-gold/30 hover:bg-ethereal-parchment/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 focus-visible:ring-inset",
          !isActive && "opacity-65 saturate-[0.85]",
          selected && "border-ethereal-gold/60 bg-ethereal-gold/[0.04] ring-1 ring-ethereal-gold/40",
        )}
      >
        {selectionMode && (
          <Checkbox
            size="md"
            checked={selected}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none"
          />
        )}

        <Avatar
          src={artist.avatar_thumb_url}
          name={fullName}
          size="sm"
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
          <div className="flex items-center gap-2">
            <Text weight="semibold" truncate className="text-ethereal-ink">
              {fullName}
            </Text>
            <Badge
              variant={
                isActive && section ? ACCENT_BADGE[section.accent] : "neutral"
              }
              className="shrink-0"
            >
              {voiceLabel}
            </Badge>
            {!isActive && (
              <Badge variant="neutral" className="shrink-0">
                {t("artists.card.archive_badge", "Archiwum")}
              </Badge>
            )}
            {accountPending && (
              <Badge
                variant={linkExpired ? "danger" : "warning"}
                className="shrink-0"
              >
                {linkExpired
                  ? t("artists.card.link_expired", "Link wygasł")
                  : t("artists.card.pending_activation", "Nie aktywowano")}
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
            {/* When the invitation went out is a fact, not a second alarm — the
                chip above already carries the tone. */}
            {accountPending && inviteSentAt && (
              <Caption
                color="muted"
                className="inline-flex items-center gap-1 tabular-nums"
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

        <div className="hidden shrink-0 items-center gap-4 md:flex">
          {rangeText && (
            <Caption
              className="tabular-nums text-ethereal-graphite"
              title={t("artists.card.voice_range", "Skala Głosu")}
            >
              {rangeText}
            </Caption>
          )}
          {artist.sight_reading_skill ? (
            <SightReadingStars level={artist.sight_reading_skill} size={10} />
          ) : null}
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
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-chip transition-colors disabled:opacity-50",
                  linkExpired
                    ? "text-ethereal-crimson hover:bg-ethereal-crimson/10"
                    : "text-ethereal-gold hover:bg-ethereal-gold/12",
                )}
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
              className="flex h-8 w-8 items-center justify-center rounded-chip text-ethereal-graphite/60 transition-colors hover:bg-ethereal-amethyst/10 hover:text-ethereal-amethyst"
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
                "flex h-8 w-8 items-center justify-center rounded-chip transition-colors",
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
