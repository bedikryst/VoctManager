/**
 * @file RehearsalPage.tsx
 * @description One evening, read by whoever sings in it. The hour, the room,
 * who stands in front — and the plan: what is rehearsed, in what order, and
 * which part of it is this reader's.
 *
 * A route rather than a panel inside the schedule, because it is the address a
 * push deep-links to and the one a singer sends to another. It works for an
 * evening already held — that is where "co przerobiliście w środę?" is
 * answered, and the ticks the leader wrote in the debrief are the answer.
 *
 * Two sources, deliberately: the rehearsal itself is read on its own
 * (`GET /api/rehearsals/<id>/`), which is the only read carrying this reader's
 * `calls_me` rows and `my_plan_window`; the schedule dashboard beside it
 * supplies the seat, so the RSVP written here is the same write as the one on
 * the card. A reader with no seat in the programme — a manager following the
 * link — gets the evening without the RSVP, which is the truth about them.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlignLeft,
  ArrowLeft,
  CalendarOff,
  Check,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  ListMusic,
  Printer,
  UserCheck,
} from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useArtistPreview } from "@/app/providers/ArtistPreviewProvider";
import { INERT_SURFACE } from "@/shared/ui/primitives/inertSurface";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { AbsenceReportForm } from "@/features/schedule/components/AbsenceReportForm";
import { AddToCalendar } from "@/features/schedule/components/AddToCalendar";
import { useScheduleData } from "@/features/schedule/hooks/useScheduleData";
import { useTimelineRehearsalCard } from "@/features/schedule/hooks/useTimelineRehearsalCard";
import type { TimelineEvent } from "@/features/schedule/types/schedule.dto";
import type { Rehearsal } from "@/shared/types";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { cn } from "@/shared/lib/utils";

import { useRehearsal } from "./api/rehearsals.queries";
import { RehearsalPlanTimeline } from "./components/plan/RehearsalPlanTimeline";
import { planWindowLabel } from "./lib/planWindow";
import { sectionNamesLabel } from "./lib/sectionLabels";

/** Past by the same four-hour grace the schedule's two tabs divide on. */
const PAST_GRACE_MS = 4 * 60 * 60 * 1000;

export default function RehearsalPage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const { rehearsalId } = useParams<{ rehearsalId: string }>();
  const { user } = useAuth();
  const { isPreview, artist: previewArtist } = useArtistPreview();
  const artistId =
    (isPreview ? previewArtist?.id : user?.artist_profile_id) ?? undefined;

  const { data: rehearsal, isLoading, isError } = useRehearsal(rehearsalId);
  // The seat, the existing answer and the span writer — all of them already
  // resolved for this reader by the schedule. Asking for them again here would
  // be a second read model of the same fact.
  const { allEvents, handleAbsenceSubmit, absenceRange } =
    useScheduleData(artistId);
  const event = allEvents.find(
    (candidate) =>
      candidate.type === "REHEARSAL" &&
      String((candidate.rawObj as { id: string }).id) === String(rehearsalId),
  );

  const backLink = (
    <Link
      to="/panel/schedule"
      className="inline-flex items-center gap-1.5 rounded-lg border border-ethereal-incense/20 bg-ethereal-alabaster px-2.5 py-1.5 shadow-glass-ethereal transition-all hover:border-ethereal-gold/40 hover:text-ethereal-ink active:scale-95"
    >
      <ArrowLeft size={12} className="text-ethereal-gold" aria-hidden="true" />
      <Eyebrow color="default">
        {t("schedule.rehearsal.page.back", "Harmonogram")}
      </Eyebrow>
    </Link>
  );

  return (
    <MotionConfig reducedMotion="user">
      <PageTransition>
        <div className="relative mx-auto max-w-3xl pb-6 pt-6">
          <StaggeredBentoContainer className="flex min-w-0 flex-col gap-5">
            <StaggeredBentoItem>
              <PageHeader
                size="standard"
                className="!mb-0 print-hidden"
                roleText={
                  rehearsal?.project_title ??
                  t("schedule.rehearsal.badge", "Próba")
                }
                title={t("schedule.rehearsal.page.title", "Plan")}
                titleHighlight={t(
                  "schedule.rehearsal.page.title_highlight",
                  "próby.",
                )}
                rightContent={backLink}
              />
            </StaggeredBentoItem>

            {isLoading ? (
              <StaggeredBentoItem>
                <EtherealLoader
                  fullHeight={false}
                  message={t(
                    "schedule.rehearsal.page.loading",
                    "Otwieram próbę...",
                  )}
                />
              </StaggeredBentoItem>
            ) : isError || !rehearsal ? (
              <StaggeredBentoItem>
                {/* The server answers the same 404 for an evening that never
                    existed and one this reader is not called to — and so does
                    this, rather than confirming that somebody else's rehearsal
                    is there. */}
                <StatePanel
                  variant="inline"
                  className="py-14"
                  icon={<CalendarOff size={22} aria-hidden="true" />}
                  title={t(
                    "schedule.rehearsal.page.gone.title",
                    "Nie ma takiej próby",
                  )}
                  description={t(
                    "schedule.rehearsal.page.gone.description",
                    "Ta próba została odwołana albo nie jesteś na nią wezwany. Zajrzyj do harmonogramu.",
                  )}
                  actions={
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/panel/schedule">
                        <ArrowLeft size={14} aria-hidden="true" />
                        {t("schedule.rehearsal.page.back", "Harmonogram")}
                      </Link>
                    </Button>
                  }
                />
              </StaggeredBentoItem>
            ) : (
              <RehearsalSheet
                rehearsal={rehearsal}
                event={event}
                language={i18n.language}
                isPreview={isPreview}
                onSubmitReport={handleAbsenceSubmit}
                absenceRange={absenceRange}
              />
            )}
          </StaggeredBentoContainer>
        </div>
      </PageTransition>
    </MotionConfig>
  );
}

