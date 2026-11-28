/**
 * @file ArtistDossier.tsx
 * @description An artist's record for the manager, on `SidePanel`. The head is
 * the roster row's own: the name, its byline (the voice, an invitation's date,
 * the row's bell-off mark in words), "Edytuj" and a menu (write to them, see
 * what the app shows them) whose items are named as on the row. The body
 * states the account only when it asks for an act (no e-mail address, an
 * invitation not taken up, no account behind the row), then the track record
 * served by GET /artists/{id}/dossier/: the two rates, the voices most sung, the money,
 * the projects led and the projects sung. Every project is a row that opens
 * it; a sung project opens its voice assignments, where the per-piece lines
 * live, and the finished ones fold into one line.
 * @module features/artists/components/ArtistDossier
 */

import React, { useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Eye, History, MessageSquare, MoreHorizontal, Pencil, Users } from "lucide-react";

import { artistRoleLabel } from "@/shared/lib/voiceTypes";
import type { Artist } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { SidePanel } from "@/shared/ui/composites/SidePanel";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { FoldLine } from "@/shared/ui/composites/FoldLine";
import { RecordList, RecordRow } from "@/shared/ui/composites/RecordList";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { formatLocalizedDate, formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { isPositiveAmount, toGrosze } from "@/features/finance/lib/money";
import type { DecimalString } from "@/features/finance/types/finance.dto";
import { PROJECT_STATUS } from "@/features/projects/constants/projectDomain";
import { getProjectStatusPresentation } from "@/features/projects/lib/projectPresentation";
import {
  RATE_TONE_ACCENT,
  attendanceRateTone,
} from "@/features/rehearsals/constants/attendanceMeta";
import { useArtistDossier } from "../api/artist.queries";
import {
  canReceiveMessages,
  isAwaitingActivation,
  isDetached,
  isWithoutEmail,
  isWithoutPush,
} from "../lib/accountState";
import type {
  ArtistDossierLeadership,
  ArtistDossierStats,
  DossierCasting,
  DossierLedProject,
  DossierProject,
} from "../types/artistDossier.dto";

interface ArtistDossierProps {
  isOpen: boolean;
  onClose: () => void;
  artist: Artist | null;
  onEdit: (artist: Artist) => void;
  onMessage: (artist: Artist) => void;
  onResendActivation?: (artist: Artist) => void;
  isResending?: boolean;
}

const plnFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
/** The server's decimal string, read in integer grosze like every amount. */
const formatPln = (value: DecimalString): string =>
  plnFormatter.format((toGrosze(value) ?? 0) / 100);

const formatProjectDate = (value: string | null): string | null =>
  value ? formatLocalizedDate(value, { day: "numeric", month: "short", year: "numeric" }) : null;

const toPercent = (rate: number | null): number | null =>
  rate === null ? null : Math.round(rate * 100);

/**
 * A project's castings summed by the part they sang: "Bas 1 w 3 utworach,
 * Bas 2 w 2", the most-sung part first. Keyed by the part's name, not its code,
 * like the server's own tally: one code heads "Tenor" on a unison piece and
 * "Tenor 1" on a divided one.
 */
const summariseCastings = (castings: readonly DossierCasting[], t: TFunction): string => {
  const piecesByLine = new Map<string, Set<string>>();
  for (const casting of castings) {
    const pieces = piecesByLine.get(casting.voice_line_label) ?? new Set<string>();
    pieces.add(casting.piece_title);
    piecesByLine.set(casting.voice_line_label, pieces);
  }
  const tally = [...piecesByLine]
    .map(([line, pieces]) => ({ line, count: pieces.size }))
    .sort((left, right) => right.count - left.count);
  if (tally.length === 0) {
    return t("artists.dossier.no_casting", "bez przypisania do utworów");
  }
  const [first, ...rest] = tally;
  return [
    t("artists.dossier.casting_first", { line: first.line, count: first.count }),
    ...rest.map(({ line, count }) => t("artists.dossier.casting_more", { line, count })),
  ].join(", ");
};

const DateFigure = ({ value }: { value: string | null }): React.JSX.Element | null => {
  const label = formatProjectDate(value);
  return label ? (
    <Text as="span" size="sm" color="graphite" className="whitespace-nowrap">
      {label}
    </Text>
  ) : null;
};

const SubHeading = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <Text as="h3" id={id} size="base" weight="semibold" className="mb-1">
    {children}
  </Text>
);

