/**
 * @file ArtistRow.tsx
 * @description One member of the roster, as a `RecordRow`: the row opens the
 * dossier. The name in the sans voice; under it, the voice or role ("Bas",
 * "Dyrygent") and, while an invitation waits, when it went out. To the right,
 * in the columns the roster declares (`ARTIST_COLUMNS`), the range and the
 * sight-reading stars; both are left to the dossier below `md`, as are the
 * e-mail and the phone.
 *
 * Flags speak only for a member who needs a hand: an invitation unanswered or
 * expired, an address never given, a detached account, and the bell-off mark
 * of a member none of whose devices takes a push, the list of people worth
 * asking in person. "Asystent" is the one flag that is a role, not a problem:
 * it is why the manager looks for that row. A healthy member carries none.
 *
 * The range is the conductor's; until there is one, the singer's own proposal
 * stands in, muted and marked as theirs. The comparison of the two stays in
 * the dossier and in the range filter.
 *
 * Every row has the same one menu, so the columns stand under each other. In
 * selection mode the row is one toggle (`RecordRow`'s `row` scope) and the
 * menu steps aside.
 * @module features/artists/components/ArtistRow
 */

import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Archive,
  ArchiveRestore,
  BellOff,
  Eye,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Send,
} from "lucide-react";

import type { Artist } from "@/shared/types";
import { artistRoleLabel } from "@/shared/lib/voiceTypes";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { Avatar } from "@/shared/ui/composites/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { RecordRow, recordActionClass, type RecordColumn } from "@/shared/ui/composites/RecordList";
import { VocalRangeText } from "@/shared/ui/instruments/PitchName";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { usePitchNotation } from "../hooks/usePitchNotation";
import {
  canReceiveMessages,
  isAwaitingActivation,
  isWithoutEmail,
  isWithoutPush,
} from "../lib/accountState";
import { rangeShown } from "../lib/vocalRangeProposal";
import { SightReadingStars } from "./SightReadingStars";

/**
 * The roster's figure columns, in `ArtistRow`'s `meta` order: the range ("E (D)
 * – c¹ (e¹)" fits), the sight-reading stars. Both drop below `md`.
 */
export const ARTIST_COLUMNS: readonly RecordColumn[] = [
  { width: "xl" },
  { width: "sm" },
];

interface ArtistRowProps {
  readonly artist: Artist;
  readonly onOpen: (artist: Artist) => void;
  readonly onMessage: (artist: Artist) => void;
  readonly onEdit: (artist: Artist) => void;
  readonly onToggleStatus: (id: string, willBeActive: boolean) => void;
  readonly onResendActivation: (artist: Artist) => void;
  readonly isResending?: boolean;
  /** The list is in selection mode: a tap toggles the member instead of opening them. */
  readonly selectionMode?: boolean;
  readonly selected?: boolean;
  readonly onToggleSelect?: (id: string) => void;
}