interface RehearsalSheetProps {
  readonly rehearsal: Rehearsal;
  /** This reader's seat for the evening; absent for anyone not cast in it. */
  readonly event: TimelineEvent | undefined;
  readonly language: string;
  readonly isPreview: boolean;
  readonly onSubmitReport: ReturnType<
    typeof useScheduleData
  >["handleAbsenceSubmit"];
  readonly absenceRange: ReturnType<typeof useScheduleData>["absenceRange"];
}

const RehearsalSheet = ({
  rehearsal,
  event,
  language,
  isPreview,
  onSubmitReport,
  absenceRange,
}: RehearsalSheetProps): React.JSX.Element => {
  const { t } = useTranslation();
  const startsAt = new Date(rehearsal.date_time);
  const endsAt = rehearsal.end_date_time
    ? new Date(rehearsal.end_date_time)
    : null;
  const isPast = startsAt.getTime() < Date.now() - PAST_GRACE_MS;
  const rows = rehearsal.plan ?? [];
  const windowLabel = planWindowLabel(rehearsal.my_plan_window, t);
  const skipsReader = rehearsal.my_plan_window?.calls_me === false;
  const canRsvp = Boolean(event?.participationId) && !isPast;

  return (
    <>
      <StaggeredBentoItem>
        <GlassCard
          variant="ethereal"
          padding="none"
          isHoverable={false}
          className="print-sheet overflow-hidden border-t-2 border-t-ethereal-gold/40"
        >
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">
                {t("schedule.rehearsal.badge", "Próba")}
              </Badge>
              {!rehearsal.is_mandatory && (
                <Badge variant="incense">
                  {t("schedule.rehearsal.optional", "Opcjonalna")}
                </Badge>
              )}
              {rehearsal.called_sections ? (
                <Badge variant="amethyst">
                  {t("rehearsals.dashboard.sectional_only", "Tylko: {{sections}}", {
                    sections: sectionNamesLabel(rehearsal.called_sections, t),
                  })}
                </Badge>
              ) : null}
              {event?.status === "PRESENT" && (
                <Badge
                  variant="success"
                  icon={<CheckCircle2 size={11} aria-hidden="true" />}
                >
                  {t("schedule.rehearsal.status_present", "Potwierdzona")}
                </Badge>
              )}
            </div>

            <Heading as="h2" size="2xl" weight="bold" className="mt-3 leading-tight">
              {rehearsal.project_title ??
                t("schedule.event.generic_event", "Wydarzenie")}
            </Heading>

            <Text size="md" color="graphite" className="mt-1 block">
              {formatLocalizedDate(
                startsAt,
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                },
                language,
                rehearsal.timezone,
              )}
            </Text>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <DualTimeDisplay
                value={startsAt}
                endValue={endsAt}
                timeZone={rehearsal.timezone}
                icon={
                  <Clock
                    size={13}
                    className="text-ethereal-gold"
                    aria-hidden="true"
                  />
                }
                containerClassName="flex items-center gap-1.5"
                primaryTimeClassName="flex items-center gap-1.5 font-semibold text-ethereal-ink"
              />
              <LocationPreview
                locationRef={rehearsal.location}
                fallback={t("schedule.rehearsal.no_location", "Brak")}
                variant="minimal"
              />
              {rehearsal.led_by_name && (
                <span className="flex items-center gap-1.5">
                  <UserCheck
                    size={13}
                    className="text-ethereal-gold"
                    aria-hidden="true"
                  />
                  <Caption color="muted">
                    {t("schedule.rehearsal.led_by", "Prowadzi: {{name}}", {
                      name: rehearsal.led_by_name,
                    })}
                  </Caption>
                </span>
              )}
            </div>

            {/* The reader's own hours. The one number a person plans the
                evening around, so it sits above the plan rather than under it
                — and it is stated even when the plan leaves them out, because
                being told to come and not being needed is exactly the case
                worth naming. */}
            {windowLabel && (
              <div
                className={cn(
                  "mt-4 flex items-center gap-2.5 rounded-2xl border px-3.5 py-3",
                  skipsReader
                    ? "border-ethereal-incense/25 bg-ethereal-incense/8"
                    : "border-ethereal-gold/30 bg-ethereal-gold/8",
                )}
              >
                <ClipboardCheck
                  size={15}
                  className={
                    skipsReader ? "text-ethereal-incense" : "text-ethereal-gold"
                  }
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <Eyebrow color="muted" className="block">
                    {t("schedule.rehearsal.plan.my_part", "Twoja część")}
                  </Eyebrow>
                  <Text
                    size="lg"
                    weight="semibold"
                    className="block tabular-nums"
                  >
                    {windowLabel}
                  </Text>
                  {skipsReader && (
                    <Caption color="muted">
                      {t(
                        "schedule.rehearsal.plan.not_called_hint",
                        "Wezwanie zostaje w mocy — obecność liczy się jak zwykle.",
                      )}
                    </Caption>
                  )}
                </div>
              </div>
            )}

            {rehearsal.focus && (
              <div className="mt-4 rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/60 p-3.5">
                <Eyebrow color="muted" className="mb-1.5 flex items-center gap-1.5">
                  <AlignLeft size={12} aria-hidden="true" />
                  {t("schedule.rehearsal.focus_title", "Temat próby")}
                </Eyebrow>
                <Text
                  size="md"
                  className="whitespace-pre-wrap font-serif italic leading-relaxed"
                >
                  {rehearsal.focus}
                </Text>
              </div>
            )}
          </div>

          {/* ── the plan ─────────────────────────────────────────────── */}
          <div className="border-t border-ethereal-incense/15 bg-ethereal-parchment/25 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <Eyebrow color="muted" className="flex items-center gap-1.5">
                <ListMusic size={13} aria-hidden="true" />
                {t("schedule.rehearsal.plan.title", "Plan próby")}
              </Eyebrow>
              {rows.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.print()}
                  leftIcon={<Printer size={13} aria-hidden="true" />}
                  className="print-hidden hidden sm:inline-flex"
                >
                  {t("schedule.rehearsal.plan.print", "Drukuj")}
                </Button>
              )}
            </div>

            {rows.length > 0 ? (
              <RehearsalPlanTimeline
                rows={rows}
                // A row whose music the songbook withholds from this reader
                // (an instrumental item, through a singer's seat) reads like a
                // free row: the address would only answer "Nie znaleziono".
                hrefOf={(row) =>
                  row.piece && row.piece_open !== false
                    ? `/panel/materials/${rehearsal.project}/${row.piece}`
                    : null
                }
              />
            ) : (
              <Text size="sm" color="muted" className="italic">
                {isPast
                  ? t(
                      "schedule.rehearsal.plan.empty_past",
                      "Dla tej próby nie ułożono planu.",
                    )
                  : t(
                      "schedule.rehearsal.plan.empty",
                      "Plan tej próby nie został jeszcze ułożony.",
                    )}
              </Text>
            )}
          </div>
        </GlassCard>
      </StaggeredBentoItem>

      {/* ── the answer, for whoever has a seat in this programme ─────── */}
      {event && (
        <StaggeredBentoItem>
          <RehearsalAnswer
            event={event}
            canRsvp={canRsvp}
            isPast={isPast}
            isPreview={isPreview}
            onSubmitReport={onSubmitReport}
            absenceRange={absenceRange}
          />
        </StaggeredBentoItem>
      )}
    </>
  );
};