// What the row's flag means, said once in the record. Crimson only for a
// discrete broken state (an expired link, no account behind the row); waiting
// and a choice the manager made take no tone.
const AccountNote = ({
  headingId,
  title,
  body,
  broken = false,
  children,
}: {
  headingId: string;
  title: string;
  body: string;
  broken?: boolean;
  children?: React.ReactNode;
}) => (
  <section aria-labelledby={headingId}>
    <Text
      as="h3"
      id={headingId}
      size="base"
      weight="semibold"
      color={broken ? "crimson" : undefined}
      className="mb-1"
    >
      {title}
    </Text>
    <Text as="p" size="sm" color="graphite">
      {body}
    </Text>
    {children}
  </section>
);

const RateFigure = ({
  label,
  rate,
  counts,
  accent,
}: {
  label: string;
  rate: number | null;
  counts: string;
  accent: "default" | "gold";
}) => {
  const percent = toPercent(rate);
  return (
    <div className="flex flex-col gap-1">
      <MetricBlock
        label={label}
        value={percent ?? "—"}
        unit={percent === null ? undefined : "%"}
        accentColor={accent}
      />
      <Text as="p" size="sm" color="muted">
        {counts}
      </Text>
    </div>
  );
};

// A rate with nothing measured yet is left out rather than shown as a dash
// over two zeros: a conductor who is never invited to sing would otherwise
// open on a block of blanks.
const RatesSection = ({ stats }: { stats: ArtistDossierStats }) => {
  const { t } = useTranslation();
  const hasAcceptance = stats.acceptance_rate !== null;
  const hasAttendance = stats.attendance_rate !== null;
  if (!hasAcceptance && !hasAttendance && stats.top_voice_lines.length === 0) return null;
  // Only the attendance rate has a shortfall line, `LOW_ATTENDANCE_RATE`. An
  // invitation declined is a member's choice, and no scale for it exists.
  const attendanceAccent = RATE_TONE_ACCENT[attendanceRateTone(toPercent(stats.attendance_rate))];
  return (
    <div className="space-y-4">
      {(hasAcceptance || hasAttendance) && (
        <div className="grid grid-cols-2 gap-5">
          {hasAcceptance && (
            <RateFigure
              label={t("artists.dossier.acceptance", "Akceptacja zaproszeń")}
              rate={stats.acceptance_rate}
              accent="default"
              counts={[
                t("artists.dossier.confirmed_count", { count: stats.projects_confirmed }),
                t("artists.dossier.declined_count", { count: stats.invitations_declined }),
              ].join(", ")}
            />
          )}
          {hasAttendance && (
            <RateFigure
              label={t("artists.dossier.attendance", "Frekwencja na próbach")}
              rate={stats.attendance_rate}
              accent={attendanceAccent}
              counts={[
                t("artists.dossier.present_count", {
                  count: stats.attendance_present + stats.attendance_late,
                }),
                t("artists.dossier.absent_count", { count: stats.attendance_absent }),
              ].join(", ")}
            />
          )}
        </div>
      )}
      {stats.top_voice_lines.length > 0 && (
        <Text as="p" size="sm" color="graphite">
          {t("artists.dossier.most_sung", "Najczęściej: {{lines}}", {
            lines: stats.top_voice_lines
              .slice(0, 6)
              .map((line) => `${line.label} (${line.count})`)
              .join(", "),
          })}
        </Text>
      )}
    </div>
  );
};

// Ledger figures, not display ones: sans with tabular digits, and no tone,
// since money owed is the ordinary state between a concert and its payroll.
const EarningsSection = ({ stats }: { stats: ArtistDossierStats }) => {
  const { t } = useTranslation();
  const headingId = useId();
  const paid = isPositiveAmount(stats.earnings_paid);
  const outstanding = isPositiveAmount(stats.earnings_outstanding);
  if (!paid && !outstanding) return null;
  return (
    <section aria-labelledby={headingId}>
      <SubHeading id={headingId}>{t("artists.dossier.earnings", "Rozliczenia")}</SubHeading>
      {paid && (
        <Text as="p" size="sm" color="graphite" className="tabular-nums">
          {stats.projects_paid > 0
            ? t("artists.dossier.earnings_paid_projects", {
                amount: formatPln(stats.earnings_paid),
                count: stats.projects_paid,
              })
            : t("artists.dossier.earnings_paid", "Wypłacono {{amount}}", {
                amount: formatPln(stats.earnings_paid),
              })}
        </Text>
      )}
      {outstanding && (
        <Text as="p" size="sm" color="graphite" className="tabular-nums">
          {t("artists.dossier.earnings_outstanding", "Do wypłaty {{amount}}", {
            amount: formatPln(stats.earnings_outstanding),
          })}
        </Text>
      )}
    </section>
  );
};