export const ArtistRow = React.memo(
  ({
    artist,
    onOpen,
    onMessage,
    onEdit,
    onToggleStatus,
    onResendActivation,
    isResending = false,
    selectionMode = false,
    selected = false,
    onToggleSelect,
  }: ArtistRowProps): React.JSX.Element => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const notation = usePitchNotation();
    // The act a menu item chose, run once the menu has handed focus back to
    // its trigger, so the dialog or panel it opens returns focus there.
    const chosen = useRef<(() => void) | null>(null);

    const fullName = `${artist.first_name} ${artist.last_name}`;
    const isActive = artist.is_active;
    const hasAccount = Boolean(artist.user);
    const accountPending = isAwaitingActivation(artist);
    const linkExpired = accountPending && artist.activation_link_expired === true;
    const withoutEmail = isWithoutEmail(artist);
    const withoutPush = isActive && isWithoutPush(artist);
    const detached = isActive && !hasAccount;

    const voiceLabel = artist.voice_type
      ? artistRoleLabel(t, artist.voice_type, artist.instrument)
      : artist.voice_type_display || null;
    const inviteSent =
      accountPending && artist.activation_email_sent_at
        ? t("artists.row.invite_sent", "zaproszenie wysłane {{when}}", {
            when: formatLocalizedDateTime(artist.activation_email_sent_at, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
          })
        : null;

    const noPushLabel = t("artists.card.no_push_title");
    const flags =
      accountPending || withoutEmail || detached || withoutPush || (isActive && artist.is_project_leader) ? (
        <>
          {accountPending && (
            <Badge variant={linkExpired ? "danger" : "warning"} casing="natural">
              {linkExpired
                ? t("artists.card.link_expired", "Link wygasł")
                : t("artists.card.pending_activation", "Nie aktywowano")}
            </Badge>
          )}
          {withoutEmail && (
            <Badge
              variant="neutral"
              casing="natural"
              title={t(
                "artists.card.no_email_title",
                "Dodano bez adresu e-mail. Ta osoba nie ma dostępu do aplikacji i nie dostaje powiadomień, więc wszystko trzeba jej przekazywać osobiście.",
              )}
            >
              {t("artists.card.no_email", "Bez e-maila")}
            </Badge>
          )}
          {detached && (
            <Badge variant="danger" casing="natural">
              {t("artists.card.detached_account", "Konto odłączone")}
            </Badge>
          )}
          {isActive && artist.is_project_leader && (
            <Badge variant="neutral" casing="natural">
              {t("projects.delegates.badge", "Asystent")}
            </Badge>
          )}
          {withoutPush && (
            <span role="img" aria-label={noPushLabel} title={noPushLabel} className="inline-flex text-ethereal-graphite">
              <BellOff size={14} aria-hidden="true" />
            </span>
          )}
        </>
      ) : null;

    const shown = rangeShown(artist);
    const proposalTitle = t("artists.card.range_proposal_title", "Propozycja chórzysty");
    const range = !shown ? null : shown.source === "conductor" ? (
      <VocalRangeText range={shown.range} notation={notation} />
    ) : (
      <Text as="span" size="sm" color="muted" title={proposalTitle}>
        <VocalRangeText range={shown.range} notation={notation} />
        <span className="sr-only"> ({proposalTitle})</span>
      </Text>
    );

    const choose = (act: () => void) => () => {
      chosen.current = act;
    };

    return (
      <RecordRow
        open={{ onOpen: () => onOpen(artist) }}
        title={fullName}
        voice="name"
        leading={
          <Avatar
            src={artist.avatar_thumb_url}
            name={fullName}
            size="sm"
            shape="rounded"
            tone="neutral"
          />
        }
        flags={flags}
        facts={[voiceLabel, inviteSent]}
        meta={[
          range,
          artist.sight_reading_skill ? (
            <SightReadingStars level={artist.sight_reading_skill} size={10} />
          ) : null,
        ]}
        select={
          selectionMode
            ? {
                scope: "row",
                checked: selected,
                label: t("artists.bulk.select_aria", {
                  defaultValue: "Zaznacz: {{name}}",
                  name: fullName,
                }),
                onChange: () => onToggleSelect?.(artist.id),
              }
            : undefined
        }
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="icon"
                size="icon"
                className={recordActionClass}
                aria-label={t("artists.row.menu_aria", "Więcej: {{name}}", { name: fullName })}
              >
                <MoreHorizontal size={16} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              onCloseAutoFocus={() => {
                const act = chosen.current;
                chosen.current = null;
                act?.();
              }}
            >
              {canReceiveMessages(artist) && (
                <DropdownMenuItem
                  icon={<MessageSquare size={16} />}
                  onSelect={choose(() => onMessage(artist))}
                >
                  {t("artists.row.message", "Napisz")}
                </DropdownMenuItem>
              )}
              {isActive && hasAccount && (
                <DropdownMenuItem
                  icon={<Eye size={16} />}
                  onSelect={choose(() => navigate(`/panel/artists/${artist.id}/preview`))}
                >
                  {t("artists.row.preview", "Podgląd jak chórzysta")}
                </DropdownMenuItem>
              )}
              {accountPending && (
                <DropdownMenuItem
                  icon={<Send size={16} />}
                  disabled={isResending}
                  onSelect={() => onResendActivation(artist)}
                >
                  {t("artists.row.resend", "Wyślij zaproszenie ponownie")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem icon={<Pencil size={16} />} onSelect={choose(() => onEdit(artist))}>
                {t("artists.row.edit", "Edytuj")}
              </DropdownMenuItem>
              {isActive ? (
                <DropdownMenuItem
                  destructive
                  icon={<Archive size={16} />}
                  onSelect={choose(() => onToggleStatus(artist.id, false))}
                >
                  {t("artists.row.archive", "Archiwizuj")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  icon={<ArchiveRestore size={16} />}
                  onSelect={choose(() => onToggleStatus(artist.id, true))}
                >
                  {t("artists.row.restore", "Przywróć")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    );
  },
);

ArtistRow.displayName = "ArtistRow";
