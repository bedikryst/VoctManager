/**
 * @file ArtistDossier.tsx
 * @description Read-first slide-over: an artist's project track record for the
 * conductor. Reliability (acceptance + attendance), engagement counts, the voice
 * lines they actually sing, and a per-project casting history ("sang T1 in X,
 * B2 in Y"). All derived from relational state via GET /artists/{id}/dossier/.
 * Editing lives one click deeper, behind the "Edit profile" action.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/ArtistDossier
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Coins,
  Layers,
  MailWarning,
  MessageSquare,
  Music2,
  Pencil,
  Send,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import type { Artist } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Caption,
  Eyebrow,
  Heading,
  Metric,
  Text,
} from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { formatLocalizedDate, formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { useArtistDossier } from "../api/artist.queries";
import { getSectionPresentation } from "../constants/voiceSections";
import type {
  ArtistDossierStats,
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

type Tone = "sage" | "gold" | "crimson" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  sage: "text-ethereal-sage",
  gold: "text-ethereal-gold",
  crimson: "text-ethereal-crimson",
  neutral: "text-ethereal-ink",
};

const rateTone = (rate: number | null): Tone => {
  if (rate === null) return "neutral";
  if (rate >= 0.85) return "sage";
  if (rate >= 0.6) return "gold";
  return "crimson";
};

const formatPercent = (rate: number | null): string =>
  rate === null ? "—" : `${Math.round(rate * 100)}%`;

const plnFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const formatPln = (value: number): string => plnFormatter.format(value);

const projectStatusBadge = (
  status: string,
): { variant: "success" | "warning" | "neutral" | "danger"; key: string; fallback: string } => {
  switch (status) {
    case "DONE":
      return { variant: "neutral", key: "projects.badge_done", fallback: "Zrealizowano" };
    case "ACTIVE":
      return { variant: "warning", key: "projects.badge_active", fallback: "W przygotowaniu" };
    case "CANC":
      return { variant: "danger", key: "artists.dossier.project_cancelled", fallback: "Odwołany" };
    default:
      return { variant: "neutral", key: "artists.dossier.project_draft", fallback: "Szkic" };
  }
};

const RateTile = ({
  label,
  rate,
  sub,
}: {
  label: string;
  rate: number | null;
  sub: string;
}) => {
  const tone = rateTone(rate);
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-ethereal-ink/6 bg-ethereal-alabaster/70 p-4">
      <Eyebrow color="muted">{label}</Eyebrow>
      <Metric size="3xl" className={cn("leading-none tabular-nums", TONE_TEXT[tone])}>
        {formatPercent(rate)}
      </Metric>
      <Caption color="muted">{sub}</Caption>
    </div>
  );
};

const CountTile = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) => (
  <div className="flex flex-col gap-1.5 rounded-2xl border border-ethereal-ink/6 bg-ethereal-alabaster/70 p-4">
    <span className="flex items-center gap-1.5 text-ethereal-incense/70" aria-hidden="true">
      {icon}
    </span>
    <Text size="lg" weight="bold" className="tabular-nums leading-none">
      {value}
    </Text>
    <Caption color="muted">{label}</Caption>
  </div>
);

const StatsSection = ({ stats }: { stats: ArtistDossierStats }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <RateTile
          label={t("artists.dossier.acceptance", "Akceptacja zaproszeń")}
          rate={stats.acceptance_rate}
          sub={t("artists.dossier.acceptance_sub", {
            defaultValue: "{{confirmed}} potw. · {{declined}} odm.",
            confirmed: stats.projects_confirmed,
            declined: stats.invitations_declined,
          })}
        />
        <RateTile
          label={t("artists.dossier.attendance", "Frekwencja na próbach")}
          rate={stats.attendance_rate}
          sub={t("artists.dossier.attendance_sub", {
            defaultValue: "{{present}} ob. · {{absent}} nieob.",
            present: stats.attendance_present + stats.attendance_late,
            absent: stats.attendance_absent,
          })}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <CountTile
          icon={<CheckCircle2 size={15} />}
          label={t("artists.dossier.confirmed", "Potwierdzone")}
          value={stats.projects_confirmed}
        />
        <CountTile
          icon={<CalendarClock size={15} />}
          label={t("artists.dossier.upcoming", "Nadchodzące")}
          value={stats.projects_upcoming}
        />
        <CountTile
          icon={<Layers size={15} />}
          label={t("artists.dossier.completed", "Zrealizowane")}
          value={stats.projects_completed}
        />
      </div>

      {(stats.earnings_paid > 0 || stats.earnings_outstanding > 0) && (
        <div className="space-y-2">
          <Eyebrow color="muted">
            {t("artists.dossier.earnings", "Rozliczenia")}
          </Eyebrow>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 rounded-2xl border border-ethereal-ink/6 bg-ethereal-alabaster/70 p-4">
              <span className="text-ethereal-sage" aria-hidden="true">
                <BadgeCheck size={15} />
              </span>
              <Text size="lg" weight="bold" className="tabular-nums leading-none text-ethereal-sage">
                {formatPln(stats.earnings_paid)}
              </Text>
              <Caption color="muted">
                {t("artists.dossier.earnings_paid", "Wypłacono")}
                {stats.projects_paid > 0 &&
                  ` · ${t("artists.dossier.earnings_projects", "{{n}} proj.", {
                    n: stats.projects_paid,
                  })}`}
              </Caption>
            </div>
            <div className="flex flex-col gap-1.5 rounded-2xl border border-ethereal-ink/6 bg-ethereal-alabaster/70 p-4">
              <span
                className={cn(
                  stats.earnings_outstanding > 0
                    ? "text-ethereal-crimson"
                    : "text-ethereal-incense/70",
                )}
                aria-hidden="true"
              >
                <Coins size={15} />
              </span>
              <Text
                size="lg"
                weight="bold"
                className={cn(
                  "tabular-nums leading-none",
                  stats.earnings_outstanding > 0
                    ? "text-ethereal-crimson"
                    : "text-ethereal-ink",
                )}
              >
                {formatPln(stats.earnings_outstanding)}
              </Text>
              <Caption color="muted">
                {t("artists.dossier.earnings_outstanding", "Do wypłaty")}
              </Caption>
            </div>
          </div>
        </div>
      )}

      {stats.top_voice_lines.length > 0 && (
        <div className="space-y-2">
          <Eyebrow color="muted">
            {t("artists.dossier.most_sung_lines", "Najczęściej śpiewane głosy")}
          </Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {stats.top_voice_lines.slice(0, 6).map((line) => (
              <Badge key={line.voice_line} variant="brand">
                {line.label}
                <span className="ml-1 text-ethereal-graphite/60">×{line.count}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ProjectHistoryItem = ({ project }: { project: DossierProject }) => {
  const { t } = useTranslation();
  const badge = projectStatusBadge(project.status);
  const dateLabel = project.date_time
    ? formatLocalizedDate(
        project.date_time,
        { day: "numeric", month: "short", year: "numeric" },
        undefined,
        undefined,
      )
    : null;

  return (
    <div className="rounded-xl border border-ethereal-ink/6 bg-ethereal-alabaster/60 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Text weight="semibold" truncate className="text-ethereal-ink">
            {project.title}
          </Text>
          {dateLabel && (
            <Caption color="muted" className="mt-0.5 inline-flex items-center gap-1">
              <CalendarClock size={11} aria-hidden="true" />
              {dateLabel}
            </Caption>
          )}
        </div>
        <Badge variant={badge.variant} className="shrink-0">
          {t(badge.key, badge.fallback)}
        </Badge>
      </div>

      {project.castings.length > 0 ? (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-ethereal-ink/6 pt-2.5">
          {project.castings.map((casting, index) => (
            <div
              key={`${casting.piece_title}-${casting.voice_line}-${index}`}
              className="flex items-center gap-2"
            >
              <Music2
                size={12}
                className="shrink-0 text-ethereal-graphite/40"
                aria-hidden="true"
              />
              <Text size="sm" color="graphite" truncate className="min-w-0 flex-1">
                {casting.piece_title}
              </Text>
              {casting.gives_pitch && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-ethereal-gold"
                  title={t("artists.dossier.gives_pitch", "Podaje ton")}
                  aria-label={t("artists.dossier.gives_pitch", "Podaje ton")}
                />
              )}
              <Badge variant="brand" className="shrink-0">
                {casting.voice_line_label}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <Caption color="muted" className="mt-2 block italic">
          {t("artists.dossier.no_casting", "Brak przypisania do utworów")}
        </Caption>
      )}
    </div>
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
}: ArtistDossierProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, isLoading, isError } = useArtistDossier(
    isOpen && artist ? artist.id : null,
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const section = artist ? getSectionPresentation(artist.voice_type) : null;
  const voiceLabel = artist?.voice_type
    ? t(`dashboard.layout.roles.${artist.voice_type}`, artist.voice_type_display || artist.voice_type)
    : "";
  const accountPending = artist?.account_activated === false;
  const linkExpired = accountPending && artist?.activation_link_expired === true;

  return createPortal(
    <AnimatePresence>
      {isOpen && artist && (
        <>
          <motion.div
            key="dossier-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ zIndex: 99 }}
            className="fixed inset-0 bg-ethereal-ink/30 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            key="dossier-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{ zIndex: 100 }}
            className="fixed inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-ethereal-incense/20 bg-ethereal-parchment shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="z-20 flex flex-shrink-0 items-center justify-between gap-3 border-b border-ethereal-ink/8 bg-ethereal-alabaster/80 p-5 backdrop-blur-xl md:p-6">
              <div className="flex min-w-0 items-center gap-3.5">
                <Avatar
                  src={artist.avatar_thumb_url}
                  name={`${artist.first_name} ${artist.last_name}`}
                  size="md"
                  shape="rounded"
                  tone="neutral"
                  className="border border-ethereal-marble bg-ethereal-alabaster shadow-glass-solid"
                />
                <div className="min-w-0">
                  <Heading as="h3" size="lg" weight="bold" truncate>
                    {artist.first_name} {artist.last_name}
                  </Heading>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant={section ? section.badge : "neutral"} icon={<Music2 size={9} />}>
                      {voiceLabel}
                    </Badge>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.actions.close", "Zamknij")}
                className="shrink-0 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster p-2.5 text-ethereal-graphite shadow-sm transition-all hover:bg-ethereal-marble hover:text-ethereal-ink active:scale-95"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              {accountPending && (
                <div
                  className={cn(
                    "mb-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                    linkExpired
                      ? "border-ethereal-crimson/25 bg-ethereal-crimson/[0.06]"
                      : "border-ethereal-gold/25 bg-ethereal-gold/[0.07]",
                  )}
                >
                  <div
                    className={cn(
                      "flex min-w-0 items-start gap-2.5",
                      linkExpired ? "text-ethereal-crimson" : "text-ethereal-gold",
                    )}
                  >
                    <MailWarning size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <Eyebrow color={linkExpired ? "crimson" : "gold"}>
                        {linkExpired
                          ? t("artists.card.link_expired", "Link wygasł")
                          : t("artists.card.pending_activation", "Nie aktywowano")}
                      </Eyebrow>
                      <Caption color="muted" className="mt-0.5 block">
                        {linkExpired
                          ? t(
                              "artists.dossier.link_expired_desc",
                              "Link aktywacyjny stracił ważność. Wyślij zaproszenie ponownie, aby ten artysta mógł aktywować konto.",
                            )
                          : t(
                              "artists.dossier.pending_activation_desc",
                              "Zaproszenie zostało wysłane, ale ten artysta nie aktywował jeszcze konta na platformie.",
                            )}
                      </Caption>
                      {artist.activation_email_sent_at && (
                        <Caption
                          className={cn(
                            "mt-1 block font-semibold tabular-nums",
                            linkExpired
                              ? "text-ethereal-crimson/90"
                              : "text-ethereal-gold/90",
                          )}
                        >
                          {t("artists.card.invite_sent_at", {
                            defaultValue: "Wysłano {{when}}",
                            when: formatLocalizedDateTime(
                              artist.activation_email_sent_at,
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            ),
                          })}
                        </Caption>
                      )}
                    </div>
                  </div>
                  {onResendActivation && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onResendActivation(artist)}
                      isLoading={isResending}
                      leftIcon={<Send size={13} aria-hidden="true" />}
                      className="shrink-0 self-start sm:self-auto"
                    >
                      {t("artists.card.resend_activation", "Wyślij ponownie zaproszenie")}
                    </Button>
                  )}
                </div>
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
                <div className="space-y-7">
                  <StatsSection stats={data.stats} />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Eyebrow as="h4" color="graphite">
                        {t("artists.dossier.history_title", "Historia projektów")}
                      </Eyebrow>
                      <Caption color="muted" className="tabular-nums">
                        {data.projects.length}
                      </Caption>
                    </div>

                    {data.projects.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {data.projects.map((project) => (
                          <ProjectHistoryItem key={project.project_id} project={project} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-ethereal-ink/12 bg-ethereal-alabaster/40 p-6 text-center">
                        <Text size="sm" color="muted">
                          {t(
                            "artists.dossier.empty_history",
                            "Ten artysta nie brał jeszcze udziału w żadnym projekcie.",
                          )}
                        </Text>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer actions */}
            <div className="flex flex-shrink-0 items-center gap-3 border-t border-ethereal-ink/8 bg-ethereal-alabaster/85 p-4 backdrop-blur-xl md:px-6">
              <Button
                variant="secondary"
                onClick={() => onMessage(artist)}
                leftIcon={<MessageSquare size={15} aria-hidden="true" />}
                className="flex-1"
              >
                {t("artists.card.message_title", "Napisz wiadomość")}
              </Button>
              <Button
                variant="primary"
                onClick={() => onEdit(artist)}
                leftIcon={<Pencil size={15} aria-hidden="true" />}
                rightIcon={<ChevronRight size={15} aria-hidden="true" />}
                className="flex-1"
              >
                {t("artists.dossier.edit_profile", "Edytuj profil")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