interface RehearsalAnswerProps {
  readonly event: TimelineEvent;
  readonly canRsvp: boolean;
  readonly isPast: boolean;
  readonly isPreview: boolean;
  readonly onSubmitReport: RehearsalSheetProps["onSubmitReport"];
  readonly absenceRange: RehearsalSheetProps["absenceRange"];
}

/**
 * The RSVP pair and the calendar, written exactly as the timeline card writes
 * them — the same hook, so an answer given here and one given on the card are
 * one write, masked one way. A held evening keeps neither: it belongs to the
 * roll call, and the server refuses a singer's own edit to it.
 */
const RehearsalAnswer = ({
  event,
  canRsvp,
  isPast,
  isPreview,
  onSubmitReport,
  absenceRange,
}: RehearsalAnswerProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const {
    reportingMode,
    setReportingMode,
    isSubmitting,
    currentMaskedStatus,
    reportForm,
    setReportForm,
    handleConfirmPresence,
    handleSubmitReport,
    enableReportingMode,
    range,
  } = useTimelineRehearsalCard(
    event,
    onSubmitReport,
    () => undefined,
    false,
    absenceRange,
  );

  if (isPast) return null;

  return (
    <GlassCard
      variant="light"
      padding="none"
      isHoverable={false}
      className="print-hidden overflow-hidden"
    >
      {!reportingMode && (
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          {canRsvp && (
            <div
              inert={isPreview}
              className={cn(
                "flex flex-col gap-2 sm:flex-row",
                isPreview && INERT_SURFACE,
              )}
            >
              {currentMaskedStatus !== "PRESENT" && (
                <Button
                  variant="primary"
                  size="touch"
                  onClick={handleConfirmPresence}
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                  leftIcon={
                    !isSubmitting ? <Check size={13} aria-hidden="true" /> : undefined
                  }
                  className="w-full border-ethereal-sage bg-ethereal-sage hover:bg-ethereal-sage/80 sm:w-auto"
                >
                  {t("schedule.rehearsal.action.confirm_long", "Potwierdź Obecność")}
                </Button>
              )}
              <Button
                variant="outline"
                size="touch"
                onClick={enableReportingMode}
                leftIcon={<AlertCircle size={13} aria-hidden="true" />}
                className={cn(
                  "w-full sm:w-auto",
                  currentMaskedStatus === "ABSENT" &&
                    "text-ethereal-crimson hover:border-ethereal-crimson/30",
                )}
              >
                {currentMaskedStatus
                  ? t("schedule.rehearsal.action.edit", "Edytuj")
                  : t("schedule.rehearsal.action.report_issue", "Zgłoś problem")}
              </Button>
            </div>
          )}
          <AddToCalendar event={event} tone="light" />
        </div>
      )}

      <AnimatePresence>
        {reportingMode && (
          <motion.div
            key="page-report-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-ethereal-crimson/15 bg-ethereal-crimson/5"
          >
            <AbsenceReportForm
              reportForm={reportForm}
              setReportForm={setReportForm}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmitReport}
              onCancel={() => setReportingMode(false)}
              range={range}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