const LedProjectRow = ({ project }: { project: DossierLedProject }) => {
  const { t } = useTranslation();

  // Three tenses of one appointment: still open (with or without a set end),
  // or over, because the clock ran out or because the concert did.
  const tenure = project.is_live
    ? project.expires_at
      ? t("projects.delegates.until", "do {{date}}", {
          date: formatLocalizedDate(project.expires_at, { day: "numeric", month: "short" }),
        })
      : t("artists.dossier.leadership.current", "trwa")
    : t("artists.dossier.leadership.ended", "zakończone");

  // Same copy as the project's own leaders card: scope is said only where it
  // departs from the ordinary appointment. The first three are granted by
  // default, so a withheld one is the exception; the last two the reverse.
  const withheld: string[] = [];
  if (!project.scopes.marks) {
    withheld.push(t("projects.delegates.scope.without_marks", "bez notatek"));
  }
  if (!project.scopes.roll_call) {
    withheld.push(t("projects.delegates.scope.without_roll_call", "bez obecności"));
  }
  if (!project.scopes.materials) {
    withheld.push(t("projects.delegates.scope.without_materials", "bez materiałów"));
  }

  return (
    <RecordRow
      open={{ to: `/panel/projects/${project.project_id}` }}
      title={project.title}
      voice="name"
      facts={[
        tenure,
        withheld.length > 0
          ? t("projects.delegates.scope.limited", {
              defaultValue: "Zakres ograniczony: {{missing}}",
              missing: withheld.join(", "),
            })
          : null,
        project.scopes.choir_marks
          ? t("projects.delegates.scope.choir_marks_granted", "Nanosi uwagi dla chóru")
          : null,
        project.scopes.manage_rehearsals
          ? t("projects.delegates.scope.planning_granted", "Układa plan swoich prób")
          : null,
      ]}
      figure={<DateFigure value={project.date_time} />}
    />
  );
};

// Rendered only when there is something to show: a singer who never led is
// the ordinary case, and a block of zeros would read as a shortfall.
const LeadershipSection = ({ leadership }: { leadership: ArtistDossierLeadership }) => {
  const { t } = useTranslation();
  const headingId = useId();
  if (leadership.projects_led === 0) return null;
  const title = t("artists.dossier.leadership.title", "Prowadzenie");
  // The projects are the rows below; the line counts what they add up to.
  // Debriefs are counted by the author stamp, not by `led_by`: a leader may
  // write up an evening she covered without having been announced for it.
  const counts = [
    leadership.rehearsals_led > 0
      ? t("artists.dossier.leadership.rehearsals_count", { count: leadership.rehearsals_led })
      : null,
    leadership.debriefs_written > 0
      ? t("artists.dossier.leadership.debriefs_count", { count: leadership.debriefs_written })
      : null,
  ].filter((part): part is string => part !== null);
  return (
    <section aria-labelledby={headingId}>
      <SubHeading id={headingId}>{title}</SubHeading>
      {counts.length > 0 && (
        <Text as="p" size="sm" color="graphite" className="mb-1">
          {counts.join(", ")}
        </Text>
      )}
      <RecordList edge="inset" label={title}>
        {leadership.projects.map((project) => (
          <LedProjectRow key={project.project_id} project={project} />
        ))}
      </RecordList>
    </section>
  );
};

const ProjectHistoryRow = ({
  project,
  showsStatus,
}: {
  project: DossierProject;
  showsStatus: boolean;
}) => {
  const { t } = useTranslation();
  const status = getProjectStatusPresentation(project.status);
  return (
    <RecordRow
      open={{ to: `/panel/projects/${project.project_id}/divisi` }}
      title={project.title}
      voice="name"
      flags={
        project.led ? (
          <Badge variant="neutral" casing="natural">
            {t("projects.delegates.badge", "Asystent")}
          </Badge>
        ) : null
      }
      facts={[
        showsStatus ? t(status.labelKey, status.fallbackLabel) : null,
        summariseCastings(project.castings, t),
      ]}
      figure={<DateFigure value={project.date_time} />}
    />
  );
};

// Keyed by the artist where it is rendered, so the fold closes again when the
// panel moves on to the next person.
const ProjectsSection = ({ projects }: { projects: readonly DossierProject[] }) => {
  const { t } = useTranslation();
  const headingId = useId();
  const [doneOpen, setDoneOpen] = useState(false);
  const title = t("artists.dossier.projects_title", "Projekty");
  const doneLabel = t("artists.dossier.done_label", "Projekty zrealizowane");
  const current = projects.filter((project) => project.status !== PROJECT_STATUS.DONE);
  const done = projects.filter((project) => project.status === PROJECT_STATUS.DONE);

  return (
    <section aria-labelledby={headingId}>
      <SubHeading id={headingId}>{title}</SubHeading>
      {projects.length === 0 && (
        <Text as="p" size="sm" color="graphite">
          {t(
            "artists.dossier.empty_history",
            "Ta osoba nie brała jeszcze udziału w żadnym projekcie.",
          )}
        </Text>
      )}
      {current.length > 0 && (
        <RecordList edge="inset" label={title}>
          {current.map((project) => (
            <ProjectHistoryRow key={project.project_id} project={project} showsStatus />
          ))}
        </RecordList>
      )}
      {done.length > 0 && (
        <div className={current.length > 0 ? "mt-2" : undefined}>
          {/* The fold says they are finished, so the rows under it do not. */}
          <FoldLine
            label={doneLabel}
            summary={t("artists.dossier.done_fold", "Zrealizowane: {{count}}", {
              count: done.length,
            })}
            icon={<History size={16} className="text-ethereal-graphite" />}
            open={doneOpen}
            onToggle={() => setDoneOpen((open) => !open)}
          >
            <RecordList edge="inset" label={doneLabel}>
              {done.map((project) => (
                <ProjectHistoryRow
                  key={project.project_id}
                  project={project}
                  showsStatus={false}
                />
              ))}
            </RecordList>
          </FoldLine>
        </div>
      )}
    </section>
  );
};

export const ArtistDossier = ({
  isOpen,
  onClose,
  artist,
  onEdit,
  onMessage,
  onResendActivation,
  isResending = false,
}: ArtistDossierProps): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accountHeadingId = useId();
  // The act a menu item chose, run once the menu has handed focus back to its
  // trigger, as on the roster row.
  const chosen = useRef<(() => void) | null>(null);

  const { data, isLoading, isError } = useArtistDossier(
    isOpen && artist ? artist.id : null,
  );

  const accountPending = artist ? isAwaitingActivation(artist) : false;
  const withoutEmail = artist ? isWithoutEmail(artist) : false;
  const linkExpired = accountPending && artist?.activation_link_expired === true;
  const detached = artist ? isDetached(artist) : false;
  const withoutPush = artist ? artist.is_active && isWithoutPush(artist) : false;
  const fullName = artist ? `${artist.first_name} ${artist.last_name}` : "";
  const canMessage = artist ? canReceiveMessages(artist) : false;
  const canPreview = Boolean(artist?.is_active && artist.user);

  // The roster row's own facts, so the record repeats what was clicked.
  const voiceLabel = artist
    ? artist.voice_type
      ? artistRoleLabel(t, artist.voice_type, artist.instrument)
      : artist.voice_type_display || null
    : null;
  const inviteSent =
    artist && accountPending && artist.activation_email_sent_at
      ? t("artists.row.invite_sent", "zaproszenie wysłane {{when}}", {
          when: formatLocalizedDateTime(artist.activation_email_sent_at, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
        })
      : null;
  // The row's bell-off mark in words. Most members have no push device, so it
  // stays a byline fact rather than a note that would head most records.
  const noPush = withoutPush ? t("artists.dossier.no_push", "bez powiadomień push") : null;
  const byline = [voiceLabel, inviteSent, noPush].filter(Boolean).join(", ");

  const choose = (act: () => void) => () => {
    chosen.current = act;
  };
  const editLabel = t("artists.row.edit", "Edytuj");

  return (
    <SidePanel
      isOpen={isOpen && artist !== null}
      onCloseRequest={onClose}
      size="lg"
      // Sans, like the roster rows this opened from: the serif marks a titled
      // work, and a person is not one.
      title={fullName}
      leading={
        artist && (
          <Avatar
            src={artist.avatar_thumb_url}
            name={fullName}
            size="md"
            shape="rounded"
            tone="neutral"
            className="border border-ethereal-marble bg-ethereal-alabaster shadow-glass-solid"
          />
        )
      }
      byline={byline || undefined}
      actions={
        artist ? (
          <>
            <Button
              variant="icon"
              size="icon"
              onClick={() => onEdit(artist)}
              aria-label={editLabel}
              title={editLabel}
            >
              <Pencil size={18} aria-hidden="true" />
            </Button>
            {(canMessage || canPreview) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label={t("artists.row.menu_aria", "Więcej: {{name}}", {
                      name: fullName,
                    })}
                  >
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onCloseAutoFocus={() => {
                    const act = chosen.current;
                    chosen.current = null;
                    act?.();
                  }}
                >
                  {canMessage && (
                    <DropdownMenuItem
                      icon={<MessageSquare size={16} />}
                      onSelect={choose(() => onMessage(artist))}
                    >
                      {t("artists.row.message", "Napisz wiadomość")}
                    </DropdownMenuItem>
                  )}
                  {canPreview && (
                    <DropdownMenuItem
                      icon={<Eye size={16} />}
                      onSelect={choose(() => {
                        onClose();
                        navigate(`/panel/artists/${artist.id}/preview`);
                      })}
                    >
                      {t("artists.row.preview", "Zobacz, co widzi ta osoba")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        ) : undefined
      }
    >
      {artist && (
        <div className="space-y-7">
          {/* The three states exclude each other (an address never given, an
              invitation out, no account at all), so at most one note shows
              and they share a heading id. */}
          {withoutEmail && (
            <AccountNote
              headingId={accountHeadingId}
              title={t("artists.dossier.no_email_title", "Bez adresu e-mail")}
              body={t(
                "artists.dossier.no_email_desc",
                "Ta osoba nie ma dostępu do aplikacji i nie dostaje żadnych powiadomień. Plan, zmiany i nuty trzeba jej przekazywać osobiście; „Zobacz, co widzi ta osoba” w menu u góry pokazuje, co ma w planie. Wpisanie adresu w edycji profilu wyśle jej zaproszenie.",
              )}
            />
          )}
          {accountPending && (
            <AccountNote
              headingId={accountHeadingId}
              broken={linkExpired}
              title={
                linkExpired
                  ? t("artists.card.link_expired", "Link wygasł")
                  : t("artists.card.pending_activation", "Nie aktywowano")
              }
              body={
                linkExpired
                  ? t(
                      "artists.dossier.link_expired_desc",
                      "Link aktywacyjny stracił ważność. Wyślij zaproszenie ponownie, aby ta osoba mogła aktywować konto.",
                    )
                  : t(
                      "artists.dossier.pending_activation_desc",
                      "Zaproszenie zostało wysłane, ale ta osoba nie aktywowała jeszcze konta na platformie.",
                    )
              }
            >
              {onResendActivation && (
                <Button
                  variant="secondary"
                  size="sm"
                  casing="sentence"
                  onClick={() => onResendActivation(artist)}
                  isLoading={isResending}
                  className="mt-3"
                >
                  {t("artists.row.resend", "Wyślij zaproszenie ponownie")}
                </Button>
              )}
            </AccountNote>
          )}
          {detached && (
            <AccountNote
              headingId={accountHeadingId}
              broken
              title={t("artists.card.detached_account", "Konto odłączone")}
              body={t(
                "artists.dossier.detached_desc",
                "Konto tej osoby zostało usunięte; jej projekty i obsady zostają w historii. Nie zaloguje się i nie dostaje powiadomień, a adres wpisany w profilu nie wyśle jej już zaproszenia.",
              )}
            />
          )}
          {isLoading ? (
            <EtherealLoader className="h-64" />
          ) : isError ? (
            <StatePanel
              tone="danger"
              icon={<Users size={28} aria-hidden="true" />}
              title={t("artists.dossier.error_title", "Nie udało się wczytać historii")}
              description={t(
                "artists.dossier.error_desc",
                "Spróbuj ponownie za chwilę lub odśwież stronę.",
              )}
            />
          ) : data ? (
            <>
              <RatesSection stats={data.stats} />
              <EarningsSection stats={data.stats} />
              <LeadershipSection leadership={data.leadership} />
              <ProjectsSection key={artist.id} projects={data.projects} />
            </>
          ) : null}
        </div>
      )}
    </SidePanel>
  );
};
